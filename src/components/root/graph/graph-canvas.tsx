"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Compass,
  Focus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SETTINGS,
  GraphControls,
  KIND_LABELS,
  KIND_ORDER,
  kindColor,
  type GraphSettings,
} from "./controls";
import { ForceSimulation, type SimLink } from "./simulation";
import type { EdgeKind, GraphEdge, GraphNode, NodeKind } from "./types";

// ── Copy ──────────────────────────────────────────────────────────────────

const EDGE_LABELS: Record<EdgeKind, { en: string; ar: string }> = {
  teaches: { en: "teaches", ar: "تُدرّس" },
  connects: { en: "connects", ar: "تتصل بـ" },
  depends: { en: "depends on", ar: "تعتمد على" },
  routes: { en: "routes to", ar: "توجّه إلى" },
  composes: { en: "composes", ar: "تتركب من" },
  references: { en: "references", ar: "تشير إلى" },
};

const copy = {
  title: { en: "Second Brain", ar: "الدماغ الثاني" },
  subtitle: {
    en: "Schools, spells, agents, portals, workflows and notes — one linked brain",
    ar: "المدارس والتعويذات والوكلاء والمنافذ والملاحظات — دماغ واحد مترابط",
  },
  nodes: { en: "nodes", ar: "عقدة" },
  links: { en: "links", ar: "رابط" },
  orphans: { en: "orphans", ar: "معزولة" },
  influence: { en: "Influence", ar: "التأثير" },
  degree: { en: "Links", ar: "الروابط" },
  reset: { en: "Reset view", ar: "إعادة العرض" },
  settings: { en: "Graph settings", ar: "إعدادات الخريطة" },
  focusHint: {
    en: "Select a node to isolate its neighbourhood",
    ar: "اختر عقدة لعزل محيطها",
  },
  secondOrder: { en: "Two hops away", ar: "على بعد خطوتين" },
  noMatches: { en: "Nothing matches", ar: "لا نتائج" },
  openNote: { en: "Open note", ar: "افتح الملاحظة" },
  a11yCanvas: {
    en: "Knowledge graph. Use the node list below to explore with a keyboard.",
    ar: "خريطة المعرفة. استخدم القائمة أدناه للتصفح بلوحة المفاتيح.",
  },
  a11yList: { en: "All nodes", ar: "كل العقد" },
};

// ── Theme-aware palette ───────────────────────────────────────────────────

interface Palette {
  foreground: string;
  muted: string;
  border: string;
  background: string;
  kind: Record<NodeKind, string>;
  font: string;
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;

  return {
    foreground: v("--foreground", "#111"),
    muted: v("--muted-foreground", "#888"),
    border: v("--border", "#ddd"),
    background: v("--background", "#fff"),
    font: cs.fontFamily || "ui-monospace, monospace",
    kind: {
      school: v("--graph-1", "#00bdc8"),
      spell: v("--graph-2", "#6667ff"),
      agent: v("--graph-3", "#8d007f"),
      portal: v("--graph-4", "#ff8b55"),
      workflow: v("--graph-5", "#5a6a00"),
      // Ungrouped base layer — same neutral Obsidian gives plain notes.
      note: v("--muted-foreground", "#888"),
    },
  };
}

/**
 * How each relation pulls. `teaches` is containment — a spell belongs to its
 * school — so it binds tight and short and the 19 clusters become visible.
 * Everything else is cross-reference: long and slack, so it links the clusters
 * without collapsing them into one another.
 */
const LINK_PHYSICS: Record<EdgeKind, { strength: number; distance: number }> = {
  teaches: { strength: 2.6, distance: 22 },
  connects: { strength: 0.3, distance: 90 },
  depends: { strength: 0.45, distance: 70 },
  routes: { strength: 0.35, distance: 80 },
  composes: { strength: 0.35, distance: 80 },
  references: { strength: 0.3, distance: 85 },
};

