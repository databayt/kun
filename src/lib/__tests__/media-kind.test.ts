import { describe, expect, it } from "vitest";
import { mediaKind, resolveMediaUrls, splitMedia } from "@/lib/media-kind";

describe("mediaKind", () => {
  it("treats the video extensions as video, case-insensitively", () => {
    expect(mediaKind("https://cdn.example.com/reel.mp4")).toBe("video");
    expect(mediaKind("https://cdn.example.com/clip.MOV")).toBe("video");
    expect(mediaKind("https://cdn.example.com/a.webm")).toBe("video");
    expect(mediaKind("https://cdn.example.com/b.m4v")).toBe("video");
  });

  it("defaults everything else to image", () => {
    expect(mediaKind("https://cdn.example.com/hero.png")).toBe("image");
    expect(mediaKind("https://cdn.example.com/card.jpg")).toBe("image");
    expect(mediaKind("https://cdn.example.com/no-extension")).toBe("image");
    expect(mediaKind("https://cdn.example.com/odd.xyz")).toBe("image");
  });

  it("ignores query strings and fragments", () => {
    expect(mediaKind("https://s3.example.com/reel.mp4?X-Amz-Sig=abc.png")).toBe(
      "video",
    );
    expect(mediaKind("https://cdn.example.com/hero.png?v=2#frag.mp4")).toBe(
      "image",
    );
  });
});

describe("splitMedia", () => {
  it("partitions by kind preserving order", () => {
    const { images, videos } = splitMedia([
      "https://c/1.png",
      "https://c/reel.mp4",
      "https://c/2.jpg",
    ]);
    expect(images).toEqual(["https://c/1.png", "https://c/2.jpg"]);
    expect(videos).toEqual(["https://c/reel.mp4"]);
  });

  it("handles empty input", () => {
    expect(splitMedia([])).toEqual({ images: [], videos: [] });
  });
});

describe("resolveMediaUrls", () => {
  it("prefers the array when it has entries", () => {
    expect(
      resolveMediaUrls(["https://c/a.png"], "https://c/legacy.png"),
    ).toEqual(["https://c/a.png"]);
  });

  it("falls back to the legacy single column", () => {
    expect(resolveMediaUrls([], "https://c/legacy.png")).toEqual([
      "https://c/legacy.png",
    ]);
    expect(resolveMediaUrls(null, "https://c/legacy.png")).toEqual([
      "https://c/legacy.png",
    ]);
  });

  it("returns empty when neither is set", () => {
    expect(resolveMediaUrls([], null)).toEqual([]);
    expect(resolveMediaUrls(undefined, undefined)).toEqual([]);
  });
});
