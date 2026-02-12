"use client";

import * as React from "react";
import { ControlBar, useLoadFromHashOnBoot } from "@/ui/ControlBar";
import { FlowCanvas } from "@/ui/FlowCanvas";
import { RightPanel } from "@/ui/RightPanel";
import { Button } from "@/components/ui/button";
import { useFlowLabStore } from "@/state/store";

export default function HomePage() {
  useLoadFromHashOnBoot();

  const undo = useFlowLabStore((state) => state.undo);
  const redo = useFlowLabStore((state) => state.redo);
  const mode = useFlowLabStore((state) => state.mode);
  const isPlaying = useFlowLabStore((state) => state.isPlaying);

  return (
    <main className="h-full min-h-screen p-4">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1680px] flex-col gap-3">
        <div className="panel-shell flex items-center justify-between rounded-sm border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <div>FlowLab // Network Systems Console</div>
          <div className="flex items-center gap-3">
            <span>Mode {mode}</span>
            <span>Status {isPlaying ? "Running" : "Idle"}</span>
          </div>
        </div>

        <div className="panel-shell flex items-center justify-between rounded-md border px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold uppercase tracking-[0.14em]">FlowLab</h1>
            <p className="text-xs text-muted-foreground">Build a directed flow network and inspect max-flow behavior step by step.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={undo}>Undo</Button>
            <Button variant="outline" onClick={redo}>Redo</Button>
          </div>
        </div>

        <ControlBar />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1fr_360px]">
          <FlowCanvas />
          <RightPanel />
        </div>
      </div>
    </main>
  );
}
