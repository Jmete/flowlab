import { computeMinCut } from "@/algorithms/mincut";
import { runEdmondsKarp } from "@/algorithms/maxflow";
import type { Graph } from "@/models/graph";

function graphForMinCut(): Graph {
  return {
    nodes: {
      s: { id: "s", label: "S", x: 0, y: 0, role: "source" },
      a: { id: "a", label: "A", x: 0, y: 0, role: "normal" },
      b: { id: "b", label: "B", x: 0, y: 0, role: "normal" },
      t: { id: "t", label: "T", x: 0, y: 0, role: "sink" },
    },
    edges: {
      e1: { id: "e1", from: "s", to: "a", capacity: 3, flow: 0, directed: true },
      e2: { id: "e2", from: "s", to: "b", capacity: 2, flow: 0, directed: true },
      e3: { id: "e3", from: "a", to: "t", capacity: 2, flow: 0, directed: true },
      e4: { id: "e4", from: "b", to: "t", capacity: 2, flow: 0, directed: true },
      e5: { id: "e5", from: "a", to: "b", capacity: 1, flow: 0, directed: true },
    },
    meta: { version: "1.0", createdAt: 1, updatedAt: 1 },
  };
}

describe("computeMinCut", () => {
  it("cut capacity equals max flow after run", () => {
    const runResult = runEdmondsKarp(graphForMinCut());
    const cut = computeMinCut(runResult.graph, "s");

    expect(cut.cutCapacity).toBe(runResult.maxFlowValue);
    expect(cut.cutEdges.length).toBeGreaterThan(0);
  });
});
