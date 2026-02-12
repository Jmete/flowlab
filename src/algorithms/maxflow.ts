import { computeMinCut, type MinCutResult } from "@/algorithms/mincut";
import { buildResidualGraph, type ResidualEdge } from "@/algorithms/residual";
import { cloneGraph, getSourceSinkIds, validateGraphForRun, type Graph } from "@/models/graph";
import type { FlowEvent } from "@/models/events";

interface ParentEntry {
  prev: string;
  via: ResidualEdge;
}

export interface MaxFlowRunOptions {
  maxSteps?: number;
  timestampFactory?: () => number;
}

export interface MaxFlowRunResult {
  maxFlowValue: number;
  graph: Graph;
  events: FlowEvent[];
  minCut?: MinCutResult;
}

export function runEdmondsKarp(inputGraph: Graph, options: MaxFlowRunOptions = {}): MaxFlowRunResult {
  const graph = cloneGraph(inputGraph);
  const events: FlowEvent[] = [];

  const now = options.timestampFactory ?? (() => Date.now());
  const maxSteps = options.maxSteps ?? 50000;

  const validation = validateGraphForRun(graph);
  if (!validation.ok) {
    events.push({ type: "ERROR", message: validation.errors.join(" ") });
    return {
      maxFlowValue: 0,
      graph,
      events,
    };
  }

  const { sourceId, sinkId } = getSourceSinkIds(graph);
  if (!sourceId || !sinkId) {
    events.push({ type: "ERROR", message: "Missing source or sink." });
    return {
      maxFlowValue: 0,
      graph,
      events,
    };
  }
  const resolvedSourceId: string = sourceId;
  const resolvedSinkId: string = sinkId;

  let currentMaxFlow = 0;
  let iteration = 1;

  events.push({ type: "RUN_START", source: resolvedSourceId, sink: resolvedSinkId, timestamp: now() });

  while (iteration <= maxSteps) {
    const residual = buildResidualGraph(graph);
    events.push({ type: "RESIDUAL_BUILT", residualEdgeCount: residual.edges.length });
    events.push({ type: "BFS_START", iteration });

    const queue: string[] = [resolvedSourceId];
    const visited: Set<string> = new Set<string>([resolvedSourceId]);
    const parent: Record<string, ParentEntry | undefined> = {};
    let foundSink = false;

    while (queue.length > 0 && !foundSink) {
      const nodeId = queue.shift()!;
      events.push({ type: "BFS_VISIT_NODE", node: nodeId });

      const outgoing = residual.outgoing[nodeId] ?? [];
      for (const edge of outgoing) {
        if (visited.has(edge.to)) {
          continue;
        }
        parent[edge.to] = { prev: nodeId, via: edge };
        visited.add(edge.to);
        events.push({
          type: "BFS_DISCOVER_EDGE",
          from: edge.from,
          to: edge.to,
          residualCapacity: edge.residualCapacity,
          isReverse: edge.isReverse,
          originalEdgeId: edge.originalEdgeId,
        });

        if (edge.to === resolvedSinkId) {
          foundSink = true;
          break;
        }
        queue.push(edge.to);
      }
    }

    if (!foundSink) {
      events.push({ type: "NO_MORE_PATHS", iteration, maxFlow: currentMaxFlow });
      break;
    }

    const path: ResidualEdge[] = [];
    let cursor: string = resolvedSinkId;

    while (cursor !== resolvedSourceId) {
      const entry = parent[cursor];
      if (!entry) {
        events.push({ type: "ERROR", message: "BFS parent reconstruction failed." });
        return {
          maxFlowValue: currentMaxFlow,
          graph,
          events,
        };
      }
      path.push(entry.via);
      cursor = entry.prev;
    }

    path.reverse();

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

    const updates: Array<{ edgeId: string; newFlow: number }> = [];

    for (const segment of path) {
      const edge = graph.edges[segment.originalEdgeId];
      if (!edge) {
        events.push({ type: "ERROR", message: `Missing edge for residual segment ${segment.originalEdgeId}.` });
        return {
          maxFlowValue: currentMaxFlow,
          graph,
          events,
        };
      }

      if (segment.isReverse) {
        edge.flow -= bottleneck;
      } else {
        edge.flow += bottleneck;
      }

      if (edge.flow < 0) {
        events.push({ type: "ERROR", message: `Negative flow detected on edge ${edge.id}.` });
        return {
          maxFlowValue: currentMaxFlow,
          graph,
          events,
        };
      }

      if (edge.flow > edge.capacity) {
        events.push({ type: "ERROR", message: `Flow exceeded capacity on edge ${edge.id}.` });
        return {
          maxFlowValue: currentMaxFlow,
          graph,
          events,
        };
      }

      updates.push({ edgeId: edge.id, newFlow: edge.flow });
    }

    currentMaxFlow += bottleneck;

    events.push({
      type: "AUGMENT_APPLY",
      delta: bottleneck,
      updates,
    });
    events.push({ type: "ITERATION_END", iteration, currentMaxFlow });

    iteration += 1;
  }

  if (iteration > maxSteps) {
    events.push({ type: "ERROR", message: "Step limit exceeded" });
  }

  const minCut = computeMinCut(graph, resolvedSourceId);
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
