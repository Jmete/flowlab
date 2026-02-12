import type { EdgeID, Graph, NodeID } from "@/models/graph";

export interface ResidualEdge {
  id: string;
  from: NodeID;
  to: NodeID;
  residualCapacity: number;
  originalEdgeId: EdgeID;
  isReverse: boolean;
}

export interface ResidualGraph {
  edges: ResidualEdge[];
  outgoing: Record<NodeID, ResidualEdge[]>;
}

function compareResidual(a: ResidualEdge, b: ResidualEdge): number {
  if (a.from !== b.from) {
    return a.from.localeCompare(b.from);
  }
  if (a.to !== b.to) {
    return a.to.localeCompare(b.to);
  }
  if (a.originalEdgeId !== b.originalEdgeId) {
    return a.originalEdgeId.localeCompare(b.originalEdgeId);
  }
  return Number(a.isReverse) - Number(b.isReverse);
}

export function buildResidualGraph(graph: Graph): ResidualGraph {
  const residual: ResidualEdge[] = [];
  const sortedEdges = Object.values(graph.edges).slice().sort((a, b) => a.id.localeCompare(b.id));

  for (const edge of sortedEdges) {
    const forward = edge.capacity - edge.flow;
    if (forward > 0) {
      residual.push({
        id: `${edge.from}->${edge.to}:${edge.id}:f`,
        from: edge.from,
        to: edge.to,
        residualCapacity: forward,
        originalEdgeId: edge.id,
        isReverse: false,
      });
    }

    if (edge.flow > 0) {
      residual.push({
        id: `${edge.to}->${edge.from}:${edge.id}:r`,
        from: edge.to,
        to: edge.from,
        residualCapacity: edge.flow,
        originalEdgeId: edge.id,
        isReverse: true,
      });
    }
  }

  residual.sort(compareResidual);
  const outgoing: Record<NodeID, ResidualEdge[]> = {};

  for (const edge of residual) {
    if (!outgoing[edge.from]) {
      outgoing[edge.from] = [];
    }
    outgoing[edge.from].push(edge);
  }

  for (const nodeId of Object.keys(graph.nodes)) {
    if (!outgoing[nodeId]) {
      outgoing[nodeId] = [];
    }
  }

  return { edges: residual, outgoing };
}

export function findReachableFromSource(residual: ResidualGraph, sourceId: NodeID): Set<NodeID> {
  const visited = new Set<NodeID>();
  const queue: NodeID[] = [sourceId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    for (const edge of residual.outgoing[current] ?? []) {
      if (edge.residualCapacity <= 0 || visited.has(edge.to)) {
        continue;
      }
      queue.push(edge.to);
    }
  }

  return visited;
}
