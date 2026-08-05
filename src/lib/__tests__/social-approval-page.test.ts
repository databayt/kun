import { describe, expect, it } from "vitest";
import { confirmationPage, escapeHtml, page } from "@/lib/social-approval-page";

const TOKEN = "eyJ2IjoidmFyXzEiLCJlIjoxfQ.c2lnbmF0dXJl";

function confirm(
  overrides: Partial<Parameters<typeof confirmationPage>[0]> = {},
) {
  return confirmationPage({
    brand: "hogwarts",
    channel: "facebook",
    text: 'Say "hi" to <b>everyone</b>',
    mediaUrls: [],
    expiresAt: "2026-07-30 18:00 UTC",
    token: TOKEN,
    postPath: "/api/social/publish",
    ...overrides,
  });
}

describe("escapeHtml", () => {
  it("escapes markup and attribute breakers", () => {
    expect(escapeHtml(`&<>"`)).toBe("&amp;&lt;&gt;&quot;");
  });
});

describe("page", () => {
  it("escapes body content", () => {
    const html = page("Title", '<script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("confirmationPage", () => {
  it("publishes only via POST back to the publish route", () => {
    const html = confirm();
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/social/publish"');
  });

  it("carries the token in a hidden field, never in a link", () => {
    const html = confirm();
    expect(html).toContain(`name="token" value="${TOKEN}"`);
    // Nothing GET-able may carry the token — that is the whole point.
    expect(html).not.toMatch(/href="[^"]*token/);
    expect(html).not.toContain("?token=");
  });

  it("offers approve and reject as form actions", () => {
    const html = confirm();
    expect(html).toContain('name="action" value="approve"');
    expect(html).toContain('name="action" value="reject"');
  });

  it("stays crawler-safe: noindex, no script", () => {
    const html = confirm();
    expect(html).toContain('name="robots" content="noindex"');
    expect(html.toLowerCase()).not.toContain("<script");
  });

  it("escapes the copy", () => {
    const html = confirm();
    expect(html).not.toContain("<b>");
    expect(html).toContain("&quot;hi&quot;");
  });

  it("shows every media URL as text when present", () => {
    const html = confirm({
      mediaUrls: [
        "https://cdn.databayt.org/x.png?a=1&b=2",
        "https://cdn.databayt.org/y.png",
      ],
    });
    expect(html).toContain("https://cdn.databayt.org/x.png?a=1&amp;b=2");
    expect(html).toContain("https://cdn.databayt.org/y.png");
    // Numbered so a reviewer on a phone can tell a 2-image album from one.
    expect(html).toContain("Media 1/2");
    expect(html).toContain("Media 2/2");
    // Listed as text only — a GET page must never hotlink or embed.
    expect(html).not.toContain("<img");
  });

  it("renders no media line when the set is empty", () => {
    expect(confirm()).not.toContain("Media 1/");
  });
});
