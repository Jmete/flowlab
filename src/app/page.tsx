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

  return (
    <main className="h-full min-h-screen bg-gradient-to-br from-background via-background to-sky-100/50 p-4 dark:to-slate-900">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1600px] flex-col gap-3">
        <div className="flex items-center justify-between rounded-xl border border-white/40 bg-card/85 px-4 py-2 shadow-sm backdrop-blur-sm">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">FlowLab</h1>
            <p className="text-xs text-muted-foreground">Design a flow network, then replay Edmonds-Karp step-by-step.</p>
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
