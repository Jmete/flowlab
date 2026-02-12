import { computeMinCut } from "@/algorithms/mincut";
import { buildResidualGraph, type ResidualEdge } from "@/algorithms/residual";
import type { MaxFlowRunOptions, MaxFlowRunResult } from "@/algorithms/types";
import { cloneGraph, getSourceSinkIds, type Graph, type NodeID, validateGraphForRun } from "@/models/graph";
import type { FlowEvent } from "@/models/events";

function computeSourceOutflow(graph: Graph, sourceId: NodeID): number {
  let total = 0;
  for (const edge of Object.values(graph.edges)) {
    if (edge.from === sourceId) {
      total += edge.flow;
    }
  }
  return total;
}

function applyResidualPush(
  graph: Graph,
  residualEdge: ResidualEdge,
  delta: number,
): { ok: true; update: { edgeId: string; newFlow: number } } | { ok: false; message: string } {
  const edge = graph.edges[residualEdge.originalEdgeId];
  if (!edge) {
    return { ok: false, message: `Missing edge for residual segment ${residualEdge.originalEdgeId}.` };
  }

  if (residualEdge.isReverse) {
    edge.flow -= delta;
  } else {
    edge.flow += delta;
  }

  if (edge.flow < 0) {
    return { ok: false, message: `Negative flow detected on edge ${edge.id}.` };
  }
  if (edge.flow > edge.capacity) {
    return { ok: false, message: `Flow exceeded capacity on edge ${edge.id}.` };
  }

  return {
    ok: true,
    update: { edgeId: edge.id, newFlow: edge.flow },
  };
}

function enqueueActiveNode(
  queue: NodeID[],
  activeSet: Set<NodeID>,
  nodeId: NodeID,
  sourceId: NodeID,
  sinkId: NodeID,
) {
  if (nodeId === sourceId || nodeId === sinkId || activeSet.has(nodeId)) {
    return;
  }
  queue.push(nodeId);
  activeSet.add(nodeId);
}

export function runPushRelabel(inputGraph: Graph, options: MaxFlowRunOptions = {}): MaxFlowRunResult {
  const graph = cloneGraph(inputGraph);
  const events: FlowEvent[] = [{ type: "ALGORITHM_SELECTED", algorithm: "push-relabel" }];

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

  const nodeIds = Object.keys(graph.nodes).sort((a, b) => a.localeCompare(b));
  const nodeCount = nodeIds.length;
  const height: Record<NodeID, number> = {};
  const excess: Record<NodeID, number> = {};

  for (const nodeId of nodeIds) {
    height[nodeId] = 0;
    excess[nodeId] = 0;
  }
  height[sourceId] = nodeCount;

  let currentMaxFlow = 0;
  let iteration = 1;
  let operationCount = 0;

  const activeQueue: NodeID[] = [];
  const activeSet: Set<NodeID> = new Set<NodeID>();

  events.push({ type: "RUN_START", source: sourceId, sink: sinkId, timestamp: now() });

  const sortedEdges = Object.values(graph.edges).slice().sort((a, b) => a.id.localeCompare(b.id));
  for (const edge of sortedEdges) {
    if (edge.from !== sourceId || edge.capacity <= 0) {
      continue;
    }

    const delta = edge.capacity;
    edge.flow = delta;
    excess[sourceId] -= delta;
    excess[edge.to] += delta;

    currentMaxFlow = computeSourceOutflow(graph, sourceId);
    events.push({
      type: "PUSH_RELABEL_PUSH",
      from: sourceId,
      to: edge.to,
      delta,
      isReverse: false,
      originalEdgeId: edge.id,
    });
    events.push({
      type: "AUGMENT_APPLY",
      delta,
      updates: [{ edgeId: edge.id, newFlow: edge.flow }],
    });
    events.push({ type: "ITERATION_END", iteration, currentMaxFlow });

    iteration += 1;
    operationCount += 1;

    if (operationCount > maxSteps) {
      break;
    }

    if (excess[edge.to] > 0) {
      enqueueActiveNode(activeQueue, activeSet, edge.to, sourceId, sinkId);
    }
  }

  events.push({ type: "PUSH_RELABEL_INIT", activeNodes: activeQueue.length });

  while (activeQueue.length > 0 && operationCount <= maxSteps) {
    const nodeId = activeQueue.shift()!;
    activeSet.delete(nodeId);
    if (excess[nodeId] <= 0) {
      continue;
    }

    while (excess[nodeId] > 0 && operationCount <= maxSteps) {
      const residual = buildResidualGraph(graph);
      events.push({ type: "RESIDUAL_BUILT", residualEdgeCount: residual.edges.length });

      const outgoing = residual.outgoing[nodeId] ?? [];
      let pushed = false;

      for (const candidate of outgoing) {
        if (excess[nodeId] <= 0) {
          break;
        }

        const sourceHeight = height[nodeId] ?? 0;
        const targetHeight = height[candidate.to] ?? 0;
        if (sourceHeight !== targetHeight + 1) {
          continue;
        }

        const delta = Math.min(excess[nodeId], candidate.residualCapacity);
        if (delta <= 0) {
          continue;
        }

        const applied = applyResidualPush(graph, candidate, delta);
        if (!applied.ok) {
          events.push({ type: "ERROR", message: applied.message });
          return {
            maxFlowValue: currentMaxFlow,
            graph,
            events,
          };
        }

        excess[nodeId] -= delta;
        excess[candidate.to] += delta;

        currentMaxFlow = computeSourceOutflow(graph, sourceId);
        events.push({
          type: "PUSH_RELABEL_PUSH",
          from: candidate.from,
          to: candidate.to,
          delta,
          isReverse: candidate.isReverse,
          originalEdgeId: candidate.originalEdgeId,
        });
        events.push({
          type: "AUGMENT_APPLY",
          delta,
          updates: [applied.update],
        });
        events.push({ type: "ITERATION_END", iteration, currentMaxFlow });
        iteration += 1;
        operationCount += 1;
        pushed = true;

        if (excess[candidate.to] > 0) {
          enqueueActiveNode(activeQueue, activeSet, candidate.to, sourceId, sinkId);
        }

        if (operationCount > maxSteps) {
          break;
        }
      }

      if (operationCount > maxSteps) {
        break;
      }

      if (pushed) {
        continue;
      }

      let minNeighborHeight = Number.POSITIVE_INFINITY;
      for (const candidate of outgoing) {
        if (candidate.residualCapacity <= 0) {
          continue;
        }
        minNeighborHeight = Math.min(minNeighborHeight, height[candidate.to] ?? 0);
      }

      if (!Number.isFinite(minNeighborHeight)) {
        break;
      }

      height[nodeId] = minNeighborHeight + 1;
      events.push({ type: "PUSH_RELABEL_RELABEL", node: nodeId, newHeight: height[nodeId] });
      operationCount += 1;
    }

    if (excess[nodeId] > 0) {
      enqueueActiveNode(activeQueue, activeSet, nodeId, sourceId, sinkId);
    }
  }

  if (operationCount > maxSteps) {
    events.push({ type: "ERROR", message: "Step limit exceeded" });
  } else {
    currentMaxFlow = computeSourceOutflow(graph, sourceId);
    events.push({ type: "NO_MORE_PATHS", iteration, maxFlow: currentMaxFlow });
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
