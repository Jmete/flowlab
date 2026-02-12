export const maxFlowAlgorithms = [
  {
    id: "edmonds-karp",
    label: "Edmonds-Karp",
    shortLabel: "EK",
    description: "Shortest augmenting path via BFS.",
  },
  {
    id: "dinic",
    label: "Dinic",
    shortLabel: "Dinic",
    description: "Level graph phases with blocking flow.",
  },
  {
    id: "push-relabel",
    label: "Push-Relabel",
    shortLabel: "PR",
    description: "Local push and relabel on excess nodes.",
  },
] as const;

export type MaxFlowAlgorithm = (typeof maxFlowAlgorithms)[number];
export type MaxFlowAlgorithmId = MaxFlowAlgorithm["id"];

export const defaultMaxFlowAlgorithm: MaxFlowAlgorithmId = "edmonds-karp";

export function getMaxFlowAlgorithmById(id: MaxFlowAlgorithmId): MaxFlowAlgorithm {
  return maxFlowAlgorithms.find((algorithm) => algorithm.id === id) ?? maxFlowAlgorithms[0];
}
