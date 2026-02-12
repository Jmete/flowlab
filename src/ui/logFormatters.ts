import type { FlowEvent } from "@/models/events";
import { getMaxFlowAlgorithmById } from "@/models/algorithms";

export function formatFlowEvent(event: FlowEvent): string {
  switch (event.type) {
    case "ALGORITHM_SELECTED":
      return `Algorithm selected: ${getMaxFlowAlgorithmById(event.algorithm).label}`;
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
    case "DINIC_LEVEL_GRAPH_BUILT":
      return `Dinic phase ${event.phase}: level graph built (${event.reachableNodes} reachable nodes)`;
    case "DINIC_BLOCKING_FLOW_END":
      return `Dinic phase ${event.phase}: blocking flow pushed ${event.pushedFlow}`;
    case "PUSH_RELABEL_INIT":
      return `Push-Relabel initialized with ${event.activeNodes} active nodes`;
    case "PUSH_RELABEL_PUSH":
      return `Push ${event.from} -> ${event.to} delta ${event.delta}${event.isReverse ? " (reverse)" : ""}`;
    case "PUSH_RELABEL_RELABEL":
      return `Relabel ${event.node} to height ${event.newHeight}`;
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
