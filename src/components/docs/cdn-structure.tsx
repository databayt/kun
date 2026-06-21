"use client";

import { Folder, File } from "lucide-react";

interface DirectoryNode {
  name: string;
  type: "file" | "directory";
  description?: string;
  children?: DirectoryNode[];
}

interface CdnStructureProps {
  className?: string;
}

export function CdnStructure({ className }: CdnStructureProps) {
  // The bucket layout, expanded to representative full key paths. Renamed to
  // databayt-cdn (from hogwarts-databayt). Vendor mirrors are FLAT — anthropic/<file>,
  // no category subfolders. "→ hogwarts/…" marks product media still at root that
  // the migration would move.
  const topLevelStructure: DirectoryNode = {
    name: "databayt-cdn/",
    type: "directory",
    description:
      "S3 bucket — renamed from hogwarts-databayt · served at cdn.databayt.org",
    children: [
      {
        name: "anthropic/",
        type: "directory",
        description:
          "vendor mirror · ~715 assets · flat + clean names (no brand prefix)",
        children: [
          { name: "wordmark.svg", type: "file" },
          { name: "starburst.svg", type: "file" },
          { name: "hand-abacus.svg", type: "file" },
          { name: "notion.svg", type: "file" },
          { name: "gdpval.png", type: "file" },
          { name: "… 710 more", type: "file" },
        ],
      },
      {
        name: "icons/",
        type: "directory",
        description: "shared primitive · 42 functional SVG/PNG",
        children: [
          { name: "visa.svg", type: "file" },
          { name: "apple-pay.svg", type: "file" },
        ],
      },
      {
        name: "illustrations/",
        type: "directory",
        description: "shared primitive · 88 decorative",
        children: [{ name: "empty-state.svg", type: "file" }],
      },
      {
        name: "animations/",
        type: "directory",
        description: "shared primitive · 3 Lottie JSON",
        children: [{ name: "confetti.json", type: "file" }],
      },
      {
        name: "photos/",
        type: "directory",
        description: "product media · 22 photos · → hogwarts/photos/",
        children: [{ name: "campus-h.jpeg", type: "file" }],
      },
      {
        name: "media/",
        type: "directory",
        description: "product media · video/audio · → hogwarts/media/",
        children: [{ name: "story.mp4", type: "file" }],
      },
      {
        name: "wallpapers/",
        type: "directory",
        description:
          "product media · chat backgrounds · → hogwarts/wallpapers/",
        children: [{ name: "wp-wa-chat-bg.svg", type: "file" }],
      },
      {
        name: "profiles/",
        type: "directory",
        description: "product media · avatars · → hogwarts/profiles/",
        children: [{ name: "{userId}.webp", type: "file" }],
      },
      {
        name: "catalog/",
        type: "directory",
        description: "content collection · curriculum (keys stored in DB)",
        children: [
          {
            name: "concepts/",
            type: "directory",
            children: [{ name: "g1-math/banner-md.webp", type: "file" }],
          },
          {
            name: "lessons/",
            type: "directory",
            children: [{ name: "{slug}/video/{id}.mp4", type: "file" }],
          },
          {
            name: "textbooks/",
            type: "directory",
            children: [{ name: "{slug}/textbook.pdf", type: "file" }],
          },
          {
            name: "subjects/",
            type: "directory",
            description: "legacy",
            children: [{ name: "{slug}/banner-md.webp", type: "file" }],
          },
        ],
      },
    ],
  };

  const FileIcon = ({ type }: { type: string }) => {
    if (type === "directory") {
      return <Folder className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const FileTree = ({
    item,
    level = 0,
    isLast = false,
    parentIsLast = [],
  }: {
    item: DirectoryNode;
    level?: number;
    isLast?: boolean;
    parentIsLast?: boolean[];
  }) => (
    <div className="relative">
      {level > 0 && (
        <>
          {parentIsLast
            .slice(0, -1)
            .map(
              (isLastParent, idx) =>
                !isLastParent && (
                  <div
                    key={idx}
                    className="absolute border-l h-full"
                    style={{ left: `${(idx + 1) * 24 - 20}px` }}
                  />
                ),
            )}
          {!isLast && (
            <div
              className="absolute border-l h-full"
              style={{ left: `${level * 24 - 20}px` }}
            />
          )}
        </>
      )}
      <div
        className="flex items-center gap-2 py-1"
        style={{ paddingLeft: `${level * 24}px` }}
      >
        <FileIcon type={item.type} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <code
            className={`bg-transparent px-0 py-0 ${
              item.type === "directory" ? "font-semibold" : ""
            }`}
          >
            {item.name}
          </code>
          {item.description && (
            <span className="text-sm text-muted-foreground">
              — {item.description}
            </span>
          )}
        </div>
      </div>
      {item.children && (
        <div className="mt-1">
          {item.children.map((child: DirectoryNode, index: number) => (
            <FileTree
              key={index}
              item={child}
              level={level + 1}
              isLast={index === (item.children?.length ?? 0) - 1}
              parentIsLast={[...parentIsLast, isLast]}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="py-4">
        <FileTree item={topLevelStructure} />
      </div>
    </div>
  );
}
