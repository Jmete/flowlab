"use client";

import { create } from "zustand";
import { runMaxFlowAlgorithm } from "@/algorithms/maxflow";
import type { MinCutResult } from "@/algorithms/mincut";
import { buildResidualGraph } from "@/algorithms/residual";
import { defaultMaxFlowAlgorithm, type MaxFlowAlgorithmId } from "@/models/algorithms";
import { createHistoryStack, pushHistory, redoHistory, undoHistory, type HistoryStack } from "@/state/history";
import {
  buildPlaybackCache,
  computePlaybackAtCursor,
  createInitialPlaybackState,
  type PlaybackCache,
  type PlaybackState,
} from "@/state/playback";
import {
  cloneGraph,
  createEmptyGraph,
  ensureCapacityAndFlow,
  getSourceSinkIds,
  hasPathCandidate,
  touchGraph,
  validateGraphForRun,
  withFlowOverrides,
  type Edge,
  type EdgeID,
  type Graph,
  type Node,
  type NodeID,
} from "@/models/graph";
import type { FlowEvent } from "@/models/events";
import amlExample from "@/examples/aml_case_assignment.json";
import defaultExample from "@/examples/edmonds_karp_default.json";

export type EditorTool = "select" | "add-node" | "connect" | "delete";
export type AppMode = "edit" | "run";

type Selection = { nodeId?: NodeID; edgeId?: EdgeID };

interface FlowLabState {
  graph: Graph;
  history: HistoryStack<Graph>;
  mode: AppMode;
  algorithm: MaxFlowAlgorithmId;
  tool: EditorTool;
  selection: Selection;
  connectFromNodeId?: NodeID;
  showResidual: boolean;
  showMinCut: boolean;
  beginnerMode: boolean;
  events: FlowEvent[];
  playback: PlaybackState;
  playbackCache: PlaybackCache;
  playbackSpeed: number;
  isPlaying: boolean;
  maxFlowValue: number;
  minCut?: MinCutResult;
  warnings: string[];
  error?: string;
  playbackTimer?: number;

  setMode: (mode: AppMode) => void;
  setAlgorithm: (algorithm: MaxFlowAlgorithmId) => void;
  setTool: (tool: EditorTool) => void;
  clearSelection: () => void;
  selectNode: (nodeId?: NodeID) => void;
  selectEdge: (edgeId?: EdgeID) => void;
  setConnectFromNode: (nodeId?: NodeID) => void;

  addNode: (x: number, y: number) => void;
  moveNode: (nodeId: NodeID, x: number, y: number) => void;
  renameNode: (nodeId: NodeID, label: string) => void;
  setNodeRole: (nodeId: NodeID, role: Node["role"]) => void;
  addEdge: (from: NodeID, to: NodeID, capacity: number) => { ok: boolean; message?: string };
  updateEdgeCapacity: (edgeId: EdgeID, capacity: number) => void;
  deleteSelected: () => void;
  deleteNode: (nodeId: NodeID) => void;
  deleteEdge: (edgeId: EdgeID) => void;

  undo: () => void;
  redo: () => void;

  runMaxFlow: () => void;
  resetFlows: () => void;
  computeResidualForView: () => ReturnType<typeof buildResidualGraph>;

  stepForward: () => void;
  stepBack: () => void;
  jumpStart: () => void;
  jumpEnd: () => void;
  play: () => void;
  pause: () => void;
  setPlaybackSpeed: (speed: number) => void;

  setShowResidual: (enabled: boolean) => void;
  setShowMinCut: (enabled: boolean) => void;
  setBeginnerMode: (enabled: boolean) => void;

  loadDefaultExample: () => void;
  loadAmlExample: () => void;
  loadBlankGraph: () => void;
  importGraph: (graph: Graph, warnings?: string[]) => void;
  autoTidyLayout: () => void;
}

function createNodeId(graph: Graph): string {
  let index = Object.keys(graph.nodes).length + 1;
  while (graph.nodes[`n${index}`]) {
    index += 1;
  }
  return `n${index}`;
}

