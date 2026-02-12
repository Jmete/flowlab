import { buildResidualGraph, findReachableFromSource } from "@/algorithms/residual";
import type { EdgeID, Graph, NodeID } from "@/models/graph";

export interface MinCutResult {
  reachable: NodeID[];
  cutEdges: EdgeID[];
  cutCapacity: number;
}

export function computeMinCut(graph: Graph, sourceId: NodeID): MinCutResult {
  const residual = buildResidualGraph(graph);
  const reachableSet = findReachableFromSource(residual, sourceId);

  const cutEdges = Object.values(graph.edges)
    .filter((edge) => reachableSet.has(edge.from) && !reachableSet.has(edge.to) && edge.capacity > 0)
    .map((edge) => edge.id)
    .sort((a, b) => a.localeCompare(b));

  let cutCapacity = 0;
  for (const edgeId of cutEdges) {
    cutCapacity += graph.edges[edgeId].capacity;
  }

  return {
    reachable: Array.from(reachableSet).sort((a, b) => a.localeCompare(b)),
    cutEdges,
    cutCapacity,
  };
}
