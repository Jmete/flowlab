import type { EdgeID, NodeID } from "@/models/graph";

export type FlowEvent =
  | { type: "RUN_START"; source: NodeID; sink: NodeID; timestamp: number }
  | { type: "RESIDUAL_BUILT"; residualEdgeCount: number }
  | { type: "BFS_START"; iteration: number }
  | { type: "BFS_VISIT_NODE"; node: NodeID }
  | {
      type: "BFS_DISCOVER_EDGE";
      from: NodeID;
      to: NodeID;
      residualCapacity: number;
      isReverse: boolean;
      originalEdgeId?: EdgeID;
    }
  | {
      type: "AUGMENTING_PATH_FOUND";
      path: Array<{
        from: NodeID;
        to: NodeID;
        isReverse: boolean;
        originalEdgeId: EdgeID;
      }>;
      bottleneck: number;
    }
  | {
      type: "AUGMENT_APPLY";
      delta: number;
      updates: Array<{ edgeId: EdgeID; newFlow: number }>;
    }
  | { type: "ITERATION_END"; iteration: number; currentMaxFlow: number }
  | { type: "NO_MORE_PATHS"; iteration: number; maxFlow: number }
  | {
      type: "MINCUT_COMPUTED";
      reachable: NodeID[];
      cutEdges: EdgeID[];
      cutCapacity: number;
    }
  | { type: "RUN_END"; maxFlow: number; timestamp: number }
  | { type: "ERROR"; message: string };
