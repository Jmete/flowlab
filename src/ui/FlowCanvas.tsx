"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Background,
  ConnectionLineType,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type NodeChange,
  type Edge as RFEdge,
  type Node as RFNode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildResidualGraph } from "@/algorithms/residual";
import { cn } from "@/lib/utils";
import { withFlowOverrides, type EdgeID, type NodeID } from "@/models/graph";
import { useFlowLabStore } from "@/state/store";

type MenuState =
  | {
      kind: "pane";
      x: number;
      y: number;
      canvasX: number;
      canvasY: number;
    }
  | {
      kind: "node";
      x: number;
      y: number;
      nodeId: NodeID;
    }
  | {
      kind: "edge";
      x: number;
      y: number;
      edgeId: EdgeID;
    };

function parseEdgeCapacity(defaultCapacity = 1): number | null {
  const raw = window.prompt("Edge capacity (integer >= 0)", String(defaultCapacity));
  if (raw === null) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    window.alert("Capacity must be an integer >= 0.");
    return null;
  }

  return parsed;
}

function FlowCanvasInner() {
  const {
    graph,
    tool,
    mode,
    selection,
    playback,
    showResidual,
    showMinCut,
    isPlaying,
    connectFromNodeId,
    addNode,
    addEdge,
    moveNode,
    renameNode,
    selectNode,
    selectEdge,
    clearSelection,
    setConnectFromNode,
    deleteNode,
    deleteEdge,
    updateEdgeCapacity,
    setNodeRole,
    setTool,
    autoTidyLayout,
  } = useFlowLabStore(
    useShallow((state) => ({
      graph: state.graph,
      tool: state.tool,
      mode: state.mode,
      selection: state.selection,
      playback: state.playback,
      showResidual: state.showResidual,
      showMinCut: state.showMinCut,
      isPlaying: state.isPlaying,
      connectFromNodeId: state.connectFromNodeId,
      addNode: state.addNode,
      addEdge: state.addEdge,
      moveNode: state.moveNode,
      renameNode: state.renameNode,
      selectNode: state.selectNode,
      selectEdge: state.selectEdge,
      clearSelection: state.clearSelection,
      setConnectFromNode: state.setConnectFromNode,
      deleteNode: state.deleteNode,
      deleteEdge: state.deleteEdge,
      updateEdgeCapacity: state.updateEdgeCapacity,
      setNodeRole: state.setNodeRole,
      setTool: state.setTool,
      autoTidyLayout: state.autoTidyLayout,
    })),
  );

  const { screenToFlowPosition, fitView } = useReactFlow();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [menu, setMenu] = React.useState<MenuState | null>(null);
  const isDraggingRef = React.useRef(false);

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<RFNode>([]);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<RFEdge>([]);

  const graphForDisplay = React.useMemo(() => withFlowOverrides(graph, playback.edgeFlows), [graph, playback.edgeFlows]);
  const residual = React.useMemo(() => {
    return showResidual ? buildResidualGraph(graphForDisplay) : { edges: [], outgoing: {} };
  }, [graphForDisplay, showResidual]);

  const renderNodes: RFNode[] = React.useMemo(() => {
    return Object.values(graphForDisplay.nodes).map((node) => {
      const isSource = node.role === "source";
      const isSink = node.role === "sink";
      const isSelected = selection.nodeId === node.id;
      const isHighlighted = playback.highlightedNodes.has(node.id);
      const isCutReachable = showMinCut && playback.reachableCut?.has(node.id);
      const isConnectStart = connectFromNodeId === node.id;

      return {
        id: node.id,
        position: { x: node.x, y: node.y },
        data: { label: node.label },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        draggable: mode === "edit",
        selectable: true,
        style: {
          border: isSource
            ? "2px solid hsl(var(--node-source))"
            : isSink
              ? "2px solid hsl(var(--node-sink))"
              : isConnectStart
                ? "2px solid hsl(var(--node-connect))"
                : "1px solid hsl(var(--border))",
          background: isCutReachable ? "hsl(var(--primary) / 0.14)" : "hsl(var(--card) / 0.95)",
          borderRadius: "8px",
          padding: "10px 14px",
          minWidth: 96,
          color: "hsl(var(--card-foreground))",
          boxShadow: isSelected
            ? "0 0 0 2px hsl(var(--primary) / 0.62)"
            : isHighlighted
              ? "0 0 0 2px hsl(var(--edge-highlight) / 0.75)"
              : "none",
          fontWeight: isSource || isSink ? 700 : 600,
          letterSpacing: "0.02em",
        },
      };
    });
  }, [connectFromNodeId, graphForDisplay.nodes, mode, playback.highlightedNodes, playback.reachableCut, selection.nodeId, showMinCut]);

  const renderEdges: RFEdge[] = React.useMemo(() => {
    const baseEdges = Object.values(graphForDisplay.edges).map((edge) => {
      const ratio = edge.capacity <= 0 ? 0 : edge.flow / edge.capacity;
      const width = Math.max(2, 2 + ratio * 5);
      const isHighlighted = playback.highlightedEdges.has(edge.id);
      const isCutEdge = showMinCut && playback.cutEdges?.has(edge.id);

      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: `${edge.flow} / ${edge.capacity}`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCutEdge ? "hsl(var(--edge-cut))" : isHighlighted ? "hsl(var(--edge-highlight))" : "hsl(var(--edge-base))",
        },
        style: {
          strokeWidth: width,
          stroke: isCutEdge ? "hsl(var(--edge-cut))" : isHighlighted ? "hsl(var(--edge-highlight))" : "hsl(var(--edge-base))",
        },
        interactionWidth: 22,
        animated: isHighlighted && isPlaying,
        type: "smoothstep",
        pathOptions: {
          offset: 26,
          borderRadius: 14,
        },
      } as RFEdge;
    });

    if (!showResidual) {
      return baseEdges;
    }

    const residualEdges: RFEdge[] = residual.edges.map((edge) => ({
      id: `res:${edge.id}`,
      source: edge.from,
      target: edge.to,
      label: `r=${edge.residualCapacity}`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.isReverse ? "hsl(var(--accent))" : "hsl(var(--primary))",
      },
      style: {
        strokeWidth: 1.6,
        strokeDasharray: edge.isReverse ? "6 5" : "4 4",
        stroke: edge.isReverse ? "hsl(var(--accent))" : "hsl(var(--primary))",
      },
      type: "smoothstep",
      pathOptions: {
        offset: 26,
        borderRadius: 14,
      },
      animated: isPlaying,
    }));

    return [...baseEdges, ...residualEdges];
  }, [graphForDisplay.edges, isPlaying, playback.cutEdges, playback.highlightedEdges, residual.edges, showMinCut, showResidual]);

  React.useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }
    setRfNodes(renderNodes);
    setRfEdges(renderEdges);
  }, [renderEdges, renderNodes, setRfEdges, setRfNodes]);

  const onPaneClick = React.useCallback(
    (event: React.MouseEvent) => {
      setMenu(null);
      if (tool !== "add-node" || mode !== "edit") {
        clearSelection();
        return;
      }
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(point.x - 32, point.y - 16);
    },
    [addNode, clearSelection, mode, screenToFlowPosition, tool],
  );

  const completeEdgeCreation = React.useCallback(
    (targetNodeId: NodeID) => {
      if (!connectFromNodeId || connectFromNodeId === targetNodeId) {
        return;
      }
      const capacity = parseEdgeCapacity(1);
      if (capacity === null) {
        setConnectFromNode(undefined);
        return;
      }
      const result = addEdge(connectFromNodeId, targetNodeId, capacity);
      if (!result.ok) {
        window.alert(result.message ?? "Failed to add edge.");
      }
      setConnectFromNode(undefined);
    },
    [addEdge, connectFromNodeId, setConnectFromNode],
  );

  const onNodeClick = React.useCallback(
    (_event: React.MouseEvent, node: RFNode) => {
      setMenu(null);
      if (mode !== "edit") {
        selectNode(node.id as NodeID);
        return;
      }

      if (tool === "delete") {
        deleteNode(node.id as NodeID);
        return;
      }

      if (tool === "connect") {
        if (!connectFromNodeId) {
          setConnectFromNode(node.id as NodeID);
          selectNode(node.id as NodeID);
          return;
        }

        if (connectFromNodeId === node.id) {
          setConnectFromNode(undefined);
          return;
        }

        completeEdgeCreation(node.id as NodeID);
        return;
      }

      selectNode(node.id as NodeID);
    },
    [completeEdgeCreation, connectFromNodeId, deleteNode, mode, selectNode, setConnectFromNode, tool],
  );

  const editNodeLabel = React.useCallback(
    (nodeId: NodeID) => {
      if (mode !== "edit") {
        return;
      }
      const current = graph.nodes[nodeId];
      if (!current) {
        return;
      }
      const nextLabel = window.prompt("Node label", current.label);
      if (nextLabel === null) {
        return;
      }
      renameNode(nodeId, nextLabel);
    },
    [graph.nodes, mode, renameNode],
  );

  const onEdgeClick = React.useCallback(
    (_event: React.MouseEvent, edge: RFEdge) => {
      setMenu(null);
      if (edge.id.startsWith("res:")) {
        return;
      }
      if (mode === "edit" && tool === "delete") {
        deleteEdge(edge.id as EdgeID);
        return;
      }
      selectEdge(edge.id as EdgeID);
    },
    [deleteEdge, mode, selectEdge, tool],
  );

  const editEdgeCapacity = React.useCallback(
    (edgeId: EdgeID) => {
      if (mode !== "edit") {
        return;
      }
      const current = graph.edges[edgeId];
      if (!current) {
        return;
      }
      const nextCapacity = parseEdgeCapacity(current.capacity);
      if (nextCapacity === null) {
        return;
      }
      updateEdgeCapacity(edgeId, nextCapacity);
    },
    [graph.edges, mode, updateEdgeCapacity],
  );

  const onEdgeDoubleClick = React.useCallback(
    (_event: React.MouseEvent, edge: RFEdge) => {
      if (edge.id.startsWith("res:")) {
        return;
      }
      editEdgeCapacity(edge.id as EdgeID);
    },
    [editEdgeCapacity],
  );

  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (mode !== "edit") {
        return;
      }
      const source = connection.source as NodeID | null;
      const target = connection.target as NodeID | null;
      if (!source || !target) {
        return;
      }
      const capacity = parseEdgeCapacity(1);
      if (capacity === null) {
        return;
      }
      const result = addEdge(source, target, capacity);
      if (!result.ok) {
        window.alert(result.message ?? "Failed to add edge.");
      }
    },
    [addEdge, mode],
  );

  const onPaneContextMenu = React.useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      if (mode !== "edit") {
        return;
      }
      event.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      const localX = rect ? event.clientX - rect.left : event.clientX;
      const localY = rect ? event.clientY - rect.top : event.clientY;
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setMenu({
        kind: "pane",
        x: localX,
        y: localY,
        canvasX: flowPosition.x,
        canvasY: flowPosition.y,
      });
    },
    [mode, screenToFlowPosition],
  );

  const onNodeContextMenu = React.useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      if (mode !== "edit") {
        return;
      }
      event.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      const localX = rect ? event.clientX - rect.left : event.clientX;
      const localY = rect ? event.clientY - rect.top : event.clientY;
      selectNode(node.id as NodeID);
      setMenu({ kind: "node", x: localX, y: localY, nodeId: node.id as NodeID });
    },
    [mode, selectNode],
  );

  const onEdgeContextMenu = React.useCallback(
    (event: React.MouseEvent, edge: RFEdge) => {
      if (mode !== "edit" || edge.id.startsWith("res:")) {
        return;
      }
      event.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      const localX = rect ? event.clientX - rect.left : event.clientX;
      const localY = rect ? event.clientY - rect.top : event.clientY;
      selectEdge(edge.id as EdgeID);
      setMenu({ kind: "edge", x: localX, y: localY, edgeId: edge.id as EdgeID });
    },
    [mode, selectEdge],
  );

  const onNodeDragStop = React.useCallback(
    (_event: React.MouseEvent, node: RFNode) => {
      isDraggingRef.current = false;
      if (mode !== "edit") {
        return;
      }
      moveNode(node.id as NodeID, node.position.x, node.position.y);
    },
    [mode, moveNode],
  );

  const handleNodesChange = React.useCallback(
    (changes: NodeChange<RFNode>[]) => {
      for (const change of changes) {
        if (change.type === "position") {
          if (change.dragging === true) {
            isDraggingRef.current = true;
          }
          if (change.dragging === false) {
            isDraggingRef.current = false;
          }
        }
      }
      onRfNodesChange(changes);
    },
    [onRfNodesChange],
  );

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (mode !== "edit") {
        return;
      }
      if (event.key === "Escape") {
        setMenu(null);
        setConnectFromNode(undefined);
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const tag = (event.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
          return;
        }
        if (selection.nodeId) {
          deleteNode(selection.nodeId);
        } else if (selection.edgeId) {
          deleteEdge(selection.edgeId);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteEdge, deleteNode, mode, selection.edgeId, selection.nodeId, setConnectFromNode]);

  React.useEffect(() => {
    const closeMenu = () => setMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  return (
    <div ref={containerRef} className={cn("panel-shell relative h-full w-full overflow-hidden rounded-md border")}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        fitView
        fitViewOptions={{ padding: 0.14, duration: 220 }}
        onNodesChange={handleNodesChange}
        onEdgesChange={onRfEdgesChange}
        onlyRenderVisibleElements
        minZoom={0.25}
        maxZoom={2.5}
        zoomOnDoubleClick={false}
        nodesDraggable={mode === "edit"}
        nodesConnectable={mode === "edit"}
        elementsSelectable
        selectionOnDrag={tool === "select"}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeDragStop={onNodeDragStop}
        connectionLineType={ConnectionLineType.SmoothStep}
        panOnDrag={tool === "select"}
        zoomOnScroll
        zoomOnPinch
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="hsl(var(--grid-line))" />
        <Controls />
      </ReactFlow>

      {connectFromNodeId ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-sm border border-primary/40 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.09em] text-foreground">
          Select a target node to connect from {graph.nodes[connectFromNodeId]?.label ?? connectFromNodeId}
        </div>
      ) : null}

      {menu ? (
        <div
          className="panel-shell absolute z-20 min-w-[206px] rounded-sm border p-1.5 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {menu.kind === "pane" ? (
            <>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                onClick={() => {
                  addNode(menu.canvasX - 32, menu.canvasY - 16);
                  setMenu(null);
                }}
              >
                Add node here
              </button>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                onClick={() => {
                  autoTidyLayout();
                  setMenu(null);
                }}
              >
                Auto tidy layout
              </button>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                onClick={() => {
                  fitView({ duration: 180, padding: 0.18 });
                  setMenu(null);
                }}
              >
                Fit graph to view
              </button>
            </>
          ) : null}

          {menu.kind === "node" ? (
            <>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                onClick={() => {
                  editNodeLabel(menu.nodeId);
                  setMenu(null);
                }}
              >
                Edit label
              </button>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                onClick={() => {
                  setTool("connect");
                  setConnectFromNode(menu.nodeId);
                  setMenu(null);
                }}
              >
                Start edge from node
              </button>
              {connectFromNodeId && connectFromNodeId !== menu.nodeId ? (
                <button
                  type="button"
                  className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                  onClick={() => {
                    completeEdgeCreation(menu.nodeId);
                    setMenu(null);
                  }}
                >
                  Connect from selected start
                </button>
              ) : null}
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                onClick={() => {
                  setNodeRole(menu.nodeId, "source");
                  setMenu(null);
                }}
              >
                Set as source
              </button>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                onClick={() => {
                  setNodeRole(menu.nodeId, "sink");
                  setMenu(null);
                }}
              >
                Set as sink
              </button>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-destructive hover:bg-destructive/12"
                onClick={() => {
                  deleteNode(menu.nodeId);
                  setMenu(null);
                }}
              >
                Delete node
              </button>
            </>
          ) : null}

          {menu.kind === "edge" ? (
            <>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                onClick={() => {
                  editEdgeCapacity(menu.edgeId);
                  setMenu(null);
                }}
              >
                Edit capacity
              </button>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-destructive hover:bg-destructive/12"
                onClick={() => {
                  deleteEdge(menu.edgeId);
                  setMenu(null);
                }}
              >
                Delete edge
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
