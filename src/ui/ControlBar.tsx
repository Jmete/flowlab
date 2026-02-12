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
    loadBlankGraph,
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
      loadBlankGraph: state.loadBlankGraph,
    })),
  );

  const nodeCount = Object.keys(graph.nodes).length;
  const edgeCount = Object.keys(graph.edges).length;
  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const speedValue = isMounted ? String(playbackSpeed) : "1.25";

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

  function onClearGraph() {
    const confirmed = window.confirm("Clear all nodes and edges? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    pause();
    loadBlankGraph();
  }

  return (
    <div className="panel-shell rounded-md border px-2 py-2">
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
          <Button variant="outline" onClick={stepBack} className="w-full sm:w-auto">
            Backward
          </Button>
          <Button variant={isPlaying ? "secondary" : "default"} onClick={onPlayPause} className="w-full sm:w-auto">
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button variant="outline" onClick={stepForward} className="w-full sm:w-auto">
            Forward
          </Button>
          <Button variant="outline" onClick={onReset} className="w-full sm:w-auto">
            Reset
          </Button>
          <Button variant="outline" onClick={autoTidyLayout} className="w-full sm:w-auto">
            Auto Tidy
          </Button>
          <Button variant="destructive" onClick={onClearGraph} className="w-full sm:w-auto">
            Clear Graph
          </Button>

          <div className="col-span-2 hidden h-7 w-px bg-border/80 sm:block" />

          <Button
            variant={showResidual ? "default" : "outline"}
            onClick={() => setShowResidual(!showResidual)}
            className="w-full sm:w-auto"
          >
            Show Residual
          </Button>
          <Button variant={showMinCut ? "default" : "outline"} onClick={() => setShowMinCut(!showMinCut)} className="w-full sm:w-auto">
            Show Min Cut
          </Button>

          <div className="col-span-2 flex items-center justify-between gap-2 sm:col-auto sm:ml-auto sm:justify-start">
            <label
              htmlFor="speed-selector"
              className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground"
            >
              Speed
            </label>
            <Select
              id="speed-selector"
              value={speedValue}
              onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
              className="w-24 text-xs"
            >
              {speedOptions.map((speed) => (
                <option key={speed} value={speed}>
                  {speed.toFixed(2)}x
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid w-full gap-1 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground sm:grid-cols-[auto_1fr] sm:items-center sm:gap-3">
          <span className="uppercase tracking-[0.12em]">
            {nodeCount} nodes / {edgeCount} edges • {mode} mode
            {error ? ` • ${error}` : ""}
          </span>
          <span className="text-left sm:text-right">Tip: Right-click graph items for quick actions.</span>
        </div>
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
