import type { FlowEvent } from "@/models/events";
import type { EdgeID, NodeID } from "@/models/graph";

export interface PlaybackState {
  isRunning: boolean;
  isReplaying: boolean;
  cursor: number;
  highlightedNodes: Set<NodeID>;
  highlightedEdges: Set<string>;
  lastAugmentingPath?: Array<{ from: NodeID; to: NodeID }>;
  currentMaxFlow: number;
  reachableCut?: Set<NodeID>;
  cutEdges?: Set<EdgeID>;
  edgeFlows: Record<EdgeID, number>;
  error?: string;
}

export interface PlaybackSnapshot {
  cursor: number;
  state: PlaybackState;
}

export interface PlaybackCache {
  snapshots: Map<number, PlaybackState>;
  interval: number;
}

function clonePlaybackState(state: PlaybackState): PlaybackState {
  return {
    ...state,
    highlightedNodes: new Set(state.highlightedNodes),
    highlightedEdges: new Set(state.highlightedEdges),
    lastAugmentingPath: state.lastAugmentingPath ? [...state.lastAugmentingPath] : undefined,
    reachableCut: state.reachableCut ? new Set(state.reachableCut) : undefined,
    cutEdges: state.cutEdges ? new Set(state.cutEdges) : undefined,
    edgeFlows: { ...state.edgeFlows },
  };
}

export function createInitialPlaybackState(initialFlows: Record<EdgeID, number>): PlaybackState {
  return {
    isRunning: false,
    isReplaying: false,
    cursor: -1,
    highlightedNodes: new Set(),
    highlightedEdges: new Set(),
    currentMaxFlow: 0,
    edgeFlows: { ...initialFlows },
  };
}

export function applyFlowEvent(state: PlaybackState, event: FlowEvent): PlaybackState {
  const next = clonePlaybackState(state);

  switch (event.type) {
    case "RUN_START": {
      next.isRunning = true;
      next.error = undefined;
      next.highlightedNodes.clear();
      next.highlightedEdges.clear();
      break;
    }
    case "BFS_START": {
      next.highlightedNodes.clear();
      next.highlightedEdges.clear();
      break;
    }
    case "BFS_VISIT_NODE": {
      next.highlightedNodes.add(event.node);
      break;
    }
    case "BFS_DISCOVER_EDGE": {
      if (event.originalEdgeId) {
        next.highlightedEdges.add(event.originalEdgeId);
      }
      break;
    }
    case "AUGMENTING_PATH_FOUND": {
      next.lastAugmentingPath = event.path.map((segment) => ({ from: segment.from, to: segment.to }));
      next.highlightedEdges = new Set(event.path.map((segment) => segment.originalEdgeId));
      break;
    }
    case "AUGMENT_APPLY": {
      for (const update of event.updates) {
        next.edgeFlows[update.edgeId] = update.newFlow;
      }
      break;
    }
    case "ITERATION_END": {
      next.currentMaxFlow = event.currentMaxFlow;
      break;
    }
    case "NO_MORE_PATHS": {
      next.currentMaxFlow = event.maxFlow;
      break;
    }
    case "MINCUT_COMPUTED": {
      next.reachableCut = new Set(event.reachable);
      next.cutEdges = new Set(event.cutEdges);
      break;
    }
    case "RUN_END": {
      next.isRunning = false;
      break;
    }
    case "ERROR": {
      next.isRunning = false;
      next.error = event.message;
      break;
    }
    case "RESIDUAL_BUILT": {
      break;
    }
    default: {
      break;
    }
  }

  return next;
}

export function buildPlaybackCache(
  events: FlowEvent[],
  initialState: PlaybackState,
  interval = 50,
): PlaybackCache {
  const snapshots = new Map<number, PlaybackState>();
  snapshots.set(-1, clonePlaybackState(initialState));

  let state = clonePlaybackState(initialState);
  for (let index = 0; index < events.length; index += 1) {
    state = applyFlowEvent(state, events[index]);
    if ((index + 1) % interval === 0) {
      snapshots.set(index, clonePlaybackState(state));
    }
  }

  return {
    snapshots,
    interval,
  };
}

export function computePlaybackAtCursor(
  events: FlowEvent[],
  cache: PlaybackCache,
  cursor: number,
): PlaybackState {
  if (cursor < 0) {
    return clonePlaybackState(cache.snapshots.get(-1)!);
  }

  let startCursor = -1;
  for (const key of cache.snapshots.keys()) {
    if (key <= cursor && key > startCursor) {
      startCursor = key;
    }
  }

  let state = clonePlaybackState(cache.snapshots.get(startCursor)!);
  for (let index = startCursor + 1; index <= cursor; index += 1) {
    state = applyFlowEvent(state, events[index]);
  }

  state.cursor = cursor;
  state.isReplaying = true;
  return state;
}
