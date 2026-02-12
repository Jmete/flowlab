"use client";

import { create } from "zustand";
import { runEdmondsKarp } from "@/algorithms/maxflow";
import type { MinCutResult } from "@/algorithms/mincut";
import { buildResidualGraph } from "@/algorithms/residual";
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

function resetPlayback(graph: Graph) {
  const initialFlows = Object.fromEntries(Object.values(graph.edges).map((edge) => [edge.id, edge.flow]));
  const initialState = createInitialPlaybackState(initialFlows);
  return {
    events: [] as FlowEvent[],
    playback: initialState,
    playbackCache: buildPlaybackCache([], initialState),
  };
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
  setTool: (tool) => set({ tool }),
  clearSelection: () => set({ selection: {} }),
  selectNode: (nodeId) => set({ selection: { nodeId, edgeId: undefined } }),
  selectEdge: (edgeId) => set({ selection: { edgeId, nodeId: undefined } }),
  setConnectFromNode: (nodeId) => set({ connectFromNodeId: nodeId }),

  addNode: (x, y) =>
    set((state) =>
      applyGraphMutation(state, (graph) => {
        const id = createNodeId(graph);
        graph.nodes[id] = {
          id,
          label: createNodeLabel(graph),
          x,
          y,
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

    const runResult = runEdmondsKarp(runInput);
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
    const state = get();
    if (state.events.length === 0) {
      return;
    }
    stopTimer(state.playbackTimer);

    const nextCursor = Math.min(state.events.length - 1, state.playback.cursor + 1);
    const playback = computePlaybackAtCursor(state.events, state.playbackCache, nextCursor);

    set({ playback, isPlaying: false, playbackTimer: undefined });
  },

  stepBack: () => {
    const state = get();
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
    const state = get();
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
