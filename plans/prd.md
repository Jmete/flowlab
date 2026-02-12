## FlowLab Build Specification

Interactive, in-browser directed flow network editor and max-flow/min-cut visualizer (Edmonds–Karp by default), with step-by-step animation, residual graph view, min-cut highlighting, and export/share.

### 0) Non-goals

- No authentication.
- No multi-user collaboration.
- No external AI/LLM calls.
- No server-side computation required (all algorithms run client-side).
- No handling of extremely large graphs (>500 nodes) beyond graceful degradation.

---

## 1) Product Requirements

### 1.1 Primary User Story

A user can:

1. Create a directed network by placing nodes, dragging them, and connecting edges with capacities.
2. Mark a **Source** and a **Sink** .
3. Run a **Max Flow** algorithm with step-by-step visualization and a step log.
4. Toggle viewing the **Residual Graph** .
5. Compute and highlight the **Min Cut** and show bottleneck edges.
6. Export/import/share the graph via JSON and URL.

### 1.2 Target “Wow” Behaviors

- Edges “fill” as flow increases (thickness/label updates live).
- Augmenting paths highlight sequentially in steps.
- Residual edges appear/disappear dynamically (with reverse edges).
- “Min Cut” highlights a partition and the cut edges that explain the bottleneck.

---

## 2) Tech Constraints (Implementation Guidance)

- Frontend: React + TypeScript (Next.js or Vite acceptable).
- Rendering: Canvas preferred for performance; SVG acceptable if optimized.
- State management: Zustand/Redux Toolkit or equivalent with undo/redo support.
- Algorithms implemented in pure TypeScript with deterministic step event emission.
- All numeric values are integers (capacity, flow) in MVP.

---

## 3) Data Model

### 3.1 Graph Types

```ts
type NodeID = string;
type EdgeID = string;

interface Node {
  id: NodeID;
  label: string; // shown in UI
  x: number; // canvas coordinates
  y: number;
  role: "normal" | "source" | "sink";
}

interface Edge {
  id: EdgeID;
  from: NodeID;
  to: NodeID;
  capacity: number; // integer >= 0
  flow: number; // integer >= 0, <= capacity
  directed: true; // always true for FlowLab
  label?: string; // optional display label
}

interface Graph {
  nodes: Record<NodeID, Node>;
  edges: Record<EdgeID, Edge>;
  meta: {
    version: "1.0";
    createdAt: number;
    updatedAt: number;
  };
}
```

### 3.2 Derived Structures (Do Not Persist)

Residual graph is derived from `Graph` at runtime:

```ts
interface ResidualEdge {
  id: string; // `${from}->${to}` (not EdgeID)
  from: NodeID;
  to: NodeID;
  residualCapacity: number; // > 0
  // mapping back to original edge for UI
  originalEdgeId?: EdgeID; // if forward residual from original edge
  isReverse: boolean; // reverse residual edge
}
```

### 3.3 Validity Rules

- Exactly one node must be `source`, exactly one node must be `sink` to run.
- No self-loop edges (`from !== to`) in MVP (reject on create).
- Multiple edges between same (from,to) allowed, but algorithm must treat them as separate; for UI simplicity, optionally disallow duplicates in MVP.
- Capacity must be integer >= 0.
- If capacity is edited below current flow, set `flow = capacity` (and note in step log as “clamped”).

---

## 4) Core Algorithms

### 4.1 Max Flow: Edmonds–Karp (BFS on residual graph)

Implement Edmonds–Karp on residual graph with step emission.

#### Inputs

- `Graph` with source and sink set.
- Option: `maxSteps?: number` to prevent infinite loops (default 50,000).

#### Output

- `maxFlowValue: number`
- Updated `flow` on original edges in graph
- `events: FlowEvent[]` for visualization playback

### 4.2 Min Cut

After max-flow completes:

1. Run BFS/DFS from source in **residual graph** following edges with `residualCapacity > 0`.
2. The set of reachable nodes = S-side partition. Others = T-side partition.
3. Cut edges are original edges where `from in reachable` and `to not in reachable` and `capacity > 0`.
4. Cut capacity = sum(capacity of cut edges). Should equal max flow.

### 4.3 Residual Graph Construction (from original graph)

For each original edge `e: u->v`:

- Forward residual capacity = `e.capacity - e.flow` if > 0
- Reverse residual capacity = `e.flow` if > 0 (edge v->u, isReverse=true)

When augmenting along a residual edge:

- If residual edge is forward (originalEdgeId exists, isReverse=false): increase `e.flow += delta`
- If residual edge is reverse (isReverse=true): decrease corresponding original edge’s flow `e.flow -= delta`
  - Need mapping: reverse residual edge corresponds to original edge (u->v) where reverse is v->u. Store `originalEdgeId` in residual edge object for reverses too.

---

## 5) Event System for Visualization

