import { z } from "zod";
import { normalizeImportedGraph, type Graph } from "@/models/graph";

const nodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  role: z.enum(["normal", "source", "sink"]),
});

const edgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  capacity: z.number(),
  flow: z.number(),
  directed: z.literal(true),
  label: z.string().optional(),
});

const graphSchema = z.object({
  nodes: z.record(nodeSchema),
  edges: z.record(edgeSchema),
  meta: z.object({
    version: z.literal("1.0").optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
  }),
});

export function exportGraphToJson(graph: Graph): string {
  return JSON.stringify(graph, null, 2);
}

export function parseImportedGraph(json: string): { graph: Graph; warnings: string[] } {
  const parsed = graphSchema.parse(JSON.parse(json));
  const normalized = normalizeImportedGraph({
    nodes: parsed.nodes,
    edges: parsed.edges,
    meta: {
      version: "1.0",
      createdAt: parsed.meta.createdAt ?? Date.now(),
      updatedAt: parsed.meta.updatedAt ?? Date.now(),
    },
  });

  return normalized;
}

export function downloadJson(filename: string, data: string): void {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
