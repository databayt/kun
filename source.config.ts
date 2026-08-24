import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import rehypePrettyCode from "rehype-pretty-code";

import { transformers } from "./src/lib/highlight-code";

export default defineConfig({
  mdxOptions: {
    remarkPlugins: (plugins) => [...plugins, remarkMdxMermaid],
    rehypePlugins: (plugins) => {
      plugins.shift();
      plugins.push([
        rehypePrettyCode as any,
        {
          theme: {
            dark: "github-dark",
            light: "github-light-default",
          },
          transformers,
        },
      ]);

      return plugins;
    },
  },
});

export const docs = defineDocs({
  dir: "content/docs",
});
