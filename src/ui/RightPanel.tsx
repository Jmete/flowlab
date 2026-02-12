"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { withFlowOverrides } from "@/models/graph";
import { getEdgesWithFlow, useFlowLabStore } from "@/state/store";
import { formatFlowEvent } from "@/ui/logFormatters";

export function RightPanel() {
  const [tab, setTab] = React.useState("properties");

  const {
    graph,
    selection,
    events,
    playback,
    maxFlowValue,
    minCut,
    warnings,
    error,
    renameNode,
    setNodeRole,
    updateEdgeCapacity,
    deleteNode,
    deleteEdge,
  } = useFlowLabStore(
    useShallow((state) => ({
      graph: state.graph,
      selection: state.selection,
      events: state.events,
      playback: state.playback,
      maxFlowValue: state.maxFlowValue,
      minCut: state.minCut,
      warnings: state.warnings,
      error: state.error,
      renameNode: state.renameNode,
      setNodeRole: state.setNodeRole,
      updateEdgeCapacity: state.updateEdgeCapacity,
      deleteNode: state.deleteNode,
      deleteEdge: state.deleteEdge,
    })),
  );

  const selectedNode = React.useMemo(() => {
    return selection.nodeId ? graph.nodes[selection.nodeId] : undefined;
  }, [graph.nodes, selection.nodeId]);

  const selectedEdge = React.useMemo(() => {
    return selection.edgeId ? graph.edges[selection.edgeId] : undefined;
  }, [graph.edges, selection.edgeId]);

  const graphForDisplay = React.useMemo(() => withFlowOverrides(graph, playback.edgeFlows), [graph, playback.edgeFlows]);
  const flowingEdges = React.useMemo(() => getEdgesWithFlow(graphForDisplay), [graphForDisplay]);

  const bottlenecks = React.useMemo(() => {
    return (minCut?.cutEdges ?? [])
      .map((edgeId) => graph.edges[edgeId])
      .filter(Boolean)
      .sort((a, b) => b.capacity - a.capacity || a.id.localeCompare(b.id));
  }, [graph.edges, minCut?.cutEdges]);

  return (
    <Card className="h-full overflow-hidden border-white/30 bg-card/85 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Inspector</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="log">Run Log</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="space-y-3">
            {selectedNode ? (
              <div className="space-y-2 rounded-md border p-3">
                <h4 className="text-sm font-semibold">Node {selectedNode.id}</h4>
                <Input value={selectedNode.label} onChange={(event) => renameNode(selectedNode.id, event.target.value)} />
                <Select value={selectedNode.role} onChange={(event) => setNodeRole(selectedNode.id, event.target.value as "normal" | "source" | "sink")}> 
                  <option value="normal">normal</option>
                  <option value="source">source</option>
                  <option value="sink">sink</option>
                </Select>
                <Button variant="destructive" onClick={() => deleteNode(selectedNode.id)}>Delete Node</Button>
              </div>
            ) : null}

            {selectedEdge ? (
              <div className="space-y-2 rounded-md border p-3">
                <h4 className="text-sm font-semibold">Edge {selectedEdge.id}</h4>
                <div className="text-sm text-muted-foreground">
                  {selectedEdge.from} {"->"} {selectedEdge.to}
                </div>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={selectedEdge.capacity}
                  onChange={(event) => updateEdgeCapacity(selectedEdge.id, Number(event.target.value))}
                />
                <div className="text-sm text-muted-foreground">Current flow: {graphForDisplay.edges[selectedEdge.id]?.flow ?? 0}</div>
                <Button variant="destructive" onClick={() => deleteEdge(selectedEdge.id)}>Delete Edge</Button>
              </div>
            ) : null}

            {!selectedNode && !selectedEdge ? <p className="text-sm text-muted-foreground">Select a node or edge to edit properties.</p> : null}

            {warnings.length > 0 ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <div className="font-semibold">Warnings</div>
                <ul className="mt-1 list-disc pl-5">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">{error}</div> : null}
          </TabsContent>

          <TabsContent value="log">
              <div className="max-h-[60vh] space-y-1 overflow-auto rounded-md border border-border/80 p-2 text-sm">
              {events.length === 0 ? <div className="text-muted-foreground">Run max-flow to generate event log.</div> : null}
              {events.map((event, index) => (
                <div
                  key={`${event.type}-${index}`}
                  className={index <= playback.cursor ? "rounded px-2 py-1 bg-accent text-accent-foreground" : "rounded px-2 py-1"}
                >
                  {index + 1}. {formatFlowEvent(event)}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-3">
            <div className="rounded-md border p-3 text-sm">
              <div>Max flow: <span className="font-semibold">{maxFlowValue}</span></div>
              <div>Cut capacity: <span className="font-semibold">{minCut?.cutCapacity ?? 0}</span></div>
            </div>

            <div className="rounded-md border p-3 text-sm">
              <div className="mb-2 font-semibold">Bottleneck edges</div>
              {bottlenecks.length === 0 ? <div className="text-muted-foreground">Run algorithm to compute cut edges.</div> : null}
              {bottlenecks.map((edge) => (
                <div key={edge.id} className="flex justify-between py-0.5">
                  <span>{edge.from} {"->"} {edge.to}</span>
                  <span>{edge.capacity}</span>
                </div>
              ))}
            </div>

            <div className="rounded-md border p-3 text-sm">
              <div className="mb-2 font-semibold">Assignment view (flow {" > "} 0)</div>
              {flowingEdges.length === 0 ? <div className="text-muted-foreground">No routed flow yet.</div> : null}
              {flowingEdges.map((edge) => (
                <div key={edge.id} className="flex justify-between py-0.5">
                  <span>{graph.nodes[edge.from]?.label ?? edge.from} {"->"} {graph.nodes[edge.to]?.label ?? edge.to}</span>
                  <span>{edge.flow}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