// ── Visibility tiers ──────────────────────────────────────────────────────

const HIDDEN = 0;
const DIM = 1;
const NORMAL = 2;
const FOCUS = 3;

/** Influence percentile that earns a permanent label at rest. */
const LABEL_INFLUENCE = 0.12;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

interface Transform {
  k: number;
  x: number;
  y: number;
}

interface GraphCanvasProps {
  /** Only nodes and edges cross the RSC boundary — everything else derives. */
  nodes: GraphNode[];
  edges: GraphEdge[];
  lang: string;
}

export function GraphCanvas({ nodes, edges, lang }: GraphCanvasProps) {
  const isAr = lang === "ar";
  const t = React.useCallback(
    (key: keyof typeof copy) => (isAr ? copy[key].ar : copy[key].en),
    [isAr],
  );

  // Cheap to rebuild here; not worth serializing into the payload.
  const adjacency = React.useMemo(() => {
    const list: number[][] = Array.from({ length: nodes.length }, () => []);
    for (const edge of edges) {
      list[edge.source].push(edge.target);
      list[edge.target].push(edge.source);
    }
    return list;
  }, [nodes.length, edges]);

  const orphanCount = React.useMemo(
    () => nodes.filter((node) => node.degree === 0).length,
    [nodes],
  );

  const counts = React.useMemo(() => {
    const tally = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<
      NodeKind,
      number
    >;
    for (const node of nodes) tally[node.kind]++;
    return tally;
  }, [nodes]);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const shellRef = React.useRef<HTMLDivElement | null>(null);

  // ── React state: only what the DOM actually renders ────────────────────
  // Hover and drag live in refs — they change per pointer-move and must never
  // trigger a React render or restart the animation loop.
  const [selected, setSelected] = React.useState<number | null>(null);
  const [hovered, setHovered] = React.useState<number | null>(null);
  const [settings, setSettings] =
    React.useState<GraphSettings>(DEFAULT_SETTINGS);
  const [kinds, setKinds] = React.useState<Set<NodeKind>>(
    () => new Set(KIND_ORDER),
  );
  const [panelOpen, setPanelOpen] = React.useState(false);

  React.useEffect(() => {
    // Obsidian keeps the panel open on desktop; phones start collapsed.
    setPanelOpen(window.innerWidth >= 768);
  }, []);

  // ── Mutable render state ────────────────────────────────────────────────
  const paletteRef = React.useRef<Palette | null>(null);
  const transformRef = React.useRef<Transform>({ k: 1, x: 0, y: 0 });
  const visibilityRef = React.useRef<Uint8Array>(new Uint8Array(nodes.length));
  /** Per-node display alpha, lerped toward its target — the Obsidian fade. */
  const alphaRef = React.useRef<Float32Array>(new Float32Array(nodes.length));
  const hoverRef = React.useRef<number | null>(null);
  const selectedRef = React.useRef<number | null>(null);
  const focusSetRef = React.useRef<Set<number>>(new Set());
  const lastFocusRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<number | null>(null);
  const dirtyRef = React.useRef(true);
  const simRef = React.useRef<ForceSimulation | null>(null);
  const settingsRef = React.useRef<GraphSettings>(DEFAULT_SETTINGS);
  const fitRef = React.useRef<(() => void) | null>(null);
  const fittedRef = React.useRef(false);
  /** Once the reader pans or zooms, auto-fit stops overriding their framing. */
  const userFramedRef = React.useRef(false);

  const markDirty = React.useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const patchSettings = React.useCallback((patch: Partial<GraphSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  // ── Simulation (built once) ─────────────────────────────────────────────
  const radii = React.useMemo(
    () =>
      nodes.map((node) => {
        const base =
          node.kind === "school" ? 7 : node.kind === "workflow" ? 6 : 4;
        return Math.min(base + Math.sqrt(node.degree) * 1.7, 20);
      }),
    [nodes],
  );

  // Rebuild whenever the node count changes — a data refresh (or Fast
  // Refresh in dev) must never leave the physics sized for the old graph.
  if (simRef.current === null || simRef.current.nodes.length !== nodes.length) {
    const links: SimLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      ...LINK_PHYSICS[e.kind],
    }));
    simRef.current = new ForceSimulation(nodes.length, links, radii);
    fittedRef.current = false;
  }
  if (visibilityRef.current.length !== nodes.length) {
    visibilityRef.current = new Uint8Array(nodes.length);
  }
  if (alphaRef.current.length !== nodes.length) {
    alphaRef.current = new Float32Array(nodes.length);
  }

  // Sliders → simulation constants. Force changes reheat so the layout morphs
  // live under the slider, which is what makes the Forces panel feel alive.
  const prevForcesRef = React.useRef<string>("");
  React.useEffect(() => {
    settingsRef.current = settings;
    const sim = simRef.current;
    if (sim) {
      sim.centerStrength = settings.centerForce * 0.004;
      sim.charge = -(8 + settings.repelForce * 72);
      sim.linkForceScale = settings.linkForce * 2;
      sim.linkDistanceScale = 0.5 + settings.linkDistance * 1.5;

      const signature = `${settings.centerForce}|${settings.repelForce}|${settings.linkForce}|${settings.linkDistance}`;
      if (prevForcesRef.current && prevForcesRef.current !== signature) {
        sim.reheat(0.4);
        fittedRef.current = false;
      }
      prevForcesRef.current = signature;
    }
    markDirty();
  }, [settings, markDirty]);

  // ── Neighbourhood expansion (the local-graph view) ──────────────────────
  const matches = React.useMemo(() => {
    const q = settings.query.trim().toLowerCase();
    if (!q) return null;
    const hits = new Set<number>();
    nodes.forEach((node, i) => {
      if (
        node.label.toLowerCase().includes(q) ||
        node.detail.toLowerCase().includes(q)
      ) {
        hits.add(i);
      }
    });
    return hits;
  }, [nodes, settings.query]);

  const neighbourhood = React.useMemo(() => {
    if (selected === null) return null;
    const seen = new Map<number, number>([[selected, 0]]);
    let frontier = [selected];
    for (let depth = 1; depth <= settings.hops; depth++) {
      const next: number[] = [];
      for (const node of frontier) {
        for (const neighbour of adjacency[node]) {
          if (seen.has(neighbour)) continue;
          seen.set(neighbour, depth);
          next.push(neighbour);
        }
      }
      frontier = next;
    }
    return seen;
  }, [selected, settings.hops, adjacency]);

  // Recompute per-node visibility whenever a filter input changes. Hiding
  // nodes (groups/orphans) also reflows the simulation — Obsidian filters
  // re-layout rather than leaving ghosts holding space open.
  const prevHiddenRef = React.useRef<string>("");
  React.useEffect(() => {
    const visibility = visibilityRef.current;
    const focusing = neighbourhood !== null || matches !== null;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (
        !kinds.has(node.kind) ||
        (!settings.showOrphans && node.degree === 0)
      ) {
        visibility[i] = HIDDEN;
        continue;
      }
      if (!focusing) {
        visibility[i] = NORMAL;
        continue;
      }
      const inNeighbourhood = neighbourhood?.has(i) ?? false;
      const isMatch = matches?.has(i) ?? false;
      if (i === selected) visibility[i] = FOCUS;
      else if (inNeighbourhood || isMatch) visibility[i] = NORMAL;
      else visibility[i] = DIM;
    }

    selectedRef.current = selected;

    const hiddenSignature = `${[...kinds].sort().join(",")}|${settings.showOrphans}`;
    if (prevHiddenRef.current && prevHiddenRef.current !== hiddenSignature) {
      simRef.current?.reheat(0.35);
      fittedRef.current = false;
    }
    prevHiddenRef.current = hiddenSignature;

    markDirty();
  }, [
    nodes,
    kinds,
    neighbourhood,
    matches,
    selected,
    settings.showOrphans,
    markDirty,
  ]);

  // ── Canvas sizing, palette, and the render loop ─────────────────────────
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const sim = simRef.current!;
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = shell.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      // Backing store matches the device pixel grid — text and 1px strokes
      // stay crisp on the Retina panel instead of resampling to mush.
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      sim.resize(width, height);
      markDirty();
    };

    paletteRef.current = readPalette(canvas);
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(shell);

    // next-themes swaps a class on <html>; re-read the tokens when it does.
    const themeObserver = new MutationObserver(() => {
      paletteRef.current = readPalette(canvas);
      markDirty();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    // Frame the settled layout to the viewport, so the graph fills the stage
    // instead of sitting as a small island in the middle of it. Skipped the
    // moment the reader pans or zooms — their framing wins from then on.
    const fitToView = () => {
      const visibility = visibilityRef.current;
      const scale = settingsRef.current.nodeScale;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (let i = 0; i < sim.nodes.length; i++) {
        if (visibility[i] === HIDDEN) continue;
        const node = sim.nodes[i];
        const r = radii[i] * scale;
        if (node.x - r < minX) minX = node.x - r;
        if (node.y - r < minY) minY = node.y - r;
        if (node.x + r > maxX) maxX = node.x + r;
        if (node.y + r > maxY) maxY = node.y + r;
      }
      if (!Number.isFinite(minX)) return;

      const pad = 48;
      const k = Math.min(
        MAX_ZOOM,
        Math.max(
          MIN_ZOOM,
          Math.min(
            (width - pad * 2) / Math.max(1, maxX - minX),
            (height - pad * 2) / Math.max(1, maxY - minY),
          ),
        ),
      );
      transformRef.current = {
        k,
        x: width / 2 - ((minX + maxX) / 2) * k,
        y: height / 2 - ((minY + maxY) / 2) * k,
      };
      markDirty();
    };

    fitRef.current = fitToView;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      // Converge without animating, then render the settled layout once.
      let guard = 0;
      while (sim.tick(null, visibilityRef.current) && guard++ < 600) {
        /* run to rest */
      }
      fitToView();
      fittedRef.current = true;
    }

    const draw = () => {
      const palette = paletteRef.current;
      if (!palette) return;
      const { k, x: tx, y: ty } = transformRef.current;
      const { nodeScale, linkWidth, textFade } = settingsRef.current;
      const visibility = visibilityRef.current;
      const alphas = alphaRef.current;
      const simNodes = sim.nodes;
      const hover = hoverRef.current;
      const active = selectedRef.current;

      // ── Alpha targets + lerp (the animated Obsidian fade) ───────────────
      // Hover deep-fades everything outside the hovered neighbourhood;
      // selection does the same via the visibility tiers. Alphas chase their
      // targets a step per frame, so focus changes glide instead of snapping.
      const focus = hover ?? active;
      if (focus !== lastFocusRef.current) {
        focusSetRef.current =
          focus !== null ? new Set(adjacency[focus]) : new Set();
        lastFocusRef.current = focus;
      }
      const focusSet = focusSetRef.current;

      let animating = false;
      const lerp = reducedMotion ? 1 : 0.16;
      for (let i = 0; i < nodes.length; i++) {
        let target: number;
        if (visibility[i] === HIDDEN) target = 0;
        else if (hover !== null) {
          target = i === hover || focusSet.has(i) ? 1 : 0.06;
        } else if (visibility[i] === DIM) {
          target = active !== null ? 0.08 : 0.15;
        } else target = 1;

        const diff = target - alphas[i];
        if (Math.abs(diff) > 0.004) {
          alphas[i] += diff * lerp;
          animating = true;
        } else alphas[i] = target;
      }
      if (animating) markDirty();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);

      // ── Edges, batched by quantized alpha ───────────────────────────────
      // Alphas vary continuously during transitions; quantizing into a few
      // buckets keeps it at ≤14 stroke calls instead of one per edge.
      const BUCKETS = 6;
      const normalBuckets: number[][] = Array.from(
        { length: BUCKETS },
        () => [],
      );
      const accentBuckets: number[][] = Array.from(
        { length: BUCKETS },
        () => [],
      );

      for (let i = 0; i < edges.length; i++) {
        const { source, target } = edges[i];
        const ea = Math.min(alphas[source], alphas[target]);
        if (ea < 0.02) continue;
        const isAccent =
          focus !== null && (source === focus || target === focus);
        const alpha = ea * (isAccent ? 0.9 : 0.2);
        const bucket = Math.min(BUCKETS - 1, Math.floor(alpha * BUCKETS));
        (isAccent ? accentBuckets : normalBuckets)[bucket].push(i);
      }

      const strokeBuckets = (
        buckets: number[][],
        colour: string,
        widthScale: number,
      ) => {
        for (let b = 0; b < BUCKETS; b++) {
          const indices = buckets[b];
          if (indices.length === 0) continue;
          ctx.globalAlpha = (b + 0.5) / BUCKETS;
          ctx.strokeStyle = colour;
          ctx.lineWidth = (widthScale * linkWidth) / k;
          ctx.beginPath();
          for (const i of indices) {
            const s = simNodes[edges[i].source];
            const target = simNodes[edges[i].target];
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(target.x, target.y);
          }
          ctx.stroke();
        }
      };
      strokeBuckets(normalBuckets, palette.muted, 1);
      strokeBuckets(accentBuckets, palette.foreground, 1.6);

      // ── Nodes ───────────────────────────────────────────────────────────
      const focusMode = focus !== null;
      for (let i = 0; i < nodes.length; i++) {
        const alpha = alphas[i];
        if (alpha < 0.02) continue;

        const sim0 = simNodes[i];
        const node = nodes[i];
        const isHot = i === hover || i === active;
        const inFocus = focusMode && (i === focus || focusSet.has(i));
        const r = radii[i] * nodeScale * (isHot ? 1.3 : 1);

        ctx.globalAlpha = alpha;
        ctx.save();
        if (inFocus) {
          // The glow that makes the hovered constellation float on dark.
          ctx.shadowColor = palette.kind[node.kind];
          ctx.shadowBlur = i === focus ? 18 : 9;
        }
        ctx.beginPath();
        ctx.arc(sim0.x, sim0.y, r, 0, Math.PI * 2);
        ctx.fillStyle = palette.kind[node.kind];
        ctx.fill();
        ctx.restore();

        if (isHot) {
          ctx.lineWidth = 2 / k;
          ctx.strokeStyle = palette.foreground;
          ctx.stroke();
        } else if (node.degree === 0) {
          // Orphans read as outlines — a visible gap in the brain.
          ctx.globalAlpha = alpha * 0.9;
          ctx.lineWidth = 1.5 / k;
          ctx.strokeStyle = palette.muted;
          ctx.stroke();
        } else if (alpha > 0.5) {
          // Surface-coloured ring: a 2px gap between touching marks, so a
          // dense cluster reads as many nodes rather than one blob.
          ctx.lineWidth = 2 / k;
          ctx.strokeStyle = palette.background;
          ctx.stroke();
        }
      }

      // ── Labels ──────────────────────────────────────────────────────────
      // Obsidian's text-fade: labels materialize as you zoom in. At rest only
      // cluster names and the highest-influence bridges are named; everything
      // else earns a label by focus, adjacency, or zoom.
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const threshold = 2.0 - textFade * 1.8;
      const zoomAlpha = Math.min(1, Math.max(0, (k - threshold) / 0.35));
      const influenceCutoff = width < 640 ? Infinity : LABEL_INFLUENCE;

      for (let i = 0; i < nodes.length; i++) {
        const nodeAlpha = alphas[i];
        if (nodeAlpha < 0.05) continue;

        const node = nodes[i];
        const isHot = i === hover || i === active;
        const inFocus = focusMode && (i === focus || focusSet.has(i));

        let labelAlpha = zoomAlpha;
        if (isHot || inFocus) labelAlpha = 1;
        else if (node.kind === "school")
          // A phone-width canvas can't seat 19 cluster names at once — there
          // they obey the zoom fade like everyone else.
          labelAlpha = width < 640 ? zoomAlpha : Math.max(zoomAlpha, 0.85);
        else if (node.influence >= influenceCutoff)
          labelAlpha = Math.max(zoomAlpha, 0.7);

        const finalAlpha = labelAlpha * nodeAlpha;
        if (finalAlpha < 0.04) continue;

        const sim0 = simNodes[i];
        const size = node.kind === "school" ? 12 : 10.5;
        ctx.font = `${isHot || node.kind === "school" ? 600 : 400} ${size}px ${palette.font}`;
        ctx.globalAlpha = finalAlpha;
        ctx.fillStyle = isHot ? palette.foreground : palette.muted;

        ctx.save();
        ctx.translate(
          sim0.x,
          sim0.y + radii[i] * nodeScale * (isHot ? 1.3 : 1) + 5 / k,
        );
        ctx.scale(1 / k, 1 / k);
        ctx.fillText(node.label, 0, 0);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
    };

    const loop = () => {
      const moving =
        !reducedMotion && sim.tick(dragRef.current, visibilityRef.current);
      if (!moving && !fittedRef.current && !userFramedRef.current) {
        fittedRef.current = true;
        fitToView();
      }
      if (moving || dirtyRef.current) {
        dirtyRef.current = false;
        draw();
      }
      frame = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
    };
    // The loop reads everything mutable through refs, so it is built once and
    // never torn down by hover, selection, filter, or slider changes.
  }, [nodes, edges, adjacency, radii, markDirty]);

  // ── Pointer interaction ─────────────────────────────────────────────────
  const pointersRef = React.useRef(new Map<number, { x: number; y: number }>());
  const panRef = React.useRef<{ x: number; y: number } | null>(null);
  const pinchRef = React.useRef<number | null>(null);
  const movedRef = React.useRef(false);

  const toWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { k, x, y } = transformRef.current;
    return {
      x: (clientX - rect.left - x) / k,
      y: (clientY - rect.top - y) / k,
    };
  };

  const pick = (clientX: number, clientY: number): number | null => {
    const sim = simRef.current!;
    const world = toWorld(clientX, clientY);
    const visibility = visibilityRef.current;
    const scale = settingsRef.current.nodeScale;
    let best: number | null = null;
    let bestDist = Infinity;

    for (let i = 0; i < sim.nodes.length; i++) {
      if (visibility[i] === HIDDEN) continue;
      const node = sim.nodes[i];
      const dx = node.x - world.x;
      const dy = node.y - world.y;
      const distSq = dx * dx + dy * dy;
      const hit = radii[i] * scale + 6;
      if (distSq <= hit * hit && distSq < bestDist) {
        bestDist = distSq;
        best = i;
      }
    }
    return best;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movedRef.current = false;

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = Math.hypot(a.x - b.x, a.y - b.y);
      panRef.current = null;
      dragRef.current = null;
      return;
    }

    const hit = pick(e.clientX, e.clientY);
    if (hit !== null) {
      dragRef.current = hit;
      simRef.current!.reheat(0.25);
    } else {
      panRef.current = {
        x: e.clientX - transformRef.current.x,
        y: e.clientY - transformRef.current.y,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      movedRef.current = true;
    }

    // Pinch zoom
    if (pointers.size === 2 && pinchRef.current !== null) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const midX = (a.x + b.x) / 2 - rect.left;
      const midY = (a.y + b.y) / 2 - rect.top;
      zoomAround(midX, midY, dist / pinchRef.current);
      pinchRef.current = dist;
      userFramedRef.current = true;
      markDirty();
      return;
    }

    // Node drag
    const dragging = dragRef.current;
    if (dragging !== null) {
      const world = toWorld(e.clientX, e.clientY);
      const node = simRef.current!.nodes[dragging];
      node.x = world.x;
      node.y = world.y;
      node.vx = 0;
      node.vy = 0;
      simRef.current!.reheat(0.3);
      markDirty();
      return;
    }

    // Background pan
    if (panRef.current) {
      transformRef.current.x = e.clientX - panRef.current.x;
      transformRef.current.y = e.clientY - panRef.current.y;
      userFramedRef.current = true;
      markDirty();
      return;
    }

    // Hover — kept in a ref; React only hears about it when the node changes.
    const hit = pick(e.clientX, e.clientY);
    if (hit !== hoverRef.current) {
      hoverRef.current = hit;
      setHovered(hit);
      markDirty();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchRef.current = null;

    const dragging = dragRef.current;
    // A press that never moved is a click, not a drag.
    if (dragging !== null && !movedRef.current) {
      setSelected((current) => (current === dragging ? null : dragging));
    } else if (dragging === null && panRef.current && !movedRef.current) {
      setSelected(null);
    }

    dragRef.current = null;
    panRef.current = null;
  };

  const zoomAround = (px: number, py: number, factor: number) => {
    const transform = transformRef.current;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, transform.k * factor));
    const worldX = (px - transform.x) / transform.k;
    const worldY = (py - transform.y) / transform.k;
    transform.k = next;
    transform.x = px - worldX * next;
    transform.y = py - worldY * next;
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Non-passive so the page doesn't scroll while zooming the graph.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAround(
        e.clientX - rect.left,
        e.clientY - rect.top,
        Math.pow(0.999, e.deltaY),
      );
      userFramedRef.current = true;
      markDirty();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [markDirty]);

  const resetView = React.useCallback(() => {
    setSelected(null);
    setSettings(DEFAULT_SETTINGS);
    setKinds(new Set(KIND_ORDER));
    userFramedRef.current = false;
    fittedRef.current = false;
    simRef.current?.reheat(0.5);
    markDirty();
  }, [markDirty]);

  const toggleKind = React.useCallback((kind: NodeKind) => {
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next.size === 0 ? new Set(KIND_ORDER) : next;
    });
  }, []);

  // ── Panel data ──────────────────────────────────────────────────────────
  const active = selected ?? hovered;
  const activeNode = active !== null ? nodes[active] : null;

  const relations = React.useMemo(() => {
    if (active === null) return [];
    const byKind = new Map<EdgeKind, number[]>();
    for (const edge of edges) {
      if (edge.source !== active && edge.target !== active) continue;
      const other = edge.source === active ? edge.target : edge.source;
      const bucket = byKind.get(edge.kind);
      if (bucket) bucket.push(other);
      else byKind.set(edge.kind, [other]);
    }
    return [...byKind.entries()];
  }, [active, edges]);

  const secondOrder = React.useMemo(() => {
    if (active === null) return [];
    const direct = new Set(adjacency[active]);
    const reached = new Set<number>();
    for (const neighbour of direct) {
      for (const hop of adjacency[neighbour]) {
        if (hop !== active && !direct.has(hop)) reached.add(hop);
      }
    }
    // Rank by influence — the co-citation notes worth reading first.
    return [...reached]
      .sort((a, b) => nodes[b].influence - nodes[a].influence)
      .slice(0, 8);
  }, [active, adjacency, nodes]);

  const matchCount = matches?.size ?? null;

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="flex h-[calc(100vh-var(--header-height)-var(--footer-height))] flex-col overflow-hidden bg-background"
    >
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Compass className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h1 className="truncate font-mono text-sm font-semibold">
              {t("title")}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span>
              {nodes.length} {t("nodes")}
            </span>
            <span aria-hidden>·</span>
            <span>
              {edges.length} {t("links")}
            </span>
            {orphanCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {orphanCount} {t("orphans")}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-pressed={panelOpen}
            title={t("settings")}
            aria-label={t("settings")}
            className={cn(
              "inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border transition-colors",
              panelOpen
                ? "border-foreground/30 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={resetView}
            title={t("reset")}
            aria-label={t("reset")}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Stage ─────────────────────────────────────────────────────── */}
      <div ref={shellRef} className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="img"
          aria-label={t("a11yCanvas")}
          className="size-full touch-none font-mono [cursor:grab] active:[cursor:grabbing]"
        />

        {matchCount === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center font-mono text-xs text-muted-foreground">
            {t("noMatches")}
          </p>
        )}

        {/* Settings panel — Obsidian anatomy: Filters / Groups / Display / Forces */}
        {panelOpen && (
          <div className="absolute start-4 top-4 z-20 max-h-[calc(100%-2rem)]">
            <GraphControls
              lang={lang}
              settings={settings}
              onChange={patchSettings}
              kinds={kinds}
              onToggleKind={toggleKind}
              counts={counts}
              onClose={() => setPanelOpen(false)}
            />
          </div>
        )}

        {!activeNode && (
          <p className="pointer-events-none absolute bottom-4 end-4 font-mono text-[10px] text-muted-foreground">
            {t("focusHint")}
          </p>
        )}

        {/* ── Inspector ───────────────────────────────────────────────── */}
        {activeNode && (
          <aside
            className="absolute end-4 top-4 z-20 flex max-h-[calc(100%-2rem)] w-72 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="mb-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: kindColor(activeNode.kind) }}
                  />
                  {isAr
                    ? KIND_LABELS[activeNode.kind].ar
                    : KIND_LABELS[activeNode.kind].en}
                </span>
                <h2 className="break-words font-mono text-sm font-semibold">
                  {activeNode.label}
                </h2>
              </div>
              {selected !== null && (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={t("reset")}
                  className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {activeNode.detail && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {activeNode.detail}
              </p>
            )}

            {activeNode.href && (
              <Link
                href={`/${lang}${activeNode.href}`}
                className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] transition-colors hover:border-foreground/30"
              >
                {t("openNote")}
                <ArrowUpRight className="size-3 rtl:-scale-x-100" />
              </Link>
            )}

            <dl className="flex gap-4 font-mono text-[11px]">
              <div>
                <dt className="text-muted-foreground">{t("degree")}</dt>
                <dd className="font-semibold">{activeNode.degree}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("influence")}</dt>
                <dd className="font-semibold">
                  {(activeNode.influence * 100).toFixed(0)}%
                </dd>
              </div>
            </dl>

            {relations.map(([kind, others]) => (
              <div key={kind}>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {isAr ? EDGE_LABELS[kind].ar : EDGE_LABELS[kind].en}
                </p>
                <div className="flex flex-wrap gap-1">
                  {others.map((other) => (
                    <button
                      key={other}
                      type="button"
                      onClick={() => setSelected(other)}
                      className="cursor-pointer rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:border-foreground/30"
                    >
                      {nodes[other].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {secondOrder.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Focus aria-hidden className="size-3" />
                  {t("secondOrder")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {secondOrder.map((other) => (
                    <button
                      key={other}
                      type="button"
                      onClick={() => setSelected(other)}
                      className="cursor-pointer rounded-md border border-dashed border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      {nodes[other].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Keyboard and screen-reader path into the same graph. */}
      <nav aria-label={t("a11yList")} className="sr-only">
        <ul>
          {nodes.map((node, i) => (
            <li key={node.id}>
              <button type="button" onClick={() => setSelected(i)}>
                {node.label} —{" "}
                {isAr ? KIND_LABELS[node.kind].ar : KIND_LABELS[node.kind].en}
                {` (${node.degree} ${t("links")})`}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
