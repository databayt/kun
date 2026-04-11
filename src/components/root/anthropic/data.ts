export type AssetCategory =
  | "illustrations"
  | "engineering"
  | "research"
  | "values"
  | "ui-icons"
  | "maps"
  | "brand"
  | "partners"
  | "benchmarks"
  | "social"
  | "events"
  | "animations"
  | "fonts"
  | "documents"
  | "team"
  | "mars";

// Display order for categories
export const CATEGORY_ORDER: AssetCategory[] = [
  "illustrations",
  "engineering",
  "research",
  "values",
  "ui-icons",
  "maps",
  "brand",
  "partners",
  "benchmarks",
  "social",
  "events",
  "animations",
  "team",
  "fonts",
  "documents",
  "mars",
];

// Category → background color mapping (inspired by Anthropic's section theming)
export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  illustrations: "cycle",    // Uses last 15 colors from palette, cycling per asset
  engineering: "#141413",    // Slate Dark — dark terminal/code feel
  research: "#cbcadb",       // Heather — soft lavender for academic tone
  values: "#e3dacc",         // Oat — warm earthy for company culture
  "ui-icons": "#faf9f5",    // Ivory Light — clean, minimal for UI elements
  maps: "#bcd1ca",           // Cactus — geographic/nature teal
  brand: "#d97757",          // Clay — core brand orange
  partners: "#f5f4ed",       // Slate 100 — neutral canvas for logos
  benchmarks: "#e8e6dc",     // Slate 200 — data-table warmth
  social: "#ebcece",         // Coral — social/sharing pink warmth
  events: "#d97757",         // Clay — energetic event orange
  animations: "#141413",     // Slate Dark — dark canvas for motion
  team: "#e3dacc",           // Oat — warm people-photos backdrop
  fonts: "#f0eee6",          // Ivory Medium
  documents: "#e8e6dc",      // Slate 200
  mars: "#d97757",           // Clay — Mars red-orange
};


// S3 bucket: hogwarts-databayt | CloudFront: d1dlwtcfl0db67.cloudfront.net
export const CDN_BASE = "https://d1dlwtcfl0db67.cloudfront.net";

export interface Asset {
  key: string;
  url: string;
  sourceUrl: string;
  name: string;
  description: string;
  category: AssetCategory;
  format: "svg" | "png" | "jpg" | "webp" | "json" | "pdf" | "woff2" | "ttf" | "ico" | "mp4" | "wav";
  width?: number;
  height?: number;
  source: string;
  cdn: "databayt";
}

function a(
  key: string,
  sourceUrl: string,
  name: string,
  description: string,
  category: AssetCategory,
  format: Asset["format"],
  source: string,
  width?: number,
  height?: number,
): Asset {
  return {
    key,
    url: `${CDN_BASE}/${key}`,
    sourceUrl,
    name,
    description,
    category,
    format,
    source,
    cdn: "databayt",
    ...(width && height ? { width, height } : {}),
  };
}

export const LAST_CRAWLED = "2026-04-03";

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  illustrations: "Illustrations",
  engineering: "Engineering Blog",
  research: "Research",
  values: "Company Values",
  "ui-icons": "UI Icons",
  maps: "Maps",
  brand: "Brand & Logos",
  partners: "Partner Logos",
  benchmarks: "Benchmarks",
  social: "Social Cards",
  events: "Events",
  animations: "Animations",
  team: "Team",
  fonts: "Fonts",
  documents: "Documents",
  mars: "Claude on Mars",
};

// ═══════════════════════════════════════════════════════════════════════════
// 169 assets uploaded to S3 (hogwarts-databayt) → served via CloudFront
// ═══════════════════════════════════════════════════════════════════════════

