import amlExample from "@/examples/aml_case_assignment.json";
import defaultEdmondsKarpExample from "@/examples/edmonds_karp_default.json";
import type { Graph } from "@/models/graph";

export const EXAMPLES: Record<string, Graph> = {
  default: defaultEdmondsKarpExample as Graph,
  aml: amlExample as Graph,
};