function createNodeLabel(graph: Graph): string {
  let index = Object.keys(graph.nodes).length + 1;
  const labels = new Set(Object.values(graph.nodes).map((node) => node.label));
  while (labels.has(`N${index}`)) {
    index += 1;
  }
  return `N${index}`;
}

function createEdgeId(graph: Graph): string {
  let index = Object.keys(graph.edges).length + 1;
  while (graph.edges[`e${index}`]) {
    index += 1;
  }
  return `e${index}`;
}

function graphSnapshot(graph: Graph): Graph {
  return cloneGraph(graph);
}

function findOpenNodePosition(graph: Graph, x: number, y: number): { x: number; y: number } {
  const minDistance = 115;
  const ringStep = 36;
  const maxAttempts = 40;

  let candidateX = x;
  let candidateY = y;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const hasConflict = Object.values(graph.nodes).some((node) => {
      return Math.hypot(node.x - candidateX, node.y - candidateY) < minDistance;
    });

    if (!hasConflict) {
      return { x: candidateX, y: candidateY };
    }

    const angle = ((attempt * 137.5) / 180) * Math.PI;
    const radius = ringStep * Math.ceil((attempt + 1) / 4);
    candidateX = x + Math.cos(angle) * radius;
    candidateY = y + Math.sin(angle) * radius;
  }

  return { x, y };
}

function computeAutoLayoutPositions(graph: Graph): Record<NodeID, { x: number; y: number }> {
  const nodes = Object.values(graph.nodes);
  if (nodes.length === 0) {
    return {};
  }

  const sortedByX = [...nodes].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
  const sourceId = nodes.find((node) => node.role === "source")?.id ?? sortedByX[0].id;
  const outgoing = new Map<NodeID, NodeID[]>();
  for (const node of nodes) {
    outgoing.set(node.id, []);
  }
  for (const edge of Object.values(graph.edges)) {
    outgoing.get(edge.from)?.push(edge.to);
  }

  // Assign breadth levels from source, then place disconnected nodes by existing x-order.
  const levelByNode = new Map<NodeID, number>();
  const queue: NodeID[] = [sourceId];
  levelByNode.set(sourceId, 0);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const nextLevel = (levelByNode.get(current) ?? 0) + 1;
    for (const target of outgoing.get(current) ?? []) {
      if (levelByNode.has(target)) {
        continue;
      }
      levelByNode.set(target, nextLevel);
      queue.push(target);
    }
  }

  const minX = sortedByX[0].x;
  for (const node of sortedByX) {
    if (levelByNode.has(node.id)) {
      continue;
    }
    const approximateLevel = Math.max(1, Math.round((node.x - minX) / 220));
    levelByNode.set(node.id, approximateLevel);
  }

  const uniqueLevels = [...new Set(levelByNode.values())].sort((a, b) => a - b);
  const compactLevel = new Map<number, number>(uniqueLevels.map((level, index) => [level, index]));
  for (const node of nodes) {
    const current = levelByNode.get(node.id) ?? 0;
    levelByNode.set(node.id, compactLevel.get(current) ?? 0);
  }

  const levelToNodes = new Map<number, Node[]>();
  for (const node of nodes) {
    const level = levelByNode.get(node.id) ?? 0;
    const bucket = levelToNodes.get(level) ?? [];
    bucket.push(node);
    levelToNodes.set(level, bucket);
  }

  const horizontalGap = 240;
  const verticalGap = 125;
  const startX = Math.min(...nodes.map((node) => node.x));
  const centerY = nodes.reduce((total, node) => total + node.y, 0) / nodes.length;
  const positions: Record<NodeID, { x: number; y: number }> = {};

  for (const [level, bucket] of [...levelToNodes.entries()].sort((a, b) => a[0] - b[0])) {
    const orderedBucket = bucket.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
    const startY = centerY - ((orderedBucket.length - 1) * verticalGap) / 2;
    for (let index = 0; index < orderedBucket.length; index += 1) {
      const node = orderedBucket[index];
      positions[node.id] = {
        x: startX + level * horizontalGap,
        y: Math.max(60, startY + index * verticalGap),
      };
    }
  }

  return positions;
}

