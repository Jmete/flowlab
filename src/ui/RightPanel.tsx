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
  const lastAutoResultsEventsRef = React.useRef<typeof events | null>(null);

  const {
    graph,
    selection,
    events,
    isPlaying,
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
      isPlaying: state.isPlaying,
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

  const plainLanguageSummary = React.useMemo(() => {
    if (!minCut || bottlenecks.length === 0) {
      return "Run an algorithm to see a plain-language bottleneck summary.";
    }

    const topEdge = bottlenecks[0];
    const fromLabel = graph.nodes[topEdge.from]?.label ?? topEdge.from;
    const toLabel = graph.nodes[topEdge.to]?.label ?? topEdge.to;
    const intakeNode = Object.values(graph.nodes).find((node) => node.role === "source");
    const intakeLabel = intakeNode?.label ?? "incoming workload";

    return `The main bottleneck is between ${fromLabel} and ${toLabel}. Increase ${fromLabel} capacity before adding more ${intakeLabel}.`;
  }, [bottlenecks, graph.nodes, minCut]);

  React.useEffect(() => {
    if (selection.nodeId || selection.edgeId) {
      setTab("properties");
    }
  }, [selection.edgeId, selection.nodeId]);

  React.useEffect(() => {
    const runComplete = events.length > 0 && playback.cursor >= events.length - 1 && !playback.isRunning;
    if (!runComplete || isPlaying || lastAutoResultsEventsRef.current === events) {
      return;
    }

    lastAutoResultsEventsRef.current = events;
    setTab("results");
  }, [events, isPlaying, playback.cursor, playback.isRunning]);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-3">
        <CardTitle>Inspector</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="log">Run Log</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="space-y-3">
            {selectedNode ? (
              <div className="space-y-2 rounded-sm border border-border/70 bg-[hsl(var(--panel)/0.5)] p-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.11em]">Node {selectedNode.id}</h4>
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
              <div className="space-y-2 rounded-sm border border-border/70 bg-[hsl(var(--panel)/0.5)] p-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.11em]">Edge {selectedEdge.id}</h4>
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
              <div className="rounded-sm border border-accent/45 bg-accent/14 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.11em]">Warnings</div>
                <ul className="mt-1 list-disc pl-5">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? <div className="rounded-sm border border-destructive/55 bg-destructive/14 p-3 text-sm">{error}</div> : null}
          </TabsContent>

          <TabsContent value="log">
              <div className="max-h-[60vh] space-y-1 overflow-auto rounded-sm border border-border/75 bg-[hsl(var(--panel)/0.45)] p-2 text-sm">
              {events.length === 0 ? <div className="text-muted-foreground">Run an algorithm to generate event log.</div> : null}
              {events.map((event, index) => (
                <div
                  key={`${event.type}-${index}`}
                  className={index <= playback.cursor ? "rounded-sm border border-accent/45 bg-accent/20 px-2 py-1" : "rounded-sm px-2 py-1"}
                >
                  {index + 1}. {formatFlowEvent(event)}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-3">
            <div className="rounded-sm border border-primary/45 bg-primary/12 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-[0.11em]">What this means</div>
              <div>{plainLanguageSummary}</div>
            </div>

            <div className="rounded-sm border border-border/70 bg-[hsl(var(--panel)/0.5)] p-3 text-sm">
              <div>Max flow: <span className="font-semibold">{maxFlowValue}</span></div>
              <div>Cut capacity: <span className="font-semibold">{minCut?.cutCapacity ?? 0}</span></div>
            </div>

            <div className="rounded-sm border border-border/70 bg-[hsl(var(--panel)/0.5)] p-3 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.11em]">Bottleneck edges</div>
              {bottlenecks.length === 0 ? <div className="text-muted-foreground">Run algorithm to compute cut edges.</div> : null}
              {bottlenecks.map((edge) => (
                <div key={edge.id} className="flex justify-between py-0.5">
                  <span>{graph.nodes[edge.from]?.label ?? edge.from} {"->"} {graph.nodes[edge.to]?.label ?? edge.to}</span>
                  <span>{edge.capacity}</span>
                </div>
              ))}
            </div>

            <div className="rounded-sm border border-border/70 bg-[hsl(var(--panel)/0.5)] p-3 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.11em]">Assignment view (flow {" > "} 0)</div>
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
