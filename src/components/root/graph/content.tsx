import { type Locale } from "@/components/local/config";
import { getGraphData } from "./data";
import { GraphCanvas } from "./graph-canvas";

interface GraphContentProps {
  lang: Locale | string;
}

/**
 * Server component. Derives the graph and runs the centrality pass here, so
 * neither the 88KB spellbook module nor the O(V·E) analytics reach the browser.
 */
export default function GraphContent({ lang }: GraphContentProps) {
  const { nodes, edges } = getGraphData();

  return <GraphCanvas nodes={nodes} edges={edges} lang={lang} />;
}
