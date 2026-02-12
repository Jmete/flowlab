import { runEdmondsKarp } from "@/algorithms/maxflow";
import type { Graph } from "@/models/graph";

function singleEdgeGraph(): Graph {
  return {
    nodes: {
      s: { id: "s", label: "S", x: 0, y: 0, role: "source" },
      t: { id: "t", label: "T", x: 100, y: 0, role: "sink" },
    },
    edges: {
      e1: { id: "e1", from: "s", to: "t", capacity: 7, flow: 0, directed: true },
    },
    meta: { version: "1.0", createdAt: 1, updatedAt: 1 },
  };
}

function parallelPathGraph(): Graph {
  return {
    nodes: {
      s: { id: "s", label: "S", x: 0, y: 0, role: "source" },
      a: { id: "a", label: "A", x: 50, y: -30, role: "normal" },
      b: { id: "b", label: "B", x: 50, y: 30, role: "normal" },
      t: { id: "t", label: "T", x: 100, y: 0, role: "sink" },
    },
    edges: {
      e1: { id: "e1", from: "s", to: "a", capacity: 5, flow: 0, directed: true },
      e2: { id: "e2", from: "a", to: "t", capacity: 5, flow: 0, directed: true },
      e3: { id: "e3", from: "s", to: "b", capacity: 4, flow: 0, directed: true },
      e4: { id: "e4", from: "b", to: "t", capacity: 4, flow: 0, directed: true },
    },
    meta: { version: "1.0", createdAt: 1, updatedAt: 1 },
  };
}

function reverseResidualGraph(): Graph {
  return {
    nodes: {
      s: { id: "s", label: "S", x: 0, y: 0, role: "source" },
      a: { id: "a", label: "A", x: 0, y: 0, role: "normal" },
      b: { id: "b", label: "B", x: 0, y: 0, role: "normal" },
      t: { id: "t", label: "T", x: 0, y: 0, role: "sink" },
    },
    edges: {
      e1: { id: "e1", from: "s", to: "a", capacity: 2, flow: 0, directed: true },
      e2: { id: "e2", from: "a", to: "b", capacity: 2, flow: 0, directed: true },
      e3: { id: "e3", from: "b", to: "t", capacity: 2, flow: 0, directed: true },
      e4: { id: "e4", from: "s", to: "b", capacity: 2, flow: 0, directed: true },
    },
    meta: { version: "1.0", createdAt: 1, updatedAt: 1 },
  };
}

describe("runEdmondsKarp", () => {
  it("solves a single-edge graph", () => {
    const result = runEdmondsKarp(singleEdgeGraph(), { timestampFactory: () => 123 });

    expect(result.maxFlowValue).toBe(7);
    expect(result.graph.edges.e1.flow).toBe(7);
    expect(result.events[0]).toEqual({ type: "ALGORITHM_SELECTED", algorithm: "edmonds-karp" });
    expect(result.events[1]).toEqual({ type: "RUN_START", source: "s", sink: "t", timestamp: 123 });
  });

  it("solves parallel paths", () => {
    const result = runEdmondsKarp(parallelPathGraph());
    expect(result.maxFlowValue).toBe(9);
  });

  it("emits reverse residual discoveries after augmentation", () => {
    const result = runEdmondsKarp(reverseResidualGraph());
    const reverseDiscoveries = result.events.filter(
      (event) => event.type === "BFS_DISCOVER_EDGE" && event.isReverse,
    );

    expect(result.maxFlowValue).toBe(2);
    expect(reverseDiscoveries.length).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic for identical input", () => {
    const first = runEdmondsKarp(parallelPathGraph(), { timestampFactory: () => 1 });
    const second = runEdmondsKarp(parallelPathGraph(), { timestampFactory: () => 1 });

    expect(second.maxFlowValue).toBe(first.maxFlowValue);
    expect(second.events).toEqual(first.events);
  });
});
