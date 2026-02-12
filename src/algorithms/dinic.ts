import { computeMinCut } from "@/algorithms/mincut";
import { buildResidualGraph, type ResidualEdge, type ResidualGraph } from "@/algorithms/residual";
import type { MaxFlowRunOptions, MaxFlowRunResult } from "@/algorithms/types";
import { cloneGraph, getSourceSinkIds, validateGraphForRun, type Graph, type NodeID } from "@/models/graph";
import type { FlowEvent } from "@/models/events";

interface ParentEntry {
  prev: NodeID;
  via: ResidualEdge;
}

function buildLevels(residual: ResidualGraph, sourceId: NodeID): Record<NodeID, number> {
  const levels: Record<NodeID, number> = { [sourceId]: 0 };
  const queue: NodeID[] = [sourceId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const nextLevel = levels[nodeId] + 1;
    for (const edge of residual.outgoing[nodeId] ?? []) {
      if (levels[edge.to] !== undefined || edge.residualCapacity <= 0) {
        continue;
      }
      levels[edge.to] = nextLevel;
      queue.push(edge.to);
    }
  }

  return levels;
}

function findLevelPath(
  residual: ResidualGraph,
  levels: Record<NodeID, number>,
  sourceId: NodeID,
  sinkId: NodeID,
): ResidualEdge[] | undefined {
  const queue: NodeID[] = [sourceId];
  const visited: Set<NodeID> = new Set<NodeID>([sourceId]);
  const parent: Record<NodeID, ParentEntry | undefined> = {};

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (nodeId === sinkId) {
      break;
    }

    const expectedNextLevel = (levels[nodeId] ?? -1) + 1;
    for (const edge of residual.outgoing[nodeId] ?? []) {
      if (visited.has(edge.to)) {
        continue;
      }
      if (edge.residualCapacity <= 0) {
        continue;
      }
      if (levels[edge.to] !== expectedNextLevel) {
        continue;
      }

      visited.add(edge.to);
      parent[edge.to] = { prev: nodeId, via: edge };
      queue.push(edge.to);
    }
  }

  if (!visited.has(sinkId)) {
    return undefined;
  }

  const path: ResidualEdge[] = [];
  let cursor: NodeID = sinkId;
  while (cursor !== sourceId) {
    const entry = parent[cursor];
    if (!entry) {
      return undefined;
    }
    path.push(entry.via);
    cursor = entry.prev;
  }
  path.reverse();
  return path;
}

function applyPath(graph: Graph, path: ResidualEdge[], bottleneck: number): { ok: true; updates: Array<{ edgeId: string; newFlow: number }> } | { ok: false; message: string } {
  const updates: Array<{ edgeId: string; newFlow: number }> = [];

  for (const segment of path) {
    const edge = graph.edges[segment.originalEdgeId];
    if (!edge) {
      return { ok: false, message: `Missing edge for residual segment ${segment.originalEdgeId}.` };
    }

    if (segment.isReverse) {
      edge.flow -= bottleneck;
    } else {
      edge.flow += bottleneck;
    }

    if (edge.flow < 0) {
      return { ok: false, message: `Negative flow detected on edge ${edge.id}.` };
    }
    if (edge.flow > edge.capacity) {
      return { ok: false, message: `Flow exceeded capacity on edge ${edge.id}.` };
    }

    updates.push({ edgeId: edge.id, newFlow: edge.flow });
  }

  return { ok: true, updates };
}

export function runDinic(inputGraph: Graph, options: MaxFlowRunOptions = {}): MaxFlowRunResult {
  const graph = cloneGraph(inputGraph);
  const events: FlowEvent[] = [{ type: "ALGORITHM_SELECTED", algorithm: "dinic" }];

  const now = options.timestampFactory ?? (() => Date.now());
  const maxSteps = options.maxSteps ?? 50000;

  const validation = validateGraphForRun(graph);
  if (!validation.ok) {
    events.push({ type: "ERROR", message: validation.errors.join(" ") });
    return { maxFlowValue: 0, graph, events };
  }

  const { sourceId, sinkId } = getSourceSinkIds(graph);
  if (!sourceId || !sinkId) {
    events.push({ type: "ERROR", message: "Missing source or sink." });
    return { maxFlowValue: 0, graph, events };
  }

  let currentMaxFlow = 0;
  let iteration = 1;
  let phase = 1;

  events.push({ type: "RUN_START", source: sourceId, sink: sinkId, timestamp: now() });

  while (iteration <= maxSteps) {
    const residual = buildResidualGraph(graph);
    events.push({ type: "RESIDUAL_BUILT", residualEdgeCount: residual.edges.length });

    const levels = buildLevels(residual, sourceId);
    events.push({
      type: "DINIC_LEVEL_GRAPH_BUILT",
      phase,
      reachableNodes: Object.keys(levels).length,
    });

    if (levels[sinkId] === undefined) {
      events.push({ type: "NO_MORE_PATHS", iteration, maxFlow: currentMaxFlow });
      break;
    }

    let phasePushedFlow = 0;

    while (iteration <= maxSteps) {
      const residualForPath = buildResidualGraph(graph);
      const path = findLevelPath(residualForPath, levels, sourceId, sinkId);
      if (!path) {
        break;
      }

      let bottleneck = Number.POSITIVE_INFINITY;
      for (const segment of path) {
        bottleneck = Math.min(bottleneck, segment.residualCapacity);
      }

      events.push({
        type: "AUGMENTING_PATH_FOUND",
        path: path.map((segment) => ({
          from: segment.from,
          to: segment.to,
          isReverse: segment.isReverse,
          originalEdgeId: segment.originalEdgeId,
        })),
        bottleneck,
      });

      const applied = applyPath(graph, path, bottleneck);
      if (!applied.ok) {
        events.push({ type: "ERROR", message: applied.message });
        return {
          maxFlowValue: currentMaxFlow,
          graph,
          events,
        };
      }

      currentMaxFlow += bottleneck;
      phasePushedFlow += bottleneck;

      events.push({
        type: "AUGMENT_APPLY",
        delta: bottleneck,
        updates: applied.updates,
      });
      events.push({ type: "ITERATION_END", iteration, currentMaxFlow });
      iteration += 1;
    }

    events.push({ type: "DINIC_BLOCKING_FLOW_END", phase, pushedFlow: phasePushedFlow });
    phase += 1;
  }

  if (iteration > maxSteps) {
    events.push({ type: "ERROR", message: "Step limit exceeded" });
  }

  const minCut = computeMinCut(graph, sourceId);
  events.push({
    type: "MINCUT_COMPUTED",
    reachable: minCut.reachable,
    cutEdges: minCut.cutEdges,
    cutCapacity: minCut.cutCapacity,
  });
  events.push({ type: "RUN_END", maxFlow: currentMaxFlow, timestamp: now() });

  return {
    maxFlowValue: currentMaxFlow,
    graph,
    events,
    minCut,
  };
}
