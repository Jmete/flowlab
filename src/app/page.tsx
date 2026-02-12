"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getMaxFlowAlgorithmById } from "@/models/algorithms";
import { useLoadFromHashOnBoot } from "@/ui/ControlBar";
import { useFlowLabStore } from "@/state/store";

const ControlBar = dynamic(() => import("@/ui/ControlBar").then((mod) => mod.ControlBar), {
  ssr: false,
  loading: () => <div className="panel-shell h-28 rounded-md border" />,
});

const FlowCanvas = dynamic(() => import("@/ui/FlowCanvas").then((mod) => mod.FlowCanvas), {
  ssr: false,
  loading: () => <div className="panel-shell h-full w-full rounded-md border" />,
});

const RightPanel = dynamic(() => import("@/ui/RightPanel").then((mod) => mod.RightPanel), {
  ssr: false,
  loading: () => <div className="panel-shell h-full rounded-md border" />,
});

export default function HomePage() {
  useLoadFromHashOnBoot();

  const isPlaying = useFlowLabStore((state) => state.isPlaying);
  const algorithm = useFlowLabStore((state) => state.algorithm);
  const algorithmLabel = getMaxFlowAlgorithmById(algorithm).label;

  return (
    <main className="h-full min-h-screen p-2 sm:p-3">
      <div className="mx-auto flex min-h-[calc(100dvh-1rem)] max-w-[1840px] flex-col gap-2 sm:min-h-[calc(100dvh-1.5rem)]">
        <header className="panel-shell flex flex-wrap items-center justify-between gap-2 rounded-sm border px-3 py-2 sm:px-4">
          <div>
            <h1 className="text-base font-semibold uppercase tracking-[0.16em]">FlowLab</h1>
            <p className="text-[11px] uppercase tracking-[0.11em] text-muted-foreground">
              {algorithmLabel} Max Flow - Find Bottlenecks
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="rounded-sm border border-border/80 bg-muted/60 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {isPlaying ? "Running" : "Idle"}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-[320px] flex-col gap-2 xl:min-h-0">
            <ControlBar />
            <div className="min-h-[260px] flex-1 xl:min-h-0">
              <FlowCanvas />
            </div>
          </section>
          <div className="min-h-[250px] max-h-[42dvh] xl:min-h-0 xl:max-h-none">
            <RightPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