export const assets: Asset[] = [
  // ── Brand & Logos ─────────────────────────────────────────────────────
  a("anthropic/brand/anthropic-wordmark.svg", "https://upload.wikimedia.org/wikipedia/commons/7/78/Anthropic_logo.svg", "Anthropic Wordmark", "Official Anthropic wordmark SVG", "brand", "svg", "wikimedia", 1024, 115),
  a("anthropic/brand/claude-wordmark.svg", "https://upload.wikimedia.org/wikipedia/commons/8/8a/Claude_AI_logo.svg", "Claude AI Wordmark", "Official Claude AI wordmark SVG", "brand", "svg", "wikimedia", 690, 148),
  a("anthropic/brand/claude-starburst.svg", "https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg", "Claude Starburst Symbol", "Claude AI starburst icon (#D97757)", "brand", "svg", "wikimedia", 1200, 1200),
  a("anthropic/brand/claude-favicon.svg", "https://claude.ai/favicon.svg", "Claude Favicon SVG", "Claude starburst favicon", "brand", "svg", "claude.ai", 248, 248),
  a("anthropic/brand/claude-apple-touch-icon.png", "https://claude.ai/apple-touch-icon.png", "Claude Apple Touch Icon", "512x512 apple touch icon", "brand", "png", "claude.ai", 512, 512),
  a("anthropic/brand/claude-favicon-32.png", "https://claude.ai/favicon-32x32.png", "Claude Favicon 32px", "Favicon 32x32 PNG", "brand", "png", "claude.ai", 32, 32),
  a("anthropic/brand/claude-og-image.png", "https://claude.ai/images/claude_ogimage.png", "Claude OG Image", "Claude.ai social sharing card", "brand", "png", "claude.ai", 434, 228),
  a("anthropic/brand/safari-pinned-tab.svg", "https://www.anthropic.com/images/icons/safari-pinned-tab.svg", "Safari Pinned Tab", "Safari pinned tab SVG icon", "brand", "svg", "anthropic.com"),
  a("anthropic/brand/logo-lottie.json", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/67d47b4c03b69d41f28cc15c_logo-lottie.json", "Anthropic Logo Lottie", "Animated Anthropic logo (Lottie JSON)", "brand", "json", "anthropic.com/events"),
  a("anthropic/brand/claude-status-banner.png", "https://dka575ofm4ao0.cloudfront.net/pages-transactional_logos/retina/362807/NEW_claude_status_banner-183284a4-558d-4835-b3a4-a601e0a4daa8.png", "Claude Status Banner", "Status page banner logo (retina)", "brand", "png", "status.claude.com"),
  a("anthropic/brand/opus-4-6-wordmark-desktop.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/cf1dd2167fcf12f5882333ddc58a5bc1f0026952-897x109.svg", "Opus 4.6 Wordmark (Desktop)", "Claude Opus 4.6 model wordmark", "brand", "svg", "anthropic.com/claude/opus", 897, 109),
  a("anthropic/brand/opus-4-6-wordmark-mobile.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/f880761f78784d4e468e6d6f0a8ccc96f88765f4-217x153.svg", "Opus 4.6 Wordmark (Mobile)", "Claude Opus 4.6 mobile wordmark", "brand", "svg", "anthropic.com/claude/opus", 217, 153),
  a("anthropic/brand/sonnet-4-6-wordmark-desktop.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/74d815931ecf4f5b94b2286e7880111df24201de-1680x166.svg", "Sonnet 4.6 Wordmark (Desktop)", "Claude Sonnet 4.6 model wordmark", "brand", "svg", "anthropic.com/claude/sonnet", 1680, 166),
  a("anthropic/brand/sonnet-4-6-wordmark-mobile.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/1199923fafdbe19ee2a20164da1e1530c6256607-258x142.svg", "Sonnet 4.6 Wordmark (Mobile)", "Claude Sonnet 4.6 mobile wordmark", "brand", "svg", "anthropic.com/claude/sonnet", 258, 142),
  a("anthropic/brand/haiku-4-5-wordmark-desktop.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/010a454678ca41505a40660f56af507bec9461ed-941x95.svg", "Haiku 4.5 Wordmark (Desktop)", "Claude Haiku 4.5 model wordmark", "brand", "svg", "anthropic.com/claude/haiku", 941, 95),
  a("anthropic/brand/haiku-4-5-wordmark-mobile.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/7b47432bfe62bdc19ba2559d70b9de5bd6229db0-238x142.svg", "Haiku 4.5 Wordmark (Mobile)", "Claude Haiku 4.5 mobile wordmark", "brand", "svg", "anthropic.com/claude/haiku", 238, 142),

  // ── Illustrations (1000x1000 SVGs) ────────────────────────────────────
  a("anthropic/illustrations/hand-head-node-think.svg", "https://cdn.sanity.io/images/4zrzovbb/website/46e4aa7ea208ed440d5bd9e9e3a0ee66bc336ff1-1000x1000.svg", "Hand HeadNodeThink", "Hand with head and thinking nodes", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/code-magnifier.svg", "https://cdn.sanity.io/images/4zrzovbb/website/1c3e87fd90491089b2971dc34f9f75bb8a80f713-1000x1000.svg", "Code Magnifier", "Code inspection with magnifying glass", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/node-head-constellation.svg", "https://cdn.sanity.io/images/4zrzovbb/website/60a35c504cedb3e3f581b211e4b8aef372ffe031-1000x1000.svg", "Node-Head-Constellation", "Head with constellation of neural nodes", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hourglass-cosmic.svg", "https://cdn.sanity.io/images/4zrzovbb/website/ac2fa660649f361111949b32136a308ef35b6864-1000x1000.svg", "Hourglass Cosmic", "Cosmic hourglass illustration", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-node-line.svg", "https://cdn.sanity.io/images/4zrzovbb/website/1576ae23eaf481f33bd36ab468171cc69d12361a-1000x1000.svg", "Hand NodeLine", "Hand with network line nodes", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-node-pair.svg", "https://cdn.sanity.io/images/4zrzovbb/website/9f6a378a1e3592cf8d27447457409ba12284faef-1000x1000.svg", "Hand NodePair", "Hand with paired nodes", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-node-graph.svg", "https://cdn.sanity.io/images/4zrzovbb/website/c1ef4c0b6882dfe985555b52999d370ea88a3c50-1000x1000.svg", "Hand NodeGraph", "Hand with node graph / flower petals", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/node-branch.svg", "https://cdn.sanity.io/images/4zrzovbb/website/6b1470e7fa2fb7280502291f204b88c412690076-1000x1000.svg", "Node Branch", "Branching node structure", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/node-constitution.svg", "https://cdn.sanity.io/images/4zrzovbb/website/e69f9d8245799a0c2688d72e997f708475233d6b-1000x1000.svg", "Node-Constitution", "Constitutional governance nodes", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-abacus.svg", "https://cdn.sanity.io/images/4zrzovbb/website/f06ca06f9d08ca4a85f26357eb896c3730274507-1000x1000.svg", "Hand Abacus", "Hand with abacus (computation)", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/lamp-paper.svg", "https://cdn.sanity.io/images/4zrzovbb/website/77dd9077412abc790bf2bc6fa3383b37724d6305-1000x1000.svg", "LampPaper", "Lamp and paper / research", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-reflection.svg", "https://cdn.sanity.io/images/4zrzovbb/website/710b64c2542329ce05316098b4e405bb1c11e4d4-1000x1000.svg", "Hand Reflection", "Hand with reflection / mirror", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-keyboard.svg", "https://cdn.sanity.io/images/4zrzovbb/website/83d7d2fe412ceb4dfe627f0d5f3d64aff1a3f5db-1000x1000.svg", "Hand Keyboard", "Hand with keyboard", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-node-book.svg", "https://cdn.sanity.io/images/4zrzovbb/website/1c3d1af62032009538b8bf5864139ca124b06741-1000x1000.svg", "Hand NodeBook", "Hand with node book", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-key.svg", "https://cdn.sanity.io/images/4zrzovbb/website/036c01a9e427ea0f4d1e6c7221e4f6dce2259bf7-1000x1000.svg", "Hand Key", "Hand holding a key", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-build.svg", "https://cdn.sanity.io/images/4zrzovbb/website/cd4fd51deacd067d4e30aee4f4b149f6cba1b97b-1000x1000.svg", "Hand Build", "Hand building / constructing", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-puzzle.svg", "https://cdn.sanity.io/images/4zrzovbb/website/0df729ce74e4c9dd62c3342c9549ce6c7cef1202-1000x1000.svg", "Hand Puzzle", "Hand with puzzle piece / code brackets", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/node-box.svg", "https://cdn.sanity.io/images/4zrzovbb/website/e750c875fbd7f08ffb6495efa180a8ed60de3611-1000x1000.svg", "Node Box", "Box with network nodes", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/scale-shapes.svg", "https://cdn.sanity.io/images/4zrzovbb/website/97cf99624aa60f59b75f9e08cdf0f00d33c34804-1000x1000.svg", "ScaleShapes", "Scaling shapes / geometric", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-node-tree.svg", "https://cdn.sanity.io/images/4zrzovbb/website/74409af25137110ac04cc39e4d5ea0a2fbcea421-1000x1000.svg", "Hand NodeTree", "Hand with tree of nodes", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/chat.svg", "https://cdn.sanity.io/images/4zrzovbb/website/8d339ae8ecedecc1409db8f5bbb99c958db56946-1000x1000.svg", "Chat", "Chat conversation illustration", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/hand-node-slide.svg", "https://cdn.sanity.io/images/4zrzovbb/website/6507d83d1197bb8630131d363fb8bea838d79ca7-1000x1000.svg", "Hand NodeSlide", "Hand with sliding nodes", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/puzzle.svg", "https://cdn.sanity.io/images/4zrzovbb/website/43abe7e54b56a891e74a8542944dfbd33f07f49c-1000x1000.svg", "Puzzle", "Puzzle pieces illustration", "illustrations", "svg", "anthropic.com/research", 1000, 1000),
  a("anthropic/illustrations/node-globe.svg", "https://cdn.sanity.io/images/4zrzovbb/website/5f455d24ea80569b34eb4347f06152d8a5508722-1000x1000.svg", "Node Globe", "Globe with network nodes", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-house.svg", "https://cdn.sanity.io/images/4zrzovbb/website/cd9cf56a7f049285b7c1c8786c0a600cf3d7f317-1000x1000.svg", "Hand House", "Hand with house (safe space)", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-shape-build.svg", "https://cdn.sanity.io/images/4zrzovbb/website/6905c83d0735e1bc430025fdd1748d1406079036-1000x1000.svg", "Hand ShapeBuild", "Hand building with shapes", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/object-desktop-balance.svg", "https://cdn.sanity.io/images/4zrzovbb/website/589b94b913c4cee1c3c1ce2cb04f638d09c465b1-1000x1000.svg", "Object Desktop (Balance)", "Desktop with balance scale", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/object-book.svg", "https://cdn.sanity.io/images/4zrzovbb/website/9dc697ebe294bef5961c93928128a9b561fc1f66-1000x1000.svg", "Object Book", "Book illustration", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-globe.svg", "https://cdn.sanity.io/images/4zrzovbb/website/b68cbb43d7c8f56f0b14cc867e8d4d74445f78b0-1000x1000.svg", "Hand Globe", "Hand holding a globe", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/node-cursor.svg", "https://cdn.sanity.io/images/4zrzovbb/website/8925ac952fa2cb8eb5e845b2e44f3e71b33fd695-1000x1000.svg", "Node Cursor", "Cursor with network nodes", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-quill.svg", "https://cdn.sanity.io/images/4zrzovbb/website/33dbe8f783d4835a838b4c4ae85d3c04e352fee1-1000x1000.svg", "Hand Quill", "Hand with quill pen", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/object-lock.svg", "https://cdn.sanity.io/images/4zrzovbb/website/e029027e0b3beeb5b629bd4a26143597e7775b38-1000x1000.svg", "Object Lock", "Lock / security illustration", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/object-laptop-secure.svg", "https://cdn.sanity.io/images/4zrzovbb/website/802260d34a0653f23fd4944fae43064df367aa44-1000x1000.svg", "Object LaptopSecure", "Laptop with security shield", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/object-government.svg", "https://cdn.sanity.io/images/4zrzovbb/website/6e00dbffcddc82df5e471c43453abfc74ca94e8d-1000x1000.svg", "Object Government", "Government building illustration", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/object-globe-detailed.svg", "https://cdn.sanity.io/images/4zrzovbb/website/ffc0d7957a232518519f13c0d64896921ea215e2-1000x1000.svg", "Object Globe (Detailed)", "Detailed globe with map lines", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-shape-arrow.svg", "https://cdn.sanity.io/images/4zrzovbb/website/a62b6eb169818f14c35b7a192af269e283f8fa93-1000x1000.svg", "Hand ShapeArrow", "Hand with arrow shapes", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-bar-chart.svg", "https://cdn.sanity.io/images/4zrzovbb/website/e44a6b53398f189b9fd0d4f70516db614ac84db3-1000x1000.svg", "Hand BarChart", "Hand with bar chart / analytics", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-head-node.svg", "https://cdn.sanity.io/images/4zrzovbb/website/f8f4644253bde2f901550431b871b6dcf91e5d9d-1000x1000.svg", "Hand HeadNode", "Hand with head and single node", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-book.svg", "https://cdn.sanity.io/images/4zrzovbb/website/423062049d4676b41d52b16068cbb5e21603190e-1000x1000.svg", "Hand Book", "Hand holding open book", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/object-double-helix.svg", "https://cdn.sanity.io/images/4zrzovbb/website/d6058e0db8e477dc782dacae46e2ec6663d165d9-1000x1000.svg", "Object DoubleHelix", "DNA double helix / science", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-telescope.svg", "https://cdn.sanity.io/images/4zrzovbb/website/c9d8dd2af6d065e1ace8bd4bb29c716eb53ffffb-1000x1000.svg", "Hand Telescope", "Hand with telescope / vision", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/hand-head-bolt.svg", "https://cdn.sanity.io/images/4zrzovbb/website/6457c34fbcb012acf0f27f15a6006f700d0f50de-1000x1000.svg", "Hand HeadBolt", "Hand with head and lightning bolt", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/object-code-chat.svg", "https://cdn.sanity.io/images/4zrzovbb/website/225a673c4c38ae4b0d89639836c93b27e363f185-1000x1000.svg", "Object CodeChatCode", "Code brackets with chat bubbles", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/object-heartbeat.svg", "https://cdn.sanity.io/images/4zrzovbb/website/a5be087781bd5c60788beba7d8148d147bc4d0ed-1000x1000.svg", "Object Heartbeat", "Heartbeat / health illustration", "illustrations", "svg", "anthropic.com/news", 1000, 1000),
  a("anthropic/illustrations/transparency-hub-hero.svg", "https://cdn.sanity.io/images/4zrzovbb/website/3e4133edf828c818931bcfb6433836d0e6f21e4a-1300x1241.svg", "Transparency Hub Hero", "Transparency hub hero illustration", "illustrations", "svg", "anthropic.com/transparency", 1300, 1241),
  a("anthropic/illustrations/rsp-policy-badge.svg", "https://cdn.sanity.io/images/4zrzovbb/website/87fb2c684ff3d95b4fa9edf208af33f467a8af5b-1000x1000.svg", "RSP Policy Badge", "Responsible Scaling Policy hero", "illustrations", "svg", "anthropic.com/responsible-scaling-policy", 1000, 1000),
  a("anthropic/illustrations/notebook-pages.svg", "https://cdn.sanity.io/images/4zrzovbb/website/928166e443bc1b1f19ebadf4fd11b7c45fce4153-1000x1000.svg", "Notebook Pages", "Large notebook with pages", "illustrations", "svg", "anthropic.com/responsible-scaling-policy", 1000, 1000),
  a("anthropic/illustrations/constitution-icon.svg", "https://cdn.sanity.io/images/4zrzovbb/website/a542a6657627a5e114365ca69168490c5e8b0443-1000x1000.svg", "Constitution Icon", "Anthropic constitution icon", "illustrations", "svg", "anthropic.com/constitution", 1000, 1000),

  // ── Company Values ────────────────────────────────────────────────────
  a("anthropic/values/hold-light-and-shade.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/39db33950eb113e504a5b9fc56db490a64673e96-1000x1000.svg", "Hold Light and Shade", "Hand balancing scale - company value", "values", "svg", "anthropic.com/careers", 1000, 1000),
  a("anthropic/values/be-good-to-users.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/3da76509c888ac18be74e3e9dc0752c66d1a8202-1000x1000.svg", "Be Good to Users", "Hand holding heart - company value", "values", "svg", "anthropic.com/careers", 1000, 1000),
  a("anthropic/values/race-to-the-top.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/b1ce510c468b2920d4f8f61c17a50906801f939a-1000x1000.svg", "Race to the Top", "Hand with shield - company value", "values", "svg", "anthropic.com/careers", 1000, 1000),
  a("anthropic/values/put-mission-first.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/60d39963d844bc1104a780c762c540c9ba1baefe-1000x1000.svg", "Put Mission First", "Hand with megaphone - company value", "values", "svg", "anthropic.com/careers", 1000, 1000),

  // ── Engineering Blog SVGs ─────────────────────────────────────────────
  a("anthropic/engineering/infrastructure-noise.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/d428d11fcf4123ff0d0859d03fba459ad4d3d01a-2554x2554.svg", "Infrastructure Noise", "Engineering article illustration", "engineering", "svg", "anthropic.com/engineering", 2554, 2554),
  a("anthropic/engineering/claude-code-auto-mode.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/b87185e4d533134bc3f9b949a874396dcfcb2e80-500x500.svg", "Claude Code Auto Mode", "Auto mode article", "engineering", "svg", "anthropic.com/engineering", 500, 500),
  a("anthropic/engineering/harness-design.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/af0acebfbd57ac4b26ae7d7ae124d7326a3e47e4-1200x1200.svg", "Harness Design", "Harness design for long-running apps", "engineering", "svg", "anthropic.com/engineering", 1200, 1200),
  a("anthropic/engineering/browsecomp-eval.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/641d32b3291956d595c7e820d5bf94c5f44baa28-500x500.svg", "BrowseComp Eval", "BrowseComp eval awareness", "engineering", "svg", "anthropic.com/engineering", 500, 500),
  a("anthropic/engineering/c-compiler.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/44e93e074d53285f64ff717365b04c4a2164a445-1200x1200.svg", "C Compiler", "Building a C compiler article", "engineering", "svg", "anthropic.com/engineering", 1200, 1200),
  a("anthropic/engineering/ai-resistant-evaluations.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/dc34c3eeae881b105ef652d5630d84de6a1fa01a-1200x1200.svg", "AI-Resistant Evaluations", "AI-resistant technical evaluations", "engineering", "svg", "anthropic.com/engineering", 1200, 1200),
  a("anthropic/engineering/advanced-tool-use.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/2aa849e93e76ae567502dcae2db8921062531fa1-500x500.svg", "Advanced Tool Use", "Advanced tool use article", "engineering", "svg", "anthropic.com/engineering", 500, 500),
  a("anthropic/engineering/mcp-code-execution.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/848e961961a97ada3a7edb2d1d17378792c3288d-500x500.svg", "MCP Code Execution", "Code execution with MCP", "engineering", "svg", "anthropic.com/engineering", 500, 500),
  a("anthropic/engineering/claude-code-sandboxing.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/33d37e1ae729f4e960d11fecf143ac14c0fb369d-500x500.svg", "Claude Code Sandboxing", "Sandboxing article", "engineering", "svg", "anthropic.com/engineering", 500, 500),
  a("anthropic/engineering/effective-harnesses.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/c041b5e0498972014414a7c3d044727982f26bde-500x500.svg", "Effective Harnesses", "Effective harnesses for agents", "engineering", "svg", "anthropic.com/engineering", 500, 500),
  a("anthropic/engineering/context-engineering.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/a048404a96b599af98c05da5bdd1db07222e4e7b-500x500.svg", "Context Engineering", "Context engineering for agents", "engineering", "svg", "anthropic.com/engineering", 500, 500),
  a("anthropic/engineering/writing-tools-for-agents.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/b4fe0845239779c6fc1e045edb6272c3f500944a-500x500.svg", "Writing Tools for Agents", "Writing tools article", "engineering", "svg", "anthropic.com/engineering", 500, 500),
  a("anthropic/engineering/desktop-extensions.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/dde35f184e14e5c37b0b3ab5a1c0bbad06ac123b-500x500.svg", "Desktop Extensions", "Desktop extensions article", "engineering", "svg", "anthropic.com/engineering", 500, 500),
  a("anthropic/engineering/claude-code-best-practices.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/c423cdaa6733c03a5d10f38c76e1ecf1900c6716-1200x1200.svg", "Claude Code Best Practices", "Best practices article", "engineering", "svg", "anthropic.com/engineering", 1200, 1200),
  a("anthropic/engineering/think-tool.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/461ea9ed02230ba02ab830e5a5b23df66ea23bc8-1200x1200.svg", "Think Tool", "Claude think tool article", "engineering", "svg", "anthropic.com/engineering", 1200, 1200),
  a("anthropic/engineering/swe-bench-sonnet.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/ef693b8c4ebfcead4e17af7bd87b66f8bc70b8cc-1200x1200.svg", "SWE-bench Sonnet", "SWE-bench Sonnet article", "engineering", "svg", "anthropic.com/engineering", 1200, 1200),
  a("anthropic/engineering/building-effective-agents.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/14b20fce6e93c79be47352da0fa4bebd597ebfa8-1200x1200.svg", "Building Effective Agents", "Building effective agents article", "engineering", "svg", "anthropic.com/engineering", 1200, 1200),

  // ── Partner Logos ─────────────────────────────────────────────────────
  a("anthropic/partners/replit.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/ff1601aa704506064c9ddee37079f17f9b0799cd-150x48.svg", "Replit", "Replit logo", "partners", "svg", "anthropic.com/claude/opus", 150, 48),
  a("anthropic/partners/asana.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/6d031c0893b24dd00e9f207c7635d6b91d809729-124x24.svg", "Asana", "Asana logo", "partners", "svg", "anthropic.com/claude/opus", 124, 24),
  a("anthropic/partners/notion.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/7cfef6cd8ce2515a6abd52560ac4189f89f9ad35-116x40.svg", "Notion", "Notion logo", "partners", "svg", "anthropic.com/claude/opus", 116, 40),
  a("anthropic/partners/cognition.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/da50e4c43d4b95fe1a2105c344050c6ba2397f3f-150x48.svg", "Cognition", "Cognition (Devin) logo", "partners", "svg", "anthropic.com/claude/opus", 150, 48),
  a("anthropic/partners/cursor.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/d74b2a5f8dc7d22b0febb8c69feabff0999da79d-151x36.svg", "Cursor", "Cursor IDE logo", "partners", "svg", "anthropic.com/claude/opus", 151, 36),
  a("anthropic/partners/harvey.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/501ebc6538c68e98ae6cfab79a5747009700f4a1-100x30.svg", "Harvey", "Harvey AI logo", "partners", "svg", "anthropic.com/claude/opus", 100, 30),
  a("anthropic/partners/rakuten.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/652c487024ae6e67508571e7e5f64b7d482bdadd-150x48.svg", "Rakuten", "Rakuten logo", "partners", "svg", "anthropic.com/claude/opus", 150, 48),
  a("anthropic/partners/lovable.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/96f4d2262959c4c1ecdc9dc2d93b9087115d789f-140x26.svg", "Lovable", "Lovable logo", "partners", "svg", "anthropic.com/claude/opus", 140, 26),
  a("anthropic/partners/bolt.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/ade72922c1b58726e1b7c17f0e500054e3d74aa0-92x37.svg", "Bolt", "Bolt.new logo", "partners", "svg", "anthropic.com/claude/opus", 92, 37),
  a("anthropic/partners/ramp.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/1919e4705bd67f47c2f5bfe4950d0d2969dfaf4d-118x32.svg", "Ramp", "Ramp logo", "partners", "svg", "anthropic.com/claude/opus", 118, 32),
  a("anthropic/partners/sentinelone.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/6e6ecfcd7c8ed79ef1c46cc27c4ecc4ab1ca7490-219x42.svg", "SentinelOne", "SentinelOne logo", "partners", "svg", "anthropic.com/claude/opus", 219, 42),
  a("anthropic/partners/github.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/7522fc92399dcb4a68f11c7e147e711fcadbe75b-126x36.svg", "GitHub", "GitHub logo", "partners", "svg", "anthropic.com/claude/opus", 126, 36),
  a("anthropic/partners/palantir.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/db59fdbf8e7fa64d1bfcafecb933917ccd33f79a-140x34.svg", "Palantir", "Palantir logo", "partners", "svg", "anthropic.com/claude/opus", 140, 34),
  a("anthropic/partners/thomson-reuters.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/ff031ea5953adc10e50782ff6c8124ad6ce28ba6-213x31.svg", "Thomson Reuters", "Thomson Reuters logo", "partners", "svg", "anthropic.com/claude/opus", 213, 31),
  a("anthropic/partners/figma.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/eba077a5df68d0e74010602595c597520c850a0d-80x30.svg", "Figma", "Figma logo", "partners", "svg", "anthropic.com/claude/opus", 80, 30),
  a("anthropic/partners/shopify.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/84a8b2df3606dc68dda827c8e457144c6bb633b8-148x43.svg", "Shopify", "Shopify logo", "partners", "svg", "anthropic.com/claude/opus", 148, 43),
  a("anthropic/partners/box.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/49b99af78924f43f878d39a25d574da293c68596-60x32.svg", "Box", "Box logo", "partners", "svg", "anthropic.com/claude/opus", 60, 32),
  a("anthropic/partners/windsurf.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/7415f908eca858ec4c3453c5d8151e46a0fb1e6d-150x48.svg", "Windsurf", "Windsurf (Codeium) logo", "partners", "svg", "anthropic.com/claude/opus", 150, 48),
  a("anthropic/partners/augment.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/f33102478c7f5cc19de9c7aeea317ce9f8721a6a-191x26.svg", "Augment", "Augment Code logo", "partners", "svg", "anthropic.com/claude/opus", 191, 26),
  a("anthropic/partners/nbim.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/5d27d5fd738921411bb1e39bc27c396c6c075b4b-157x38.svg", "NBIM", "Norges Bank Investment Management", "partners", "svg", "anthropic.com/claude/opus", 157, 38),
  a("anthropic/partners/vercel-v0.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/9f4b0bb77875debc1a7af803741a56da3482972b-120x24.svg", "Vercel / v0", "Vercel v0 logo", "partners", "svg", "anthropic.com/claude/opus", 120, 24),
  a("anthropic/partners/elicit.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/8c153469c592cbedc960e3fb424dfd752f1f00bd-132x36.svg", "Elicit", "Elicit logo", "partners", "svg", "anthropic.com/claude/opus", 132, 36),
  a("anthropic/partners/factory.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/d63496e64e1df5ab874fcbb53fdd7cf4ebbb6faf-164x24.svg", "Factory", "Factory logo", "partners", "svg", "anthropic.com/claude/opus", 164, 24),
  a("anthropic/partners/hex.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/17ae0c7a20f0ed1247c21a3fe65dcc7d88696de6-104x40.svg", "Hex", "Hex logo", "partners", "svg", "anthropic.com/claude/opus", 104, 40),
  a("anthropic/partners/hebbia.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/aad0da69057f1510832dbb52e56a7dc96f352c17-136x24.svg", "Hebbia", "Hebbia logo", "partners", "svg", "anthropic.com/claude/opus", 136, 24),
  a("anthropic/partners/greptile.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/fc34c8fa8fc563302d37e13bf4485b8f855b7d47-578x160.svg", "Greptile", "Greptile logo", "partners", "svg", "anthropic.com/claude/opus", 578, 160),
  a("anthropic/partners/quantium.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/40ca41da6a9c5c318d7032e72b56a477ee8bb23b-148x38.svg", "Quantium", "Quantium logo", "partners", "svg", "anthropic.com/claude/opus", 148, 38),
  a("anthropic/partners/atlassian.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/9cdf5ed2ae750f0b6795490071eed41576bd1e1a-189x24.svg", "Atlassian", "Atlassian logo", "partners", "svg", "anthropic.com/claude/sonnet", 189, 24),
  a("anthropic/partners/postman.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/af30f9e79df810a09be342cd95bc88538a266f42-382x115.svg", "Postman", "Postman logo", "partners", "svg", "anthropic.com/claude/sonnet", 382, 115),
  a("anthropic/partners/zapier.svg", "https://www-cdn.anthropic.com/images/4zrzovbb/website/08635efbe5b258fa2b79ce7153c142ce104db879-104x28.svg", "Zapier", "Zapier logo", "partners", "svg", "anthropic.com/claude/sonnet", 104, 28),

  // ── Benchmark Charts ──────────────────────────────────────────────────
  a("anthropic/benchmarks/gdpval-aa-knowledge-work.png", "https://cdn.sanity.io/images/4zrzovbb/website/6e29759b50e8b3a8363b38b1f573d854df968671-3840x2160.png", "GDPval-AA Knowledge Work", "Knowledge work benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/deepsearchqa-agentic.png", "https://cdn.sanity.io/images/4zrzovbb/website/018d6d882034d50727948b22e3ad3844a43ee09c-3840x2160.png", "DeepSearchQA Agentic", "Agentic search benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/terminal-bench-2-coding.png", "https://cdn.sanity.io/images/4zrzovbb/website/b8cfd7ebd6c82febce5f428f519d68a5dcf5d16f-3840x2160.png", "Terminal-Bench 2 Coding", "Coding benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/expert-reasoning.png", "https://cdn.sanity.io/images/4zrzovbb/website/b8d511155f209c57e4d6a92ab115ebfc7c8832ff-3840x2160.png", "Expert Reasoning", "Reasoning benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/long-context-retrieval.png", "https://cdn.sanity.io/images/4zrzovbb/website/ae7ae61aefff3c9b059975957335785f8ebd59d6-3840x2160.png", "Long-Context Retrieval", "Long-context retrieval benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/long-context-reasoning.png", "https://cdn.sanity.io/images/4zrzovbb/website/9a32a76a983d4c8f709683b38ff3af6664b5128a-3840x2160.png", "Long-Context Reasoning", "Long-context reasoning benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/root-cause-analysis.png", "https://cdn.sanity.io/images/4zrzovbb/website/653e04afc43612d3a0f8427da86b6549800005f9-3840x2160.png", "Root Cause Analysis", "Root cause analysis benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/multilingual-coding.png", "https://cdn.sanity.io/images/4zrzovbb/website/542044519014a793cf042a08a730ebd8977c57b0-3840x2160.png", "Multilingual Coding", "Multilingual coding benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/long-term-coherence.png", "https://cdn.sanity.io/images/4zrzovbb/website/6c1b33e985bcae9163b77bc25620e85abd5d9a7b-3840x2160.png", "Long-Term Coherence", "Long-term coherence benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/cybersecurity.png", "https://cdn.sanity.io/images/4zrzovbb/website/8a421f45125743fd9e9078aae992c6e5f236a3da-3840x2160.png", "Cybersecurity", "Cybersecurity benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/life-sciences.png", "https://cdn.sanity.io/images/4zrzovbb/website/f7dff66d47d54dfaabddc82bf9b96658df00634a-3840x2160.png", "Life Sciences", "Life sciences benchmark", "benchmarks", "png", "anthropic.com/claude/opus", 3840, 2160),
  a("anthropic/benchmarks/opus-benchmark-table.png", "https://www-cdn.anthropic.com/images/4zrzovbb/website/f3860f2517f355c24fbdc3b5ac8d1460d7c1e8a5-2600x2968.png", "Opus Benchmark Table", "Full benchmark comparison (Opus)", "benchmarks", "png", "anthropic.com/claude/opus", 2600, 2968),
  a("anthropic/benchmarks/sonnet-benchmark-table.png", "https://www-cdn.anthropic.com/images/4zrzovbb/website/9a27a40207eb06287bfcdb6a74aba8420a4fdb26-2600x2960.png", "Sonnet Benchmark Table", "Full benchmark comparison (Sonnet)", "benchmarks", "png", "anthropic.com/claude/sonnet", 2600, 2960),

  // ── Social / OG Cards ─────────────────────────────────────────────────
  a("anthropic/social/default-og.jpg", "https://cdn.sanity.io/images/4zrzovbb/website/c07f638082c569e8ce1e89ae95ee6f332a98ec08-2400x1260.jpg", "Anthropic Default OG", "Default social sharing card", "social", "jpg", "anthropic.com", 2400, 1260),
  a("anthropic/social/opus-4-6-card.jpg", "https://cdn.sanity.io/images/4zrzovbb/website/32d7f6f9e251f4885b84ee8d5cd72540dd9a6b38-2400x1260.jpg", "Opus 4.6 Social Card", "Opus 4.6 sharing card", "social", "jpg", "anthropic.com/claude/opus", 2400, 1260),
  a("anthropic/social/opus-4-6-announcement.png", "https://cdn.sanity.io/images/4zrzovbb/website/01d06528567e4bd22c3ddedc87f609ee5716a009-2400x1260.png", "Opus 4.6 Announcement", "Opus 4.6 announcement card", "social", "png", "anthropic.com/news/claude-opus-4-6", 2400, 1260),
  a("anthropic/social/haiku-4-5-card.jpg", "https://cdn.sanity.io/images/4zrzovbb/website/e256440534a1c8ecc85c745a451cd8725e6c00b4-2400x1260.jpg", "Haiku 4.5 Social Card", "Haiku 4.5 sharing card", "social", "jpg", "anthropic.com/claude/haiku", 2400, 1260),
  a("anthropic/social/academy-card.png", "https://cdn.sanity.io/images/4zrzovbb/website/c4bd33e7c8e809a2f9a9a5896ee13961e2a738ec-2400x1260.png", "Academy Card", "Anthropic Academy social card", "social", "png", "anthropic.com/learn", 2400, 1260),
  a("anthropic/social/space-to-think.png", "https://cdn.sanity.io/images/4zrzovbb/website/5b3eb6e1368dfeeaa206fd0bee001f58d9e2ea36-1920x1080.png", "Space to Think", "Claude is a space to think", "social", "png", "anthropic.com/news", 1920, 1080),
  a("anthropic/social/rsp-card.png", "https://cdn.sanity.io/images/4zrzovbb/website/f206078bb0920966fe2255156c317f4274ebe652-2400x1260.png", "RSP Card", "Responsible Scaling Policy card", "social", "png", "anthropic.com/responsible-scaling-policy", 2400, 1260),
  a("anthropic/social/economic-futures-card.png", "https://cdn.sanity.io/images/4zrzovbb/website/d63af41b0aa9d5531ac43fec0cb018b3d476f230-1900x1000.png", "Economic Futures Card", "Economic Futures social card", "social", "png", "anthropic.com/economic-futures", 1900, 1000),
  a("anthropic/social/featured-hero.png", "https://www-cdn.anthropic.com/images/4zrzovbb/website/a9200829eaf63ae342ede66e46d7439367a705bc-1920x1080.png", "Featured Hero", "Main featured hero image", "social", "png", "anthropic.com", 1920, 1080),

  // ── Research Images ───────────────────────────────────────────────────
  a("anthropic/research/constitutional-classifiers.jpg", "https://cdn.sanity.io/images/4zrzovbb/website/ac8a8d902d506953105e80ea8ee0363c3a02dbc2-1800x1013.jpg", "Constitutional Classifiers", "Constitutional classifiers research", "research", "jpg", "anthropic.com/research", 1800, 1013),
  a("anthropic/research/assistant-axis.png", "https://cdn.sanity.io/images/4zrzovbb/website/021f5a89f9b3ba1755f9a2315bc63be855259532-3840x1762.png", "Assistant Axis", "Assistant axis visualization", "research", "png", "anthropic.com/research", 3840, 1762),
  a("anthropic/research/how-people-use-claude.png", "https://cdn.sanity.io/images/4zrzovbb/website/77411b5a7049200a7021270a6c44101d5b228ab9-1681x1261.png", "How People Use Claude", "Support, advice, companionship", "research", "png", "anthropic.com/research", 1681, 1261),
  a("anthropic/research/project-vend.png", "https://cdn.sanity.io/images/4zrzovbb/website/8972a735e56071176ba6318220552f99497b68f4-1680x1260.png", "Project Vend", "Project Vend research", "research", "png", "anthropic.com/research", 1680, 1260),
  a("anthropic/research/agentic-misalignment.png", "https://cdn.sanity.io/images/4zrzovbb/website/a39f1a92805cb88b1c07fabd4723181c5a6e1f14-1681x1261.png", "Agentic Misalignment", "Agentic misalignment research", "research", "png", "anthropic.com/research", 1681, 1261),
  a("anthropic/research/confidential-inference.png", "https://cdn.sanity.io/images/4zrzovbb/website/9a0bd6057505b3aea24d1e7412943a4c6c98be0e-1681x1261.png", "Confidential Inference", "Confidential inference research", "research", "png", "anthropic.com/research", 1681, 1261),
  a("anthropic/research/circuit-tracing.png", "https://cdn.sanity.io/images/4zrzovbb/website/86be055e775a25d264ab5b43a9ba35ac6041b609-1681x1261.png", "Circuit Tracing", "Open-source circuit tracing", "research", "png", "anthropic.com/research", 1681, 1261),

  // ── Maps ──────────────────────────────────────────────────────────────
  a("anthropic/maps/north-america.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/682558e8a957c5ef54c77cb2_events-header_north-america.svg", "North America", "North America map", "maps", "svg", "anthropic.com/events"),
  a("anthropic/maps/south-america.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/682558e840a6776a7f4f0393_events-header_south-america.svg", "South America", "South America map", "maps", "svg", "anthropic.com/events"),
  a("anthropic/maps/europe.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/682558e87eae34fbb99cfb3b_events-header_europe.svg", "Europe", "Europe map", "maps", "svg", "anthropic.com/events"),
  a("anthropic/maps/middle-east.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/682558e882ac8a8bb8f677fd_events-header_middle-east.svg", "Middle East", "Middle East map", "maps", "svg", "anthropic.com/events"),
  a("anthropic/maps/asia.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/682558e8bbafe8194cf059ca_events-header_asia.svg", "Asia", "Asia map", "maps", "svg", "anthropic.com/events"),
  a("anthropic/maps/africa.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/682558e840a6776a7f4f0390_events-header_africa.svg", "Africa", "Africa map", "maps", "svg", "anthropic.com/events"),
  a("anthropic/maps/australia.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/682558e8f55fd3be8776c2c1_events-header_australia.svg", "Australia", "Australia map", "maps", "svg", "anthropic.com/events"),

  // ── Events ────────────────────────────────────────────────────────────
  a("anthropic/events/code-with-claude-logo.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/69b96c22d96f7b22bf879c21_code-with-claude-logo-vertical.svg", "Code with Claude Logo", "Conference logo (vertical)", "events", "svg", "anthropic.com/events"),
  a("anthropic/events/code-with-claude-illustrations.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/69bb579dafb6a11800c113d2_cwc-illos.svg", "Code with Claude Illustrations", "Conference illustrations", "events", "svg", "anthropic.com/events"),
  a("anthropic/events/claude-for-financial-services.svg", "https://cdn.prod.website-files.com/67ed58c92cfedc451ebbbca1/6864753e1fa8e470fad9be8a_ClaudeforFinancialServices-StackedLogo.svg", "Claude for Financial Services", "Financial services event logo", "events", "svg", "anthropic.com/events"),

  // ── Team Photos ───────────────────────────────────────────────────────
  a("anthropic/team/research-team.webp", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/681d62091e3b46dac5428888_research.webp", "Research Team", "Research team photo", "team", "webp", "anthropic.com/company"),
  a("anthropic/team/policy-team.webp", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/681d620978e48d8861871f7d_policy.webp", "Policy Team", "Policy team photo", "team", "webp", "anthropic.com/company"),
  a("anthropic/team/product-team.webp", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/681d62094dad1585c366d2da_product.webp", "Product Team", "Product team photo", "team", "webp", "anthropic.com/company"),
  a("anthropic/team/operations-team.webp", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/67d3c039bc939998a7c43b37_work-with-anthropic.webp", "Operations Team", "Operations team photo", "team", "webp", "anthropic.com/company"),
  a("anthropic/team/building-anthropic-video.jpg", "https://cdn.sanity.io/images/4zrzovbb/website/daa9ebf989c197cae5ef84a639302083713a611e-1760x988.jpg", "Building Anthropic Video", "Careers video thumbnail", "team", "jpg", "anthropic.com/careers", 1760, 988),

  // ── UI Icons ──────────────────────────────────────────────────────────
  a("anthropic/icons/magnifying-glass.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/67ed683dbe1be372fb49776d_MagnifyingGlass.svg", "Magnifying Glass", "Search icon", "ui-icons", "svg", "anthropic.com/events"),
  a("anthropic/icons/lightning-bolt.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/67ed7b8c9984ff61d7894ebc_Objects-LightningBolt.svg", "Lightning Bolt", "Lightning bolt icon", "ui-icons", "svg", "anthropic.com/events"),
  a("anthropic/icons/plant-growth-nodes.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/680268b1c5c214a0769c37be_Nodes-PlantGrowth.svg", "Plant Growth Nodes", "Growth / nodes icon", "ui-icons", "svg", "anthropic.com/events"),
  a("anthropic/icons/envelope.svg", "https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/6892041a22121dadb0e34d89_Object-Envelope.svg", "Envelope", "Email / envelope icon", "ui-icons", "svg", "anthropic.com/events"),
  a("anthropic/icons/claude-logo-small.svg", "https://cdn.sanity.io/images/4zrzovbb/website/2d4a112e61566fdcebc25aecc2bef75bb14a7fec-277x104.svg", "Claude Logo (Small)", "Small Claude logo", "ui-icons", "svg", "anthropic.com/features", 277, 104),

  // ── Animations ────────────────────────────────────────────────────────
  a("anthropic/animations/interview-1.json", "https://cdn.sanity.io/files/4zrzovbb/website/9ac19583d019b85db5ca3af485f419f74f3fe4a5.json", "Interview Animation 1", "81K interviews Lottie animation", "animations", "json", "anthropic.com/features/81k-interviews"),
  a("anthropic/animations/interview-2.json", "https://cdn.sanity.io/files/4zrzovbb/website/a9cde041d15765c23813279f5ccde115bd40f29a.json", "Interview Animation 2", "81K interviews Lottie animation", "animations", "json", "anthropic.com/features/81k-interviews"),
  a("anthropic/animations/interview-3.json", "https://cdn.sanity.io/files/4zrzovbb/website/b9f944c5ea6207dd80c7204544457960642eda46.json", "Interview Animation 3", "81K interviews Lottie animation", "animations", "json", "anthropic.com/features/81k-interviews"),
  a("anthropic/animations/interview-4.json", "https://cdn.sanity.io/files/4zrzovbb/website/c20ea6ec0dc231d3559c6d0fbcdae4f6a05fdd06.json", "Interview Animation 4", "81K interviews Lottie animation", "animations", "json", "anthropic.com/features/81k-interviews"),
  a("anthropic/animations/interview-5.json", "https://cdn.sanity.io/files/4zrzovbb/website/cca8d23a9104ef0fc87b518ec18565aa8af41205.json", "Interview Animation 5", "81K interviews Lottie animation", "animations", "json", "anthropic.com/features/81k-interviews"),
];

// Computed stats
export const TOTAL_ASSETS = assets.length;
export const CATEGORIES = [...new Set(assets.map((a) => a.category))];
export const FORMATS = [...new Set(assets.map((a) => a.format))];

// URL index
export const URL_INDEX = {
  main: ["/", "/company", "/careers", "/events", "/learn", "/news", "/research", "/science", "/transparency", "/constitution", "/economic-futures", "/responsible-scaling-policy"],
  products: ["/claude/opus", "/claude/sonnet", "/claude/haiku", "/product/claude-code", "/product/claude-cowork"],
  engineering: ["/engineering", "/engineering/building-effective-agents", "/engineering/claude-code-best-practices", "/engineering/claude-code-auto-mode", "/engineering/effective-context-engineering-for-ai-agents", "/engineering/writing-tools-for-agents", "/engineering/building-c-compiler", "/engineering/advanced-tool-use", "/engineering/code-execution-with-mcp", "/engineering/claude-code-sandboxing", "/engineering/effective-harnesses-for-long-running-agents", "/engineering/desktop-extensions", "/engineering/claude-think-tool", "/engineering/swe-bench-sonnet", "/engineering/contextual-retrieval", "/engineering/infrastructure-noise"],
  features: ["/features/81k-interviews", "/features/claude-on-mars"],
  learn: ["/learn/build-with-claude", "/learn/claude-for-work", "/learn/claude-for-you"],
  legal: ["/legal/aup", "/legal/commercial-terms", "/legal/consumer-terms", "/legal/privacy", "/legal/cookies", "/legal/trademark-guidelines"],
  external: ["https://claude.ai", "https://platform.claude.com", "https://docs.claude.com", "https://status.claude.com"],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Anthropic Color System — extracted from anthropic.com CSS + design tokens
// All values include OKLCH conversion for modern color workflows
// ═══════════════════════════════════════════════════════════════════════════

export interface ColorToken {
  name: string;
  hex: string;
  oklch: string;
  role: "background" | "text" | "accent" | "surface" | "border" | "model" | "interactive";
  group: "core" | "slate" | "accents" | "models" | "ui" | "tags";
}

export const COLORS: ColorToken[] = [
  // ── Core Brand ────────────────────────────────────────────────────────
  { name: "Dark", hex: "#0f0f0e", oklch: "oklch(0.13 0.004 95)", role: "text", group: "core" },
  { name: "Slate Dark", hex: "#141413", oklch: "oklch(0.15 0.005 95)", role: "text", group: "core" },
  { name: "Clay", hex: "#d97757", oklch: "oklch(0.65 0.14 45)", role: "accent", group: "core" },
  { name: "Ivory Light", hex: "#faf9f5", oklch: "oklch(0.98 0.008 95)", role: "background", group: "core" },
  { name: "White", hex: "#ffffff", oklch: "oklch(1.0 0 0)", role: "surface", group: "core" },

  // ── Slate Scale ───────────────────────────────────────────────────────
  { name: "Slate 900", hex: "#1a1918", oklch: "oklch(0.17 0.004 80)", role: "text", group: "slate" },
  { name: "Slate 850", hex: "#1f1e1d", oklch: "oklch(0.19 0.004 80)", role: "text", group: "slate" },
  { name: "Slate 800", hex: "#262624", oklch: "oklch(0.22 0.005 90)", role: "text", group: "slate" },
  { name: "Slate 750", hex: "#30302e", oklch: "oklch(0.27 0.005 90)", role: "text", group: "slate" },
  { name: "Slate 700", hex: "#3d3d3a", oklch: "oklch(0.33 0.006 95)", role: "text", group: "slate" },
  { name: "Slate 650", hex: "#4d4c48", oklch: "oklch(0.39 0.007 95)", role: "text", group: "slate" },
  { name: "Slate 600", hex: "#5e5d59", oklch: "oklch(0.46 0.008 95)", role: "border", group: "slate" },
  { name: "Slate 550", hex: "#73726c", oklch: "oklch(0.53 0.010 95)", role: "border", group: "slate" },
  { name: "Slate 500", hex: "#87867f", oklch: "oklch(0.61 0.012 95)", role: "border", group: "slate" },
  { name: "Slate 450", hex: "#9c9a92", oklch: "oklch(0.68 0.012 95)", role: "border", group: "slate" },
  { name: "Slate 400", hex: "#b0aea5", oklch: "oklch(0.75 0.012 95)", role: "border", group: "slate" },
  { name: "Slate 350", hex: "#c2c0b6", oklch: "oklch(0.80 0.012 95)", role: "border", group: "slate" },
  { name: "Slate 300", hex: "#d1cfc5", oklch: "oklch(0.85 0.012 95)", role: "border", group: "slate" },
  { name: "Slate 250", hex: "#dedcd1", oklch: "oklch(0.89 0.013 92)", role: "surface", group: "slate" },
  { name: "Slate 200", hex: "#e8e6dc", oklch: "oklch(0.92 0.013 95)", role: "surface", group: "slate" },
  { name: "Slate 150", hex: "#f0eee6", oklch: "oklch(0.95 0.012 95)", role: "surface", group: "slate" },
  { name: "Slate 100", hex: "#f5f4ed", oklch: "oklch(0.97 0.010 95)", role: "surface", group: "slate" },
  { name: "Slate 050", hex: "#faf9f5", oklch: "oklch(0.98 0.008 95)", role: "background", group: "slate" },

  // ── Accents ───────────────────────────────────────────────────────────
  { name: "Oat", hex: "#e3dacc", oklch: "oklch(0.89 0.018 80)", role: "surface", group: "accents" },
  { name: "Coral", hex: "#ebcece", oklch: "oklch(0.87 0.04 15)", role: "surface", group: "accents" },
  { name: "Cactus", hex: "#bcd1ca", oklch: "oklch(0.84 0.03 175)", role: "surface", group: "accents" },
  { name: "Heather", hex: "#cbcadb", oklch: "oklch(0.84 0.03 280)", role: "surface", group: "accents" },
  { name: "Olive", hex: "#788c5d", oklch: "oklch(0.60 0.08 130)", role: "accent", group: "accents" },
  { name: "Sky", hex: "#6a9bcc", oklch: "oklch(0.66 0.09 240)", role: "accent", group: "accents" },
  { name: "Fig", hex: "#c46686", oklch: "oklch(0.58 0.12 355)", role: "accent", group: "accents" },

  // ── Models ────────────────────────────────────────────────────────────
  { name: "Opus", hex: "#d97757", oklch: "oklch(0.65 0.14 45)", role: "model", group: "models" },
  { name: "Sonnet", hex: "#6a9bcc", oklch: "oklch(0.66 0.09 240)", role: "model", group: "models" },
  { name: "Haiku", hex: "#788c5d", oklch: "oklch(0.60 0.08 130)", role: "model", group: "models" },

  // ── UI & Functional ───────────────────────────────────────────────────
  { name: "Focus", hex: "#2c84db", oklch: "oklch(0.60 0.15 250)", role: "interactive", group: "ui" },
  { name: "Error", hex: "#bf4d43", oklch: "oklch(0.52 0.14 25)", role: "interactive", group: "ui" },
  { name: "Success", hex: "#10b981", oklch: "oklch(0.70 0.15 165)", role: "interactive", group: "ui" },

  // ── Research Tags ─────────────────────────────────────────────────────
  { name: "Tag Tan", hex: "#d4cab9", oklch: "oklch(0.83 0.02 75)", role: "surface", group: "tags" },
  { name: "Tag Coral", hex: "#ea9085", oklch: "oklch(0.72 0.10 25)", role: "surface", group: "tags" },
  { name: "Tag Periwinkle", hex: "#b0bdf6", oklch: "oklch(0.79 0.10 265)", role: "surface", group: "tags" },
];

export const COLOR_GROUPS: Record<string, string> = {
  core: "Core Brand",
  slate: "Slate Scale",
  accents: "Accents",
  models: "Model Colors",
  ui: "Functional",
  tags: "Research Tags",
};

// Last 15 colors from the palette — used to cycle illustration backgrounds
export const ILLUSTRATION_COLORS = COLORS.slice(-15).map((c) => c.hex);

