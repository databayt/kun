"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Renders a mermaid diagram. The fumadocs `remarkMdxMermaid` remark plugin
 * (wired in `source.config.ts`) rewrites ```mermaid code fences into
 * `<Mermaid chart="..." />`, and this component is registered in
 * `src/mdx-components.tsx` so MDX can resolve it. Mermaid is imported
 * dynamically so it never ships in the server bundle, and re-renders on theme
 * change to stay legible in light and dark.
 */
export function Mermaid({ chart }: { chart: string }) {
  const rawId = useId();
  // mermaid's render id becomes an HTML id + selector — strip non-letters.
  const id = `mmd${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let active = true;

    (async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose", // allow <br/> line breaks in node labels
        fontFamily: "inherit",
        theme: resolvedTheme === "dark" ? "dark" : "default",
      });
      try {
        const { svg } = await mermaid.render(id, chart);
        if (active) {
          setSvg(svg);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      active = false;
    };
  }, [chart, resolvedTheme, id]);

  if (error) {
    return (
      <pre className="my-6 overflow-x-auto rounded-lg border border-destructive/40 bg-muted p-4 text-xs text-destructive">
        mermaid render error: {error}
      </pre>
    );
  }

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
