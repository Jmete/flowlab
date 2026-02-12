"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { downloadJson, exportGraphToJson, parseImportedGraph } from "@/lib/importExport";
import { readGraphFromUrlHash, updateUrlWithGraph } from "@/lib/shareUrl";
import { useFlowLabStore } from "@/state/store";
import { normalizeImportedGraph, type Graph } from "@/models/graph";

export function ControlBar() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    graph,
    mode,
    tool,
    showResidual,
    showMinCut,
    playbackSpeed,
    isPlaying,
    setMode,
    setTool,
    setNodeRole,
    runMaxFlow,
    resetFlows,
    setShowResidual,
    setShowMinCut,
    stepBack,
    stepForward,
    jumpStart,
    jumpEnd,
    play,
    pause,
    setPlaybackSpeed,
    loadDefaultExample,
    loadAmlExample,
    loadBlankGraph,
    importGraph,
  } = useFlowLabStore(
    useShallow((state) => ({
      graph: state.graph,
      mode: state.mode,
      tool: state.tool,
      showResidual: state.showResidual,
      showMinCut: state.showMinCut,
      playbackSpeed: state.playbackSpeed,
      isPlaying: state.isPlaying,
      setMode: state.setMode,
      setTool: state.setTool,
      setNodeRole: state.setNodeRole,
      runMaxFlow: state.runMaxFlow,
      resetFlows: state.resetFlows,
      setShowResidual: state.setShowResidual,
      setShowMinCut: state.setShowMinCut,
      stepBack: state.stepBack,
      stepForward: state.stepForward,
      jumpStart: state.jumpStart,
      jumpEnd: state.jumpEnd,
      play: state.play,
      pause: state.pause,
      setPlaybackSpeed: state.setPlaybackSpeed,
      loadDefaultExample: state.loadDefaultExample,
      loadAmlExample: state.loadAmlExample,
      loadBlankGraph: state.loadBlankGraph,
      importGraph: state.importGraph,
    })),
  );

  const nodes = Object.values(graph.nodes);
  const sourceId = nodes.find((node) => node.role === "source")?.id ?? "";
  const sinkId = nodes.find((node) => node.role === "sink")?.id ?? "";

  function onRunMaxFlow() {
    runMaxFlow();
    const next = useFlowLabStore.getState();
    if (next.events.length > 0 && !next.error) {
      next.jumpStart();
      next.play();
    }
  }

  function onExport() {
    const json = exportGraphToJson(graph);
    downloadJson("flowlab-graph.json", json);
  }

  function onShare() {
    const url = updateUrlWithGraph(graph);
    navigator.clipboard.writeText(url).catch(() => {
      window.alert("Could not copy URL to clipboard.");
    });
  }

  async function onImportChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseImportedGraph(text);
      importGraph(parsed.graph, parsed.warnings);
    } catch {
      window.alert("Invalid graph JSON.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="grid gap-2 rounded-xl border border-white/40 bg-card/90 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mode} onChange={(event) => setMode(event.target.value as "edit" | "run")} className="w-28">
          <option value="edit">Edit</option>
          <option value="run">Run</option>
        </Select>
        <Button variant={tool === "select" ? "default" : "secondary"} onClick={() => setTool("select")}>Select/Move</Button>
        <Button variant={tool === "add-node" ? "default" : "secondary"} onClick={() => setTool("add-node")}>Add Node</Button>
        <Button variant={tool === "connect" ? "default" : "secondary"} onClick={() => setTool("connect")}>Connect Edge</Button>
        <Button variant={tool === "delete" ? "destructive" : "secondary"} onClick={() => setTool("delete")}>Delete</Button>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Source</span>
        <Select
          value={sourceId}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return;
            setNodeRole(value, "source");
          }}
          className="w-44"
        >
          <option value="">Select source</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.label}
            </option>
          ))}
        </Select>

        <span className="text-sm text-muted-foreground">Sink</span>
        <Select
          value={sinkId}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return;
            setNodeRole(value, "sink");
          }}
          className="w-44"
        >
          <option value="">Select sink</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.label}
            </option>
          ))}
        </Select>

        <Button onClick={onRunMaxFlow}>Run Max Flow</Button>
        <Button variant="outline" onClick={resetFlows}>Reset Flows</Button>
        <Button variant={showResidual ? "default" : "outline"} onClick={() => setShowResidual(!showResidual)}>Show Residual</Button>
        <Button variant={showMinCut ? "default" : "outline"} onClick={() => setShowMinCut(!showMinCut)}>Show Min Cut</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={jumpStart}>Jump Start</Button>
        <Button variant="outline" onClick={stepBack}>Step Back</Button>
        <Button variant="outline" onClick={stepForward}>Step</Button>
        <Button variant="outline" onClick={isPlaying ? pause : play}>{isPlaying ? "Pause" : "Play"}</Button>
        <Button variant="outline" onClick={jumpEnd}>Jump End</Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Speed</span>
          <Input
            type="range"
            min={0.25}
            max={3}
            step={0.25}
            value={playbackSpeed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
            className="h-9 w-36"
          />
          <span className="w-10 text-sm">{playbackSpeed.toFixed(2)}x</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={loadBlankGraph}>New Blank</Button>
        <Button variant="secondary" onClick={loadDefaultExample}>Load Default Demo</Button>
        <Button variant="outline" onClick={loadAmlExample}>Load AML Demo</Button>
        <Button variant="outline" onClick={onExport}>Export JSON</Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Import JSON</Button>
        <Button variant="outline" onClick={onShare}>Share URL</Button>

        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onImportChange} />
      </div>

      <div className="text-xs text-muted-foreground">
        Tip: a default Edmonds-Karp demo is preloaded. Right-click canvas, nodes, or edges for fast actions.
      </div>
    </div>
  );
}

export function useLoadFromHashOnBoot() {
  const importGraph = useFlowLabStore((state) => state.importGraph);

  React.useEffect(() => {
    const graphFromHash = readGraphFromUrlHash();
    if (!graphFromHash) {
      return;
    }

    const normalized = normalizeImportedGraph(graphFromHash as Graph);
    importGraph(normalized.graph, normalized.warnings);
  }, [importGraph]);
}