### 5.1 Event Type

Events must be deterministic and sufficient for UI to replay without re-running the algorithm.

```ts
type FlowEvent =
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
```

### 5.2 Playback Requirements

UI uses `events[]` for:

- Step forward/back
- Play/pause at adjustable speed
- Jump to iteration boundaries (`BFS_START`, `ITERATION_END`)
- Restore graph display state at any step (see 5.3)

### 5.3 Replay State Model (UI-side)

Maintain a separate “playback state” so the user can edit the base graph without breaking replay.

```ts
interface PlaybackState {
  isRunning: boolean;
  isReplaying: boolean;
  cursor: number; // index into events
  // derived visualization state
  highlightedNodes: Set<NodeID>;
  highlightedEdges: Set<string>; // can include residual edge ids
  lastAugmentingPath?: Array<{ from: NodeID; to: NodeID }>;
  currentMaxFlow: number;
  reachableCut?: Set<NodeID>;
  cutEdges?: Set<EdgeID>;
  // snapshot of flows at current cursor (recommended)
  edgeFlows: Record<EdgeID, number>;
}
```

**Implementation note:** To allow backwards stepping efficiently, build flow snapshots every N events (e.g., every 50) and replay deltas between snapshots.

---

## 6) UI/UX Specification

### 6.1 Layout

Single-page app with:

- Top bar: Mode controls + algorithm controls
- Main canvas: graph editor/visualizer
- Right panel (dockable): properties + step log + results

#### Top Bar Controls

- Mode toggle: `Edit` / `Run`
- Buttons: `Add Node`, `Connect Edge`, `Select/Move`, `Delete`
- Source/Sink selectors: dropdowns or “Set as Source/Sink” in node context menu
- Run controls: `Run Max Flow`, `Reset Flows`, `Show Residual (toggle)`, `Show Min Cut`
- Playback controls (enabled after run): `Step Back`, `Step`, `Play/Pause`, `Speed slider`, `Jump to start/end`

### 6.2 Canvas Interactions

#### Node Creation

- Click `Add Node` then click canvas to place node.
- Auto label: N1, N2, … (editable).
- Drag to reposition; snap-to-grid toggle optional.

#### Edge Creation

- Click `Connect Edge`, then click source node, then click target node.
- On creation, open a small inline editor near edge midpoint:
  - Capacity input (default 1)
  - Confirm/cancel
- Prevent self loops.

#### Selection & Editing

- Clicking node selects it and shows properties in right panel:
  - label, role (normal/source/sink)
- Clicking edge selects it:
  - from, to, capacity, current flow (read-only in edit mode), delete edge

#### Delete

- Delete key removes selected node/edge
- Removing node removes incident edges.

#### Panning/Zooming

- Mouse wheel zoom, click-drag background pan. Keep this minimal but usable.

### 6.3 Visual Encoding

- Nodes:
  - Source: distinct border/icon
  - Sink: distinct border/icon
  - Normal: default
- Edges:
  - Render arrowheads
  - Label: `flow / capacity`
  - Thickness proportional to `flow/capacity` (cap at visible max)
- Highlights:
  - BFS discovered edges: temporary highlight
  - Augmenting path: strong highlight
  - Residual edges (when toggled): dashed style; reverse edges indicated with different dash pattern or arrow tint (no explicit colors required in spec; implementer chooses)
- Min-cut:
  - Partition shading: reachable nodes lightly marked
  - Cut edges highlighted and listed.

### 6.4 Right Panel Tabs

1. **Properties**
   - Selected node/edge editing
2. **Run Log**
   - Human-readable translation of events
3. **Results**
   - Max flow value
   - Cut capacity
   - “Bottleneck edges” table (cut edges sorted by capacity desc)
   - Assignment view (for the AML scenario): show flow routed through intermediate nodes

---

## 7) Prebuilt Example: “AML Case Assignment”

Ship with a “Load Example” dropdown (top bar), including AML example as default.

### 7.1 Example Graph Structure

Nodes:

- S (source)
- Alert buckets: Cards, Wires, Trade
- Analysts: Aisha, Omar, Sara, Hassan
- T (sink)

Edges with capacities:

- S->Cards 12
- S->Wires 7
- S->Trade 5
- Cards->Aisha 5
- Cards->Omar 2
- Wires->Omar 4
- Wires->Sara 3
- Trade->Hassan 4
- Trade->Sara 1
- Aisha->T 6
- Omar->T 5
- Sara->T 4
- Hassan->T 4

**Expected behavior:** Max flow should be <= total analyst capacity (6+5+4+4=19) AND <= incoming total (24), so max flow should be 19 in many feasible routings. Implementation should compute actual. If the computed result differs due to constraints, log it.

---

## 8) Export, Import, Share

### 8.1 JSON Export/Import

