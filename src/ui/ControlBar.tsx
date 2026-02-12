"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { readGraphFromUrlHash } from "@/lib/shareUrl";
import { useFlowLabStore } from "@/state/store";
import { normalizeImportedGraph, type Graph } from "@/models/graph";

export function ControlBar() {
  const {
    graph,
    events,
    mode,
    showResidual,
    showMinCut,
    playbackSpeed,
    isPlaying,
    error,
    setMode,
    runMaxFlow,
    resetFlows,
    setShowResidual,
    setShowMinCut,
    stepBack,
    stepForward,
    play,
    pause,
    setPlaybackSpeed,
    clearSelection,
    setConnectFromNode,
    autoTidyLayout,
  } = useFlowLabStore(
    useShallow((state) => ({
      graph: state.graph,
      events: state.events,
      mode: state.mode,
      showResidual: state.showResidual,
      showMinCut: state.showMinCut,
      playbackSpeed: state.playbackSpeed,
      isPlaying: state.isPlaying,
      error: state.error,
      setMode: state.setMode,
      runMaxFlow: state.runMaxFlow,
      resetFlows: state.resetFlows,
      setShowResidual: state.setShowResidual,
      setShowMinCut: state.setShowMinCut,
      stepBack: state.stepBack,
      stepForward: state.stepForward,
      play: state.play,
      pause: state.pause,
      setPlaybackSpeed: state.setPlaybackSpeed,
      clearSelection: state.clearSelection,
      setConnectFromNode: state.setConnectFromNode,
      autoTidyLayout: state.autoTidyLayout,
    })),
  );

  const nodeCount = Object.keys(graph.nodes).length;
  const edgeCount = Object.keys(graph.edges).length;
  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

  function onPlayPause() {
    if (isPlaying) {
      pause();
      return;
    }

    if (events.length === 0) {
      runMaxFlow();
      const next = useFlowLabStore.getState();
      if (next.events.length > 0 && !next.error) {
        next.play();
      }
      return;
    }

    play();
  }

  function onReset() {
    pause();
    resetFlows();
    setMode("edit");
    clearSelection();
    setConnectFromNode(undefined);
  }

  return (
    <div className="panel-shell flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-2">
      <Button variant="outline" onClick={stepBack}>
        Backward
      </Button>
      <Button variant={isPlaying ? "secondary" : "default"} onClick={onPlayPause}>
        {isPlaying ? "Pause" : "Play"}
      </Button>
      <Button variant="outline" onClick={stepForward}>
        Forward
      </Button>
      <Button variant="outline" onClick={onReset}>
        Reset
      </Button>
      <Button variant="outline" onClick={autoTidyLayout}>
        Auto Tidy
      </Button>

      <div className="mx-1 h-7 w-px bg-border/80" />

      <Button variant={showResidual ? "default" : "outline"} onClick={() => setShowResidual(!showResidual)}>
        Show Residual
      </Button>
      <Button variant={showMinCut ? "default" : "outline"} onClick={() => setShowMinCut(!showMinCut)}>
        Show Min Cut
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <label htmlFor="speed-selector" className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
          Speed
        </label>
        <Select
          id="speed-selector"
          value={String(playbackSpeed)}
          onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
          className="w-20 text-xs"
        >
          {speedOptions.map((speed) => (
            <option key={speed} value={speed}>
              {speed.toFixed(2)}x
            </option>
          ))}
        </Select>
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
        <span className="uppercase tracking-[0.12em]">
          {nodeCount} nodes / {edgeCount} edges • {mode} mode
          {error ? ` • ${error}` : ""}
        </span>
        <span className="text-right">
          Tip: Right-click canvas to add nodes. Right-click nodes or edges to edit.
        </span>
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
