import type { FlowEvent } from "@/models/events";

export function formatFlowEvent(event: FlowEvent): string {
  switch (event.type) {
    case "RUN_START":
      return `Run started from ${event.source} to ${event.sink}`;
    case "RESIDUAL_BUILT":
      return `Residual graph built with ${event.residualEdgeCount} edges`;
    case "BFS_START":
      return `BFS iteration ${event.iteration} started`;
    case "BFS_VISIT_NODE":
      return `Visited node ${event.node}`;
    case "BFS_DISCOVER_EDGE":
      return `Discovered ${event.from} -> ${event.to} (res=${event.residualCapacity}${event.isReverse ? ", reverse" : ""})`;
    case "AUGMENTING_PATH_FOUND":
      return `Augmenting path found, bottleneck ${event.bottleneck}`;
    case "AUGMENT_APPLY":
      return `Applied augmentation delta ${event.delta}`;
    case "ITERATION_END":
      return `Iteration ${event.iteration} complete, max flow ${event.currentMaxFlow}`;
    case "NO_MORE_PATHS":
      return `No more augmenting paths after iteration ${event.iteration}`;
    case "MINCUT_COMPUTED":
      return `Min cut computed, cut capacity ${event.cutCapacity}`;
    case "RUN_END":
      return `Run finished with max flow ${event.maxFlow}`;
    case "ERROR":
      return `Error: ${event.message}`;
    default:
      return "Event";
  }
}
