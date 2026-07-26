// Derives the engine's knowledge graph from two real sources:
//
//   1. The vocabulary registry (.claude/vocabulary.json → spellbook-data.ts) —
//      schools, spells, agents, MCP portals, workflows and their typed edges.
//   2. The docs notes (content/docs/**/*.mdx) — the second-brain layer. Every
//      markdown link between docs becomes a `references` edge, so "back-links
//      do most of the organizational work" holds here the way it does in an
//      Obsidian vault. A doc named after a spell is stitched to that spell.
//
// Nothing is hand-authored, so the graph cannot drift from the engine.
//
// Runs on the server. Only the derived nodes/edges cross the RSC boundary —
// the 88KB spellbook module and the docs corpus stay out of the client bundle.

import fs from "node:fs";
import path from "node:path";
import { schools, workflows } from "@/components/docs/spellbook-data";
import type { GraphData, GraphEdge, GraphNode } from "./types";

type Draft = Omit<GraphNode, "degree" | "influence">;

interface DocNote {
  slug: string;
  title: string;
  description: string;
  links: string[];
}

/**
 * Read the docs corpus. Markdown links to /docs/<slug> (with or without a
 * locale prefix) are the note-to-note relations. Wiki-bracket syntax is NOT
 * parsed — the docs contain bash `[[ -s … ]]` conditionals that would false-
 * positive. Failure of any kind degrades to "no notes", never to a crash.
 */
function collectNotes(): DocNote[] {
  try {
    const root = path.join(process.cwd(), "content/docs");
    const files: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".mdx")) files.push(full);
      }
    };
    walk(root);

    return files.map((file) => {
      const raw = fs.readFileSync(file, "utf8");
      const slug = path
        .relative(root, file)
        .replace(/\.mdx$/, "")
        .split(path.sep)
        .join("/");

      const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      const field = (name: string) =>
        frontmatter
          .match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]
          .trim()
          .replace(/^["']|["']$/g, "") ?? "";

      const links = [
        ...raw.matchAll(/\]\((?:\/(?:en|ar))?\/docs\/([a-zA-Z0-9/_-]+)/g),
      ].map((m) => m[1].replace(/\/$/, ""));

      return {
        slug,
        title: field("title") || slug,
        description: field("description"),
        links: [...new Set(links)].filter((l) => l !== slug),
      };
    });
  } catch {
    return [];
  }
}

