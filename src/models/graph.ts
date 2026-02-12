export type NodeID = string;
export type EdgeID = string;

export interface Node {
  id: NodeID;
  label: string;
  x: number;
  y: number;
  role: "normal" | "source" | "sink";
}

export interface Edge {
  id: EdgeID;
  from: NodeID;
  to: NodeID;
  capacity: number;
  flow: number;
  directed: true;
  label?: string;
}

export interface Graph {
  nodes: Record<NodeID, Node>;
  edges: Record<EdgeID, Edge>;
  meta: {
    version: "1.0";
    createdAt: number;
    updatedAt: number;
  };
}

export interface GraphValidationResult {
  ok: boolean;
  errors: string[];
}

export interface GraphNormalizationResult {
  graph: Graph;
  warnings: string[];
}

export function createEmptyGraph(): Graph {
  const now = Date.now();
  return {
    nodes: {},
    edges: {},
    meta: {
      version: "1.0",
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function cloneGraph(graph: Graph): Graph {
  return {
    nodes: Object.fromEntries(Object.values(graph.nodes).map((node) => [node.id, { ...node }])),
    edges: Object.fromEntries(Object.values(graph.edges).map((edge) => [edge.id, { ...edge }])),
    meta: { ...graph.meta },
  };
}

export function getSourceSinkIds(graph: Graph): { sourceId?: NodeID; sinkId?: NodeID; sourceCount: number; sinkCount: number } {
  const sourceNodes = Object.values(graph.nodes).filter((node) => node.role === "source");
  const sinkNodes = Object.values(graph.nodes).filter((node) => node.role === "sink");
  return {
    sourceId: sourceNodes[0]?.id,
    sinkId: sinkNodes[0]?.id,
    sourceCount: sourceNodes.length,
    sinkCount: sinkNodes.length,
  };
}

export function validateGraphForRun(graph: Graph): GraphValidationResult {
  const errors: string[] = [];
  const { sourceId, sinkId, sourceCount, sinkCount } = getSourceSinkIds(graph);

  if (sourceCount !== 1) {
    errors.push("Exactly one source node is required.");
  }
  if (sinkCount !== 1) {
    errors.push("Exactly one sink node is required.");
  }
  if (sourceId && sinkId && sourceId === sinkId) {
    errors.push("Source and sink must be different nodes.");
  }

  const edgeKeySet = new Set<string>();

  for (const edge of Object.values(graph.edges)) {
    if (edge.from === edge.to) {
      errors.push(`Self loop is not allowed on edge ${edge.id}.`);
    }
    if (!Number.isInteger(edge.capacity) || edge.capacity < 0) {
      errors.push(`Edge ${edge.id} has invalid capacity.`);
    }
    if (!Number.isInteger(edge.flow) || edge.flow < 0) {
      errors.push(`Edge ${edge.id} has invalid flow.`);
    }
    if (edge.flow > edge.capacity) {
      errors.push(`Edge ${edge.id} has flow greater than capacity.`);
    }
    const key = `${edge.from}->${edge.to}`;
    if (edgeKeySet.has(key)) {
      errors.push(`Duplicate edge ${key} is not allowed in MVP.`);
    }
    edgeKeySet.add(key);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function touchGraph(graph: Graph): Graph {
  graph.meta.updatedAt = Date.now();
  return graph;
}

export function normalizeImportedGraph(rawGraph: Graph): GraphNormalizationResult {
  const graph = cloneGraph(rawGraph);
  const warnings: string[] = [];

  const nodeIds = new Set<string>();
  for (const node of Object.values(graph.nodes)) {
    if (nodeIds.has(node.id)) {
      warnings.push(`Duplicate node id ${node.id} found; keeping first occurrence.`);
      delete graph.nodes[node.id];
      continue;
    }
    nodeIds.add(node.id);
  }

  const edgeIds = new Set<string>();
  const edgePairSet = new Set<string>();
  for (const edge of Object.values(graph.edges)) {
    if (edgeIds.has(edge.id)) {
      warnings.push(`Duplicate edge id ${edge.id} found; removing duplicate.`);
      delete graph.edges[edge.id];
      continue;
    }
    edgeIds.add(edge.id);

    if (!Number.isInteger(edge.capacity) || edge.capacity < 0) {
      warnings.push(`Edge ${edge.id} capacity was invalid and clamped to 0.`);
      edge.capacity = 0;
    }
    if (!Number.isInteger(edge.flow) || edge.flow < 0) {
      warnings.push(`Edge ${edge.id} flow was invalid and clamped to 0.`);
      edge.flow = 0;
    }
    if (edge.flow > edge.capacity) {
      warnings.push(`Edge ${edge.id} flow exceeded capacity and was clamped.`);
      edge.flow = edge.capacity;
    }

    if (edge.from === edge.to) {
      warnings.push(`Self loop edge ${edge.id} removed.`);
      delete graph.edges[edge.id];
      continue;
    }

    const pairKey = `${edge.from}->${edge.to}`;
    if (edgePairSet.has(pairKey)) {
      warnings.push(`Duplicate edge pair ${pairKey} removed.`);
      delete graph.edges[edge.id];
      continue;
    }
    edgePairSet.add(pairKey);

    if (!graph.nodes[edge.from] || !graph.nodes[edge.to]) {
      warnings.push(`Edge ${edge.id} had missing endpoints and was removed.`);
      delete graph.edges[edge.id];
    }
  }

  const sourceNodes = Object.values(graph.nodes).filter((node) => node.role === "source");
  const sinkNodes = Object.values(graph.nodes).filter((node) => node.role === "sink");

  if (sourceNodes.length > 1) {
    const keepId = sourceNodes[0].id;
    for (const node of sourceNodes.slice(1)) {
      node.role = "normal";
    }
    warnings.push(`Multiple source nodes found; kept ${keepId} as source and demoted others.`);
  }

  if (sinkNodes.length > 1) {
    const keepId = sinkNodes[0].id;
    for (const node of sinkNodes.slice(1)) {
      node.role = "normal";
    }
    warnings.push(`Multiple sink nodes found; kept ${keepId} as sink and demoted others.`);
  }

  if (!graph.meta?.version) {
    const now = Date.now();
    graph.meta = {
      version: "1.0",
      createdAt: now,
      updatedAt: now,
    };
  } else {
    graph.meta.version = "1.0";
    graph.meta.updatedAt = Date.now();
    graph.meta.createdAt = Number.isFinite(graph.meta.createdAt) ? graph.meta.createdAt : Date.now();
  }

  return { graph, warnings };
}

export function ensureCapacityAndFlow(edge: Edge): { edge: Edge; clamped: boolean } {
  let clamped = false;
  const nextEdge = { ...edge };
  if (!Number.isInteger(nextEdge.capacity) || nextEdge.capacity < 0) {
    nextEdge.capacity = 0;
    clamped = true;
  }
  if (!Number.isInteger(nextEdge.flow) || nextEdge.flow < 0) {
    nextEdge.flow = 0;
    clamped = true;
  }
  if (nextEdge.flow > nextEdge.capacity) {
    nextEdge.flow = nextEdge.capacity;
    clamped = true;
  }
  return { edge: nextEdge, clamped };
}

export function hasPathCandidate(graph: Graph, sourceId: NodeID, sinkId: NodeID): boolean {
  const queue: NodeID[] = [sourceId];
  const visited = new Set<NodeID>([sourceId]);
  const adjacency = new Map<NodeID, NodeID[]>();

  for (const edge of Object.values(graph.edges)) {
    if (edge.capacity <= 0) {
      continue;
    }
    const current = adjacency.get(edge.from) ?? [];
    current.push(edge.to);
    adjacency.set(edge.from, current);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (nodeId === sinkId) {
      return true;
    }
    const neighbors = (adjacency.get(nodeId) ?? []).slice().sort((a, b) => a.localeCompare(b));
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return false;
}

export function withFlowOverrides(graph: Graph, edgeFlows: Record<EdgeID, number>): Graph {
  const cloned = cloneGraph(graph);
  for (const edge of Object.values(cloned.edges)) {
    if (edgeFlows[edge.id] === undefined) {
      continue;
    }
    edge.flow = Math.max(0, Math.min(edge.capacity, Math.trunc(edgeFlows[edge.id])));
  }
  return cloned;
}
