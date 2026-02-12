import { createEmptyGraph } from "@/models/graph";
import { decodeGraphFromUrl, encodeGraphForUrl } from "@/lib/shareUrl";

describe("share url utilities", () => {
  it("roundtrips graph payload", () => {
    const graph = createEmptyGraph();
    graph.nodes.s = { id: "s", label: "S", x: 0, y: 0, role: "source" };
    graph.nodes.t = { id: "t", label: "T", x: 50, y: 50, role: "sink" };
    graph.edges.e1 = { id: "e1", from: "s", to: "t", capacity: 9, flow: 3, directed: true };

    const encoded = encodeGraphForUrl(graph);
    const decoded = decodeGraphFromUrl(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.nodes.s.label).toBe("S");
    expect(decoded?.edges.e1.capacity).toBe(9);
  });
});
