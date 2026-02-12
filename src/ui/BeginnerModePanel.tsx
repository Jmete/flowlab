"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import type { FlowEvent } from "@/models/events";
import { useFlowLabStore } from "@/state/store";

function explainEvent(event?: FlowEvent): { title: string; text: string } {
  if (!event) {
    return {
      title: "Ready to Learn",
      text: "Press Run Max Flow. Yellow highlights show the current path search, and red edges at the end show the bottleneck cut.",
    };
  }

  switch (event.type) {
    case "RUN_START":
      return {
        title: "Run Started",
        text: "The algorithm starts at the source node and tries to send as much flow as possible to the sink.",
      };
    case "BFS_START":
      return {
        title: `Searching for Path ${event.iteration}`,
        text: "It scans the residual graph to find one route where extra flow can still move.",
      };
    case "BFS_VISIT_NODE":
      return {
        title: `Visiting ${event.node}`,
        text: "Think of checking one station in a transport network to see where capacity is still available.",
      };
    case "BFS_DISCOVER_EDGE":
      return {
        title: "Viable Edge Found",
        text: event.isReverse
          ? "This reverse residual edge means the algorithm can reroute previously sent flow if that helps total throughput."
          : "This forward edge still has spare capacity, so it can be part of an augmenting path.",
      };
    case "AUGMENTING_PATH_FOUND":
      return {
        title: "Augmenting Path Found",
        text: `A full source-to-sink route is found. Bottleneck = ${event.bottleneck}, so flow increases by that amount on this path.`,
      };
    case "AUGMENT_APPLY":
      return {
        title: "Flow Updated",
        text: `Applied +${event.delta} flow across the path edges.`,
      };
    case "ITERATION_END":
      return {
        title: `Iteration ${event.iteration} Complete`,
        text: `Current max flow is now ${event.currentMaxFlow}. The algorithm now searches for another path.`,
      };
    case "NO_MORE_PATHS":
      return {
        title: "No More Paths",
        text: "No additional source-to-sink route has residual capacity, so max flow is final.",
      };
    case "MINCUT_COMPUTED":
      return {
        title: "Min-Cut Computed",
        text: "Red cut edges are the bottlenecks. Their total capacity equals the final max flow.",
      };
    case "RUN_END":
      return {
        title: "Run Complete",
        text: `Final max flow = ${event.maxFlow}. This is the most your network can move from source to sink.`,
      };
    case "RESIDUAL_BUILT":
      return {
        title: "Residual Updated",
        text: "Residual edges show where you can still push more flow or reroute existing flow.",
      };
    case "ERROR":
      return {
        title: "Run Error",
        text: event.message,
      };
    default:
      return {
        title: "Algorithm Step",
        text: "The replay is showing the current state transition.",
      };
  }
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-sm border border-border/75 bg-[hsl(var(--panel)/0.45)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

export function BeginnerModePanel() {
  const { beginnerMode, events, playback } = useFlowLabStore(
    useShallow((state) => ({
      beginnerMode: state.beginnerMode,
      events: state.events,
      playback: state.playback,
    })),
  );

  if (!beginnerMode) {
    return null;
  }

  const activeEvent = playback.cursor >= 0 ? events[playback.cursor] : undefined;
  const explanation = explainEvent(activeEvent);

  return (
    <div className="mb-3 space-y-2 rounded-sm border border-primary/45 bg-primary/10 p-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.11em]">Guide Mode: {explanation.title}</div>
        <p className="mt-1 text-xs text-muted-foreground">{explanation.text}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <LegendChip color="hsl(var(--edge-base))" label="Normal edge" />
        <LegendChip color="hsl(var(--edge-highlight))" label="Active path/search" />
        <LegendChip color="hsl(var(--edge-cut))" label="Min-cut bottleneck" />
      </div>

      <div className="rounded-sm border border-border/70 bg-background/65 p-2 text-xs text-muted-foreground">
        Source = where flow starts. Sink = where flow ends. Residual graph = remaining routing options after each step.
      </div>
    </div>
  );
}