- Export current graph (nodes, edges, meta) as JSON file.
- Import JSON validates schema + runs normalization:
  - Ensure unique IDs
  - Clamp invalid capacities to 0 and log warnings
  - If multiple sources/sinks found, set first and demote rest to normal with warning

### 8.2 URL Share

- Encode graph JSON as compressed string in URL fragment: `#g=<payload>`
- Use LZ-based compression (e.g., lz-string). Payload should exclude `meta.updatedAt` to reduce churn.
- On load, if `#g=` exists, decode and load graph.

---

## 9) State Management & Undo/Redo

### 9.1 Actions to Support Undo/Redo

- Add node
- Move node
- Delete node
- Add edge
- Delete edge
- Edit capacity
- Rename node
- Set role (source/sink/normal)
- Reset flows

Implementation:

- Use a command stack (recommended) capturing inverse operations.
- Movement undo can be coalesced (store start/end positions).

---

## 10) Validation & Error Handling

### 10.1 Run Preconditions

Before `Run Max Flow`:

- Must have source and sink and they must differ.
- Must have at least one path candidate (optional quick BFS on original edges with capacity>0).
- Capacities must be integers; parse & clamp. If user enters non-integer, reject with inline error.

### 10.2 Algorithm Safety Limits

- If events exceed `maxSteps`:
  - emit `ERROR` event: “Step limit exceeded”
  - stop run, keep flows as-is
- Prevent negative flows by assertions:
  - if any would go negative, emit `ERROR` and stop (this indicates a bug).

---

## 11) Performance Requirements

- Target smooth interaction up to:
  - 150 nodes, 400 edges (edit mode)
  - Playback at 30 FPS with throttled rendering
- Use requestAnimationFrame for rendering; keep React re-renders minimal.

---

## 12) Testing Requirements

### 12.1 Unit Tests (Algorithms)

- Residual graph creation correctness:
  - forward and reverse capacities
- Edmonds–Karp correctness on known graphs:
  - simple single edge
  - parallel paths
  - graph requiring reverse edges to reach optimal
- Min-cut correctness:
  - cut capacity equals max flow
- Determinism:
  - event sequence stable for same input (ensure BFS neighbor ordering is deterministic by sorting adjacency by node id or edge id)

### 12.2 Integration Tests (UI)

- Create nodes/edges, set source/sink, run max-flow, verify:
  - max flow value displayed
  - edge labels updated
  - stepping changes highlights and flow snapshot
- Import/export roundtrip
- URL share roundtrip

---

## 13) Implementation Notes (Precise)

### 13.1 Deterministic BFS Ordering

When exploring residual graph neighbors:

- Build adjacency lists each iteration.
- Sort outgoing residual edges by `(from, to, originalEdgeId, isReverse)` lexical order.
  This guarantees stable event ordering and stable results.

### 13.2 Mapping Residual Edges to Original

For each residual edge include `originalEdgeId` always:

- If forward residual: `originalEdgeId = e.id`, isReverse=false
- If reverse residual: `originalEdgeId = e.id`, isReverse=true (points to the original forward edge)

### 13.3 Augmenting Path Reconstruction

Store BFS parent pointers keyed by NodeID:

```ts
parent[node] = { prev: NodeID, via: ResidualEdge };
```

When sink reached, reconstruct path by walking parents from sink to source.

### 13.4 Applying Augmentation

For each residual edge in the path:

- If `isReverse=false`: edge.flow += delta
- Else: edge.flow -= delta

Emit a single `AUGMENT_APPLY` event containing all updated edges with their new flows.

---

## 14) Acceptance Criteria Checklist

- [ ] User can create and edit a directed capacity network with source/sink.
- [ ] Running max flow produces correct max flow value on provided test graphs.
- [ ] Visualization shows augmenting paths and flow updates step-by-step.
- [ ] Residual graph toggle shows residual edges consistent with current flows.
- [ ] Min cut highlights partition and cut edges; cut capacity equals max flow.
- [ ] Example AML graph loads and runs successfully.
- [ ] Export/import works; URL share works.
- [ ] Undo/redo covers all edit actions.
- [ ] No external network calls are required for core functionality.

---

## 15) Deliverables

1. `src/algorithms/maxflow.ts` (Edmonds–Karp + event emission)
2. `src/algorithms/mincut.ts`
3. `src/models/graph.ts` (types + validation)
4. `src/state/store.ts` (graph state + undo/redo + playback state)
5. `src/ui/CanvasGraph.tsx` (render + interactions)
6. `src/ui/ControlBar.tsx` (controls)
7. `src/ui/RightPanel.tsx` (tabs)
8. `src/examples/aml_case_assignment.json`
9. Tests: `src/algorithms/*.test.ts`, `src/ui/*.test.ts`

If you want, I can also provide a concrete JSON payload for the AML example (ready to paste into `aml_case_assignment.json`) and a complete event-to-text mapping for the Run Log panel.