function resetPlayback(graph: Graph) {
  const initialFlows = Object.fromEntries(Object.values(graph.edges).map((edge) => [edge.id, edge.flow]));
  const initialState = createInitialPlaybackState(initialFlows);
  return {
    events: [] as FlowEvent[],
    playback: initialState,
    playbackCache: buildPlaybackCache([], initialState),
  };
}

function getAlgorithmUsedByEvents(events: FlowEvent[]): MaxFlowAlgorithmId | undefined {
  const algorithmEvent = events.find((event) => event.type === "ALGORITHM_SELECTED");
  if (!algorithmEvent) {
    return undefined;
  }
  return algorithmEvent.algorithm;
}

function applyGraphMutation(state: FlowLabState, mutator: (graph: Graph) => void): Pick<FlowLabState, "graph" | "history" | "events" | "playback" | "playbackCache" | "maxFlowValue" | "minCut" | "error"> {
  const nextGraph = cloneGraph(state.graph);
  mutator(nextGraph);
  touchGraph(nextGraph);

  const history = pushHistory(state.history, graphSnapshot(state.graph));
  const playbackReset = resetPlayback(nextGraph);

  return {
    graph: nextGraph,
    history,
    events: playbackReset.events,
    playback: playbackReset.playback,
    playbackCache: playbackReset.playbackCache,
    maxFlowValue: 0,
    minCut: undefined,
    error: undefined,
  };
}

function stopTimer(timer?: number) {
  if (timer) {
    window.clearInterval(timer);
  }
}

const initialGraph = cloneGraph(defaultExample as Graph);
const initialPlayback = resetPlayback(initialGraph);
const initialPlaybackState = initialPlayback.playback;
const initialPlaybackCache = initialPlayback.playbackCache;

