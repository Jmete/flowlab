import { buildResidualGraph } from "@/algorithms/residual";
import type { Graph } from "@/models/graph";

function makeGraph(): Graph {
  return {
    nodes: {
      s: { id: "s", label: "S", x: 0, y: 0, role: "source" },
      a: { id: "a", label: "A", x: 0, y: 0, role: "normal" },
      t: { id: "t", label: "T", x: 0, y: 0, role: "sink" },
    },
    edges: {
      e1: { id: "e1", from: "s", to: "a", capacity: 5, flow: 3, directed: true },
      e2: { id: "e2", from: "a", to: "t", capacity: 4, flow: 1, directed: true },
    },
    meta: {
      version: "1.0",
      createdAt: 1,
      updatedAt: 1,
    },
  };
}

describe("residual graph", () => {
  it("builds forward and reverse capacities correctly", () => {
    const residual = buildResidualGraph(makeGraph());

    const byId = Object.fromEntries(residual.edges.map((edge) => [edge.id, edge]));

    expect(byId["a->s:e1:r"].residualCapacity).toBe(3);
    expect(byId["s->a:e1:f"].residualCapacity).toBe(2);
    expect(byId["a->t:e2:f"].residualCapacity).toBe(3);
    expect(byId["t->a:e2:r"].residualCapacity).toBe(1);
  });
});