function derive(): GraphData {
  const drafts: Draft[] = [];
  const index = new Map<string, number>();
  const edges: GraphEdge[] = [];
  const seenEdge = new Set<string>();

  const addNode = (node: Draft): number => {
    const existing = index.get(node.id);
    if (existing !== undefined) return existing;
    index.set(node.id, drafts.length);
    drafts.push(node);
    return drafts.length - 1;
  };

  // Undirected dedupe — `connects` is declared from both ends in the registry.
  const addEdge = (source: number, target: number, kind: GraphEdge["kind"]) => {
    if (source === target) return;
    const key = `${Math.min(source, target)}-${Math.max(source, target)}-${kind}`;
    if (seenEdge.has(key)) return;
    seenEdge.add(key);
    edges.push({ source, target, kind });
  };

  // ── Schools and their spells ────────────────────────────────────────────
  const spellIndex = new Map<string, number>();

  for (const school of schools) {
    const schoolIdx = addNode({
      id: `school:${school.id}`,
      label: school.name,
      kind: "school",
      detail: school.subtitle || school.description,
      group: school.id,
    });

    for (const spell of school.spells) {
      const spellIdx = addNode({
        id: `spell:${spell.name}`,
        label: spell.name,
        kind: "spell",
        detail: spell.effect,
        group: school.id,
      });
      spellIndex.set(spell.name, spellIdx);
      addEdge(schoolIdx, spellIdx, "teaches");
    }
  }

  // ── Spell relations + routing chain ─────────────────────────────────────
  for (const school of schools) {
    for (const spell of school.spells) {
      const from = spellIndex.get(spell.name);
      if (from === undefined) continue;

      for (const name of spell.connects) {
        const to = spellIndex.get(name);
        if (to !== undefined) addEdge(from, to, "connects");
      }

      for (const name of spell.depends) {
        const to = spellIndex.get(name);
        if (to !== undefined) addEdge(from, to, "depends");
      }

      // Only agents and MCP portals become nodes. Skills are ~1:1 with spells
      // (`/feature` ↔ `feature`), so they would double the graph without
      // adding a single relation the spell node doesn't already carry.
      for (const item of spell.order) {
        if (item.type === "familiar") {
          addEdge(
            from,
            addNode({
              id: `agent:${item.name}`,
              label: item.name,
              kind: "agent",
              detail: `Agent invoked by ${spell.name}`,
            }),
            "routes",
          );
        } else if (item.type === "portal") {
          addEdge(
            from,
            addNode({
              id: `portal:${item.name}`,
              label: item.name,
              kind: "portal",
              detail: `MCP server reached by ${spell.name}`,
            }),
            "routes",
          );
        }
      }
    }
  }

  // ── Workflows ───────────────────────────────────────────────────────────
  for (const workflow of workflows) {
    const workflowIdx = addNode({
      id: `workflow:${workflow.id}`,
      label: workflow.name,
      kind: "workflow",
      detail: workflow.description,
    });
    for (const step of workflow.steps) {
      const to = spellIndex.get(step.keyword);
      if (to !== undefined) addEdge(workflowIdx, to, "composes");
    }
  }

  // ── Notes (the docs vault) ──────────────────────────────────────────────
  const notes = collectNotes();
  const noteIndex = new Map<string, number>();

  for (const note of notes) {
    noteIndex.set(
      note.slug,
      addNode({
        id: `note:${note.slug}`,
        label: note.title,
        kind: "note",
        detail: note.description,
        href: note.slug === "index" ? "/docs" : `/docs/${note.slug}`,
      }),
    );
  }

  for (const note of notes) {
    const from = noteIndex.get(note.slug);
    if (from === undefined) continue;

    // Note → note: the vault's back-link fabric.
    for (const target of note.links) {
      const to = noteIndex.get(target);
      if (to !== undefined) addEdge(from, to, "references");
    }

    // Note ↔ spell of the same name: the doc documents the spell.
    const spell = spellIndex.get(note.slug);
    if (spell !== undefined) addEdge(from, spell, "references");
  }

  // ── Analytics ───────────────────────────────────────────────────────────
  const n = drafts.length;
  const adjacency: number[][] = Array.from({ length: n }, () => []);
  for (const edge of edges) {
    adjacency[edge.source].push(edge.target);
    adjacency[edge.target].push(edge.source);
  }

  const influence = betweenness(n, adjacency);
  const peak = Math.max(...influence, 1);

  const nodes: GraphNode[] = drafts.map((draft, i) => ({
    ...draft,
    degree: adjacency[i].length,
    influence: influence[i] / peak,
  }));

  const orphans = nodes.reduce<number[]>((acc, node, i) => {
    if (node.degree === 0) acc.push(i);
    return acc;
  }, []);

  return { nodes, edges, adjacency, orphans };
}

/**
 * Brandes betweenness centrality on an unweighted undirected graph — O(V·E).
 * At ~300 nodes / ~1000 edges this is a few milliseconds, once, on the server.
 *
 * It answers the question a raw link count can't: which spells are the bridges
 * the engine actually routes through, versus which are merely busy.
 */
function betweenness(n: number, adjacency: number[][]): number[] {
  const score = new Float64Array(n);
  const sigma = new Float64Array(n);
  const delta = new Float64Array(n);
  const dist = new Int32Array(n);
  const stack = new Int32Array(n);
  const queue = new Int32Array(n);
  const preds: number[][] = Array.from({ length: n }, () => []);

  for (let s = 0; s < n; s++) {
    for (let i = 0; i < n; i++) {
      preds[i].length = 0;
      sigma[i] = 0;
      delta[i] = 0;
      dist[i] = -1;
    }
    sigma[s] = 1;
    dist[s] = 0;

    let head = 0;
    let tail = 0;
    let top = 0;
    queue[tail++] = s;

    while (head < tail) {
      const v = queue[head++];
      stack[top++] = v;
      for (const w of adjacency[v]) {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1;
          queue[tail++] = w;
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          preds[w].push(v);
        }
      }
    }

    while (top > 0) {
      const w = stack[--top];
      for (const v of preds[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) score[w] += delta[w];
    }
  }

  // Each shortest path is counted from both endpoints on an undirected graph.
  for (let i = 0; i < n; i++) score[i] /= 2;
  return Array.from(score);
}

let cache: GraphData | null = null;

/** Memoized per server instance — the registry and docs are static at runtime. */
export function getGraphData(): GraphData {
  cache ??= derive();
  return cache;
}
