import type { MinCutResult } from "@/algorithms/mincut";
import type { FlowEvent } from "@/models/events";
import type { Graph } from "@/models/graph";

export interface MaxFlowRunOptions {
  maxSteps?: number;
  timestampFactory?: () => number;
}

export interface MaxFlowRunResult {
  maxFlowValue: number;
  graph: Graph;
  events: FlowEvent[];
  minCut?: MinCutResult;
}