export const useFlowLabStore = create<FlowLabState>((set, get) => ({
  graph: initialGraph,
  history: createHistoryStack<Graph>(),
  mode: "edit",
  algorithm: defaultMaxFlowAlgorithm,
  tool: "select",
  selection: {},
  showResidual: false,
  showMinCut: false,
  beginnerMode: true,
  events: [],
  playback: initialPlaybackState,
  playbackCache: initialPlaybackCache,
  playbackSpeed: 1.25,
  isPlaying: false,
  maxFlowValue: 0,
  warnings: [],

  setMode: (mode) => set({ mode }),
  setAlgorithm: (algorithm) => set({ algorithm }),
  setTool: (tool) => set({ tool }),
  clearSelection: () => set({ selection: {} }),
  selectNode: (nodeId) => set({ selection: { nodeId, edgeId: undefined } }),
  selectEdge: (edgeId) => set({ selection: { edgeId, nodeId: undefined } }),
  setConnectFromNode: (nodeId) => set({ connectFromNodeId: nodeId }),

  addNode: (x, y) =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        const position = findOpenNodePosition(graph, x, y);
        const id = createNodeId(graph);
        graph.nodes[id] = {
          id,
          label: createNodeLabel(graph),
          x: position.x,
          y: position.y,
          role: "normal",
        };
      }),
    ),

  moveNode: (nodeId, x, y) =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        const node = graph.nodes[nodeId];
        if (!node) {
          return;
        }
        node.x = x;
        node.y = y;
      }),
    ),

  renameNode: (nodeId, label) =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        const node = graph.nodes[nodeId];
        if (!node) {
          return;
        }
        node.label = label.trim() || node.label;
      }),
    ),

  setNodeRole: (nodeId, role) =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        const node = graph.nodes[nodeId];
        if (!node) {
          return;
        }
        for (const candidate of Object.values(graph.nodes)) {
          if ((role === "source" && candidate.role === "source") || (role === "sink" && candidate.role === "sink")) {
            candidate.role = "normal";
          }
        }
        node.role = role;
      }),
    ),

  addEdge: (from, to, capacity) => {
    const state = get();
    if (!state.graph.nodes[from] || !state.graph.nodes[to]) {
      return { ok: false, message: "Edge endpoints are invalid." };
    }
    if (from === to) {
      return { ok: false, message: "Self loops are not allowed." };
    }
    const duplicate = Object.values(state.graph.edges).find((edge) => edge.from === from && edge.to === to);
    if (duplicate) {
      return { ok: false, message: "Duplicate edge is not allowed in MVP." };
    }

    const parsedCapacity = Math.max(0, Math.trunc(capacity));

    set((current) =>
      applyGraphMutation(current, (graph) => {
        const edgeId = createEdgeId(graph);
        graph.edges[edgeId] = {
          id: edgeId,
          from,
          to,
          capacity: parsedCapacity,
          flow: 0,
          directed: true,
        };
      }),
    );

    return { ok: true };
  },

  updateEdgeCapacity: (edgeId, capacity) =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        const edge = graph.edges[edgeId];
        if (!edge) {
          return;
        }
        edge.capacity = Math.max(0, Math.trunc(capacity));
        if (edge.flow > edge.capacity) {
          edge.flow = edge.capacity;
        }
      }),
    ),

  deleteSelected: () => {
    const { selection } = get();
    if (selection.nodeId) {
      get().deleteNode(selection.nodeId);
      return;
    }
    if (selection.edgeId) {
      get().deleteEdge(selection.edgeId);
    }
  },

  deleteNode: (nodeId) =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        if (!graph.nodes[nodeId]) {
          return;
        }
        delete graph.nodes[nodeId];
        for (const edge of Object.values(graph.edges)) {
          if (edge.from === nodeId || edge.to === nodeId) {
            delete graph.edges[edge.id];
          }
        }
      }),
    ),

  deleteEdge: (edgeId) =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        delete graph.edges[edgeId];
      }),
    ),

  undo: () =>
    set((state) => {
      const result = undoHistory(state.history, graphSnapshot(state.graph));
      if (!result.present) {
        return {};
      }
      const playbackReset = resetPlayback(result.present);
      return {
        graph: result.present,
        history: result.stack,
        events: playbackReset.events,
        playback: playbackReset.playback,
        playbackCache: playbackReset.playbackCache,
        selection: {},
        error: undefined,
        maxFlowValue: 0,
        minCut: undefined,
      };
    }),

  redo: () =>
    set((state) => {
      const result = redoHistory(state.history, graphSnapshot(state.graph));
      if (!result.present) {
        return {};
      }
      const playbackReset = resetPlayback(result.present);
      return {
        graph: result.present,
        history: result.stack,
        events: playbackReset.events,
        playback: playbackReset.playback,
        playbackCache: playbackReset.playbackCache,
        selection: {},
        error: undefined,
        maxFlowValue: 0,
        minCut: undefined,
      };
    }),

  runMaxFlow: () => {
    const state = get();
    stopTimer(state.playbackTimer);

    const validation = validateGraphForRun(state.graph);
    if (!validation.ok) {
      set({ error: validation.errors.join(" ") });
      return;
    }

    const { sourceId, sinkId } = getSourceSinkIds(state.graph);
    if (!sourceId || !sinkId) {
      set({ error: "Source and sink are required." });
      return;
    }

    if (!hasPathCandidate(state.graph, sourceId, sinkId)) {
      set({ error: "No path with positive capacities exists from source to sink." });
      return;
    }

    // Always run from a zero-flow baseline so first run animates from empty flow.
    const runInput = cloneGraph(state.graph);
    for (const edge of Object.values(runInput.edges)) {
      edge.flow = 0;
    }
    const initialFlows = Object.fromEntries(Object.values(runInput.edges).map((edge) => [edge.id, edge.flow]));

    const runResult = runMaxFlowAlgorithm(state.algorithm, runInput);
    const playbackState = createInitialPlaybackState(initialFlows);
    const playbackCache = buildPlaybackCache(runResult.events, playbackState);

    set({
      graph: runInput,
      events: runResult.events,
      playback: { ...playbackState, cursor: -1 },
      playbackCache,
      maxFlowValue: runResult.maxFlowValue,
      minCut: runResult.minCut,
      error: runResult.events.find((event) => event.type === "ERROR")?.message,
      mode: "run",
      isPlaying: false,
      playbackTimer: undefined,
      showMinCut: true,
    });
  },

  resetFlows: () =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        for (const edge of Object.values(graph.edges)) {
          edge.flow = 0;
        }
      }),
    ),

  computeResidualForView: () => {
    const state = get();
    const graphWithPlaybackFlows = withFlowOverrides(state.graph, state.playback.edgeFlows);
    return buildResidualGraph(graphWithPlaybackFlows);
  },

  stepForward: () => {
    let state = get();
    const algorithmFromEvents = getAlgorithmUsedByEvents(state.events);
    if (state.events.length === 0 || algorithmFromEvents !== state.algorithm) {
      get().runMaxFlow();
      state = get();
    }

    if (state.events.length === 0) {
      return;
    }
    stopTimer(state.playbackTimer);

    const nextCursor = Math.min(state.events.length - 1, state.playback.cursor + 1);
    const playback = computePlaybackAtCursor(state.events, state.playbackCache, nextCursor);

    set({ playback, isPlaying: false, playbackTimer: undefined });
  },

  stepBack: () => {
    let state = get();
    const algorithmFromEvents = getAlgorithmUsedByEvents(state.events);
    if (state.events.length === 0 || algorithmFromEvents !== state.algorithm) {
      get().runMaxFlow();
      state = get();
    }

    if (state.events.length === 0) {
      return;
    }
    stopTimer(state.playbackTimer);

    const nextCursor = Math.max(-1, state.playback.cursor - 1);
    const playback = computePlaybackAtCursor(state.events, state.playbackCache, nextCursor);

    set({ playback, isPlaying: false, playbackTimer: undefined });
  },

  jumpStart: () => {
    const state = get();
    stopTimer(state.playbackTimer);
    const playback = computePlaybackAtCursor(state.events, state.playbackCache, -1);
    set({ playback, isPlaying: false, playbackTimer: undefined });
  },

  jumpEnd: () => {
    const state = get();
    if (state.events.length === 0) {
      return;
    }
    stopTimer(state.playbackTimer);
    const playback = computePlaybackAtCursor(state.events, state.playbackCache, state.events.length - 1);
    set({ playback, isPlaying: false, playbackTimer: undefined });
  },

  play: () => {
    let state = get();
    const algorithmFromEvents = getAlgorithmUsedByEvents(state.events);
    if (state.events.length === 0 || algorithmFromEvents !== state.algorithm) {
      get().runMaxFlow();
      state = get();
    }

    if (state.events.length === 0 || state.isPlaying) {
      return;
    }
    stopTimer(state.playbackTimer);

    // If already at the end, restart from the beginning before autoplay.
    if (state.playback.cursor >= state.events.length - 1) {
      const restart = computePlaybackAtCursor(state.events, state.playbackCache, -1);
      set({ playback: restart });
    }

    const delay = Math.max(45, Math.trunc(220 / Math.max(0.25, state.playbackSpeed)));
    const timer = window.setInterval(() => {
      set((current) => {
        if (current.playback.cursor >= current.events.length - 1) {
          stopTimer(current.playbackTimer);
          return { isPlaying: false, playbackTimer: undefined };
        }

        const nextCursor = Math.min(current.events.length - 1, current.playback.cursor + 1);
        const playback = computePlaybackAtCursor(current.events, current.playbackCache, nextCursor);
        return { playback };
      });
    }, delay);

    set({ isPlaying: true, playbackTimer: timer });
  },

  pause: () => {
    const state = get();
    stopTimer(state.playbackTimer);
    set({ isPlaying: false, playbackTimer: undefined });
  },

  setPlaybackSpeed: (speed) => {
    const clamped = Math.min(3, Math.max(0.25, speed));
    const wasPlaying = get().isPlaying;
    set({ playbackSpeed: clamped });
    if (wasPlaying) {
      get().pause();
      get().play();
    }
  },

  setShowResidual: (enabled) => set({ showResidual: enabled }),
  setShowMinCut: (enabled) => set({ showMinCut: enabled }),
  setBeginnerMode: (enabled) => set({ beginnerMode: enabled }),

  loadDefaultExample: () => {
    const graph = defaultExample as Graph;
    const cloned = cloneGraph(graph);
    const playbackReset = resetPlayback(cloned);
    set({
      graph: cloned,
      history: createHistoryStack(),
      events: playbackReset.events,
      playback: playbackReset.playback,
      playbackCache: playbackReset.playbackCache,
      maxFlowValue: 0,
      minCut: undefined,
      selection: {},
      mode: "edit",
      error: undefined,
      warnings: [],
    });
  },

  loadAmlExample: () => {
    const graph = amlExample as Graph;
    const cloned = cloneGraph(graph);
    const playbackReset = resetPlayback(cloned);
    set({
      graph: cloned,
      history: createHistoryStack(),
      events: playbackReset.events,
      playback: playbackReset.playback,
      playbackCache: playbackReset.playbackCache,
      maxFlowValue: 0,
      minCut: undefined,
      selection: {},
      mode: "edit",
      error: undefined,
      warnings: [],
    });
  },

  loadBlankGraph: () => {
    const graph = createEmptyGraph();
    const playbackReset = resetPlayback(graph);
    set({
      graph,
      history: createHistoryStack(),
      events: playbackReset.events,
      playback: playbackReset.playback,
      playbackCache: playbackReset.playbackCache,
      maxFlowValue: 0,
      minCut: undefined,
      selection: {},
      mode: "edit",
      error: undefined,
      warnings: [],
    });
  },

  importGraph: (graph, warnings = []) => {
    const cloned = cloneGraph(graph);
    const playbackReset = resetPlayback(cloned);
    set({
      graph: cloned,
      history: createHistoryStack(),
      events: playbackReset.events,
      playback: playbackReset.playback,
      playbackCache: playbackReset.playbackCache,
      maxFlowValue: 0,
      minCut: undefined,
      selection: {},
      mode: "edit",
      error: undefined,
      warnings,
    });
  },

  autoTidyLayout: () =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        const nextPositions = computeAutoLayoutPositions(graph);
        for (const node of Object.values(graph.nodes)) {
          const next = nextPositions[node.id];
          if (!next) {
            continue;
          }
          node.x = Math.round(next.x);
          node.y = Math.round(next.y);
        }
      }),
    ),
}));

export function getSelectedNode(state: FlowLabState): Node | undefined {
  if (!state.selection.nodeId) {
    return undefined;
  }
  return state.graph.nodes[state.selection.nodeId];
}

export function getSelectedEdge(state: FlowLabState): Edge | undefined {
  if (!state.selection.edgeId) {
    return undefined;
  }
  return state.graph.edges[state.selection.edgeId];
}

export function getGraphForDisplay(state: FlowLabState): Graph {
  return withFlowOverrides(state.graph, state.playback.edgeFlows);
}

export function getEdgesWithFlow(graph: Graph): Edge[] {
  return Object.values(graph.edges)
    .filter((edge) => edge.flow > 0)
    .sort((a, b) => b.flow - a.flow || a.id.localeCompare(b.id));
}

export function sanitizeImportedGraph(graph: Graph): Graph {
  const cloned = cloneGraph(graph);
  for (const edge of Object.values(cloned.edges)) {
    const { edge: normalized } = ensureCapacityAndFlow(edge);
    cloned.edges[edge.id] = normalized;
  }
  return cloned;
}
