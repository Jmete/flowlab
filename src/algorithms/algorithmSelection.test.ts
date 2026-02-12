import { runMaxFlowAlgorithm } from "@/algorithms/maxflow";
import type { Graph } from "@/models/graph";
import type { MaxFlowAlgorithmId } from "@/models/algorithms";

function comparisonGraph(): Graph {
  return {
    nodes: {
      s: { id: "s", label: "S", x: 0, y: 0, role: "source" },
      a: { id: "a", label: "A", x: 80, y: -40, role: "normal" },
      b: { id: "b", label: "B", x: 80, y: 40, role: "normal" },
      t: { id: "t", label: "T", x: 180, y: 0, role: "sink" },
    },
    edges: {
      e1: { id: "e1", from: "s", to: "a", capacity: 6, flow: 0, directed: true },
      e2: { id: "e2", from: "s", to: "b", capacity: 4, flow: 0, directed: true },
      e3: { id: "e3", from: "a", to: "b", capacity: 2, flow: 0, directed: true },
      e4: { id: "e4", from: "a", to: "t", capacity: 4, flow: 0, directed: true },
      e5: { id: "e5", from: "b", to: "t", capacity: 6, flow: 0, directed: true },
    },
    meta: { version: "1.0", createdAt: 1, updatedAt: 1 },
  };
}

describe("runMaxFlowAlgorithm", () => {
  const algorithms: MaxFlowAlgorithmId[] = ["edmonds-karp", "dinic", "push-relabel"];

  it("computes identical max-flow value across available algorithms", () => {
    const results = algorithms.map((algorithm) => runMaxFlowAlgorithm(algorithm, comparisonGraph(), { timestampFactory: () => 111 }));
    const values = results.map((result) => result.maxFlowValue);
    const cutCapacities = results.map((result) => result.minCut?.cutCapacity);

    expect(values).toEqual([10, 10, 10]);
    expect(cutCapacities).toEqual([10, 10, 10]);
  });

  it("emits algorithm-specific events for process comparison", () => {
    const dinic = runMaxFlowAlgorithm("dinic", comparisonGraph(), { timestampFactory: () => 1 });
    const pushRelabel = runMaxFlowAlgorithm("push-relabel", comparisonGraph(), { timestampFactory: () => 1 });

    expect(dinic.events.some((event) => event.type === "DINIC_LEVEL_GRAPH_BUILT")).toBe(true);
    expect(pushRelabel.events.some((event) => event.type === "PUSH_RELABEL_PUSH")).toBe(true);
    expect(pushRelabel.events.some((event) => event.type === "PUSH_RELABEL_RELABEL")).toBe(true);
  });
});
