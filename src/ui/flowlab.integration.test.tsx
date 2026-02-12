import { createEmptyGraph } from "@/models/graph";
import { exportGraphToJson, parseImportedGraph } from "@/lib/importExport";
import { useFlowLabStore } from "@/state/store";

describe("flowlab store integration", () => {
  beforeEach(() => {
    useFlowLabStore.getState().importGraph(createEmptyGraph());
  });

  it("creates nodes/edges, runs max-flow, and supports playback stepping", () => {
    const store = useFlowLabStore.getState();

    store.addNode(10, 10);
    store.addNode(300, 100);

    const stateAfterNodes = useFlowLabStore.getState();
    const nodeIds = Object.keys(stateAfterNodes.graph.nodes).sort();

    expect(nodeIds).toEqual(["n1", "n2"]);

    store.setNodeRole("n1", "source");
    store.setNodeRole("n2", "sink");
    const addEdgeResult = store.addEdge("n1", "n2", 5);

    expect(addEdgeResult.ok).toBe(true);

    store.runMaxFlow();

    const afterRun = useFlowLabStore.getState();
    expect(afterRun.maxFlowValue).toBe(5);
    expect(afterRun.events.length).toBeGreaterThan(0);

    store.stepForward();
    expect(useFlowLabStore.getState().playback.cursor).toBe(0);

    store.stepBack();
    expect(useFlowLabStore.getState().playback.cursor).toBe(-1);
  });

  it("runs selected algorithm and records selector choice in events", () => {
    const store = useFlowLabStore.getState();

    store.addNode(10, 10);
    store.addNode(300, 100);
    store.setNodeRole("n1", "source");
    store.setNodeRole("n2", "sink");
    store.addEdge("n1", "n2", 5);
    store.setAlgorithm("dinic");
    store.runMaxFlow();

    const afterRun = useFlowLabStore.getState();
    expect(afterRun.maxFlowValue).toBe(5);
    expect(afterRun.events[0]).toEqual({ type: "ALGORITHM_SELECTED", algorithm: "dinic" });
  });

  it("supports import/export roundtrip", () => {
    const store = useFlowLabStore.getState();
    store.loadAmlExample();

    const json = exportGraphToJson(useFlowLabStore.getState().graph);
    const parsed = parseImportedGraph(json);

    expect(Object.keys(parsed.graph.nodes).length).toBeGreaterThan(0);
    expect(Object.keys(parsed.graph.edges).length).toBeGreaterThan(0);
  });
});
