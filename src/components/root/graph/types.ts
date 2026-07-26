// Shared graph types — imported by the server derivation (data.ts) and the
// client canvas (graph-canvas.tsx). Kept directive-free so both sides can use it.

/**
 * The five engine kinds are Obsidian-style "groups" (colored); `note` is the
 * ungrouped base layer — the docs pages themselves, rendered neutral gray the
 * way Obsidian renders ungrouped notes.
 */
export type NodeKind =
  "school" | "spell" | "agent" | "portal" | "workflow" | "note";

/**
 * Typed relations. Obsidian-style graphs are untyped page links, which is the
 * reason they degrade into a hairball at scale — every edge means the same
 * thing, so no edge can be filtered out. Ours carry meaning.
 */
export type EdgeKind =
  | "teaches" // school → spell
  | "connects" // spell ↔ spell (vocabulary `connects`)
  | "depends" // spell → spell (vocabulary `depends`)
  | "routes" // spell → agent | MCP portal (vocabulary `order`)
  | "composes" // workflow → spell
  | "references"; // note → note (markdown links), note ↔ spell (same name)

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  detail: string;
  /** School id for spells — used for cluster tinting and grouping. */
  group?: string;
  /** Locale-less route for note nodes (e.g. "/docs/onboarding"). */
  href?: string;
  /** Number of incident edges. Drives node radius. */
  degree: number;
  /**
   * Brandes betweenness centrality, normalized 0..1. High = a bridge whose
   * removal would disconnect parts of the engine. Surfaced as "influence".
   */
  influence: number;
}

export interface GraphEdge {
  /** Index into the nodes array — resolved once, so no lookup per frame. */
  source: number;
  target: number;
  kind: EdgeKind;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Adjacency by node index, for hop expansion and keyboard traversal. */
  adjacency: number[][];
  /** Node indices with no incident edge — knowledge-graph "gaps". */
  orphans: number[];
}
