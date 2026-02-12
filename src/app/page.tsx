"use client";

import * as React from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ControlBar, useLoadFromHashOnBoot } from "@/ui/ControlBar";
import { FlowCanvas } from "@/ui/FlowCanvas";
import { RightPanel } from "@/ui/RightPanel";
import { useFlowLabStore } from "@/state/store";

export default function HomePage() {
  useLoadFromHashOnBoot();

  const isPlaying = useFlowLabStore((state) => state.isPlaying);

  return (
    <main className="h-full min-h-screen p-3">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-[1840px] flex-col gap-2">
        <header className="panel-shell flex items-center justify-between rounded-sm border px-4 py-2">
          <div>
            <h1 className="text-base font-semibold uppercase tracking-[0.16em]">FlowLab</h1>
            <p className="text-[11px] uppercase tracking-[0.11em] text-muted-foreground">
              Find Bottlenecks In Flow Diagrams
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-sm border border-border/80 bg-muted/60 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {isPlaying ? "Running" : "Idle"}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-0 flex-col gap-2">
            <ControlBar />
            <div className="min-h-0 flex-1">
              <FlowCanvas />
            </div>
          </section>
          <RightPanel />
        </div>
      </div>
    </main>
  );
}
