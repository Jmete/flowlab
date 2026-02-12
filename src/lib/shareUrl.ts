import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Graph } from "@/models/graph";

interface ShareGraphPayload extends Omit<Graph, "meta"> {
  meta: Omit<Graph["meta"], "updatedAt">;
}

export function encodeGraphForUrl(graph: Graph): string {
  const payload: ShareGraphPayload = {
    nodes: graph.nodes,
    edges: graph.edges,
    meta: {
      version: graph.meta.version,
      createdAt: graph.meta.createdAt,
    },
  };

  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeGraphFromUrl(payload: string): Graph | null {
  try {
    const raw = decompressFromEncodedURIComponent(payload);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ShareGraphPayload;
    return {
      ...parsed,
      meta: {
        ...parsed.meta,
        updatedAt: Date.now(),
      },
    };
  } catch {
    return null;
  }
}

export function updateUrlWithGraph(graph: Graph): string {
  const encoded = encodeGraphForUrl(graph);
  const url = new URL(window.location.href);
  url.hash = `g=${encoded}`;
  window.history.replaceState({}, "", url);
  return url.toString();
}

export function readGraphFromUrlHash(): Graph | null {
  const hash = window.location.hash;
  if (!hash.startsWith("#g=")) {
    return null;
  }
  return decodeGraphFromUrl(hash.slice(3));
}
