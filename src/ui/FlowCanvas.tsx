"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Background,
  ConnectionLineType,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
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
    selectNode,
    selectEdge,
    clearSelection,
    setConnectFromNode,
    deleteNode,
    deleteEdge,
    setNodeRole,
    setTool,
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
      selectNode: state.selectNode,
      selectEdge: state.selectEdge,
      clearSelection: state.clearSelection,
      setConnectFromNode: state.setConnectFromNode,
      deleteNode: state.deleteNode,
      deleteEdge: state.deleteEdge,
      setNodeRole: state.setNodeRole,
      setTool: state.setTool,
    })),
  );

  const { screenToFlowPosition, fitView } = useReactFlow();
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
        draggable: mode === "edit",
        selectable: true,
        style: {
          border: isSource
            ? "2px solid #14b8a6"
            : isSink
              ? "2px solid #f59e0b"
              : isConnectStart
                ? "2px solid #38bdf8"
                : "1px solid rgba(100,116,139,0.7)",
          background: isCutReachable ? "rgba(34,197,94,0.12)" : "var(--card)",
          borderRadius: "10px",
          padding: "8px 10px",
          minWidth: 68,
          color: "var(--foreground)",
          boxShadow: isSelected
            ? "0 0 0 2px rgba(59,130,246,0.55)"
            : isHighlighted
              ? "0 0 0 2px rgba(245,158,11,0.65)"
              : "none",
          fontWeight: isSource || isSink ? 700 : 600,
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
          color: isCutEdge ? "#ef4444" : isHighlighted ? "#f59e0b" : "#64748b",
        },
        style: {
          strokeWidth: width,
          stroke: isCutEdge ? "#ef4444" : isHighlighted ? "#f59e0b" : "#64748b",
        },
        animated: isHighlighted && isPlaying,
        type: "smoothstep",
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
        color: edge.isReverse ? "#0ea5e9" : "#10b981",
      },
      style: {
        strokeWidth: 1.6,
        strokeDasharray: edge.isReverse ? "6 5" : "4 4",
        stroke: edge.isReverse ? "#0ea5e9" : "#10b981",
      },
      type: "smoothstep",
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
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setMenu({
        kind: "pane",
        x: event.clientX,
        y: event.clientY,
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
      selectNode(node.id as NodeID);
      setMenu({ kind: "node", x: event.clientX, y: event.clientY, nodeId: node.id as NodeID });
    },
    [mode, selectNode],
  );

  const onEdgeContextMenu = React.useCallback(
    (event: React.MouseEvent, edge: RFEdge) => {
      if (mode !== "edit" || edge.id.startsWith("res:")) {
        return;
      }
      event.preventDefault();
      selectEdge(edge.id as EdgeID);
      setMenu({ kind: "edge", x: event.clientX, y: event.clientY, edgeId: edge.id as EdgeID });
    },
    [mode, selectEdge],
  );

  const onNodeDragStart = React.useCallback(() => {
    isDraggingRef.current = true;
  }, []);

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
    <div className={cn("relative h-full w-full overflow-hidden rounded-2xl border border-white/30 bg-card/80 shadow-sm")}> 
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onRfNodesChange}
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
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        connectionLineType={ConnectionLineType.SmoothStep}
        panOnDrag={tool === "select"}
        zoomOnScroll
        zoomOnPinch
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} />
        <Controls />
      </ReactFlow>

      {connectFromNodeId ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300">
          Select a target node to connect from {graph.nodes[connectFromNodeId]?.label ?? connectFromNodeId}
        </div>
      ) : null}

      {menu ? (
        <div
          className="absolute z-20 min-w-[190px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {menu.kind === "pane" ? (
            <>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  addNode(menu.canvasX - 32, menu.canvasY - 16);
                  setMenu(null);
                }}
              >
                Add node here
              </button>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
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
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
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
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
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
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setNodeRole(menu.nodeId, "source");
                  setMenu(null);
                }}
              >
                Set as source
              </button>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setNodeRole(menu.nodeId, "sink");
                  setMenu(null);
                }}
              >
                Set as sink
              </button>
              <button
                type="button"
                className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
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
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              onClick={() => {
                deleteEdge(menu.edgeId);
                setMenu(null);
              }}
            >
              Delete edge
            </button>
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
