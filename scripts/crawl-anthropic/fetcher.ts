import { request } from "undici";
import { chromium, type Browser } from "playwright";
import robotsParser from "robots-parser";
import pLimit from "p-limit";
import { USER_AGENT, RATE_LIMIT, ALLOWED_CDN_HOSTS } from "./config.js";
import type { PageSource } from "./types.js";

const robotsCache = new Map<string, ReturnType<typeof robotsParser>>();
const hostQueues = new Map<string, ReturnType<typeof pLimit>>();
const lastFetchAt = new Map<string, number>();

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser) return browser;
  browser = await chromium.launch({ headless: true });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return "unknown"; }
}

function getHostQueue(host: string): ReturnType<typeof pLimit> {
  let q = hostQueues.get(host);
  if (!q) {
    q = pLimit(RATE_LIMIT.perHostMaxRps);
    hostQueues.set(host, q);
  }
  return q;
}

async function rateLimit(host: string): Promise<void> {
  const minIntervalMs = 1000 / RATE_LIMIT.perHostMaxRps;
  const last = lastFetchAt.get(host) ?? 0;
  const elapsed = Date.now() - last;
  const jitter = Math.random() * RATE_LIMIT.jitterMs;
  const wait = Math.max(0, minIntervalMs - elapsed) + jitter;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt.set(host, Date.now());
}

export async function checkRobots(url: string): Promise<boolean> {
  const host = hostOf(url);
  let robots = robotsCache.get(host);
  if (!robots) {
    const robotsUrl = `https://${host}/robots.txt`;
    try {
      const { body, statusCode } = await request(robotsUrl, {
        headers: { "user-agent": USER_AGENT },
      });
      const txt = statusCode >= 200 && statusCode < 300 ? await body.text() : "";
      robots = robotsParser(robotsUrl, txt);
    } catch {
      robots = robotsParser(robotsUrl, "");
    }
    robotsCache.set(host, robots);
  }
  return robots.isAllowed(url, USER_AGENT) ?? true;
}

async function backoff(attempt: number): Promise<void> {
  const ms = Math.min(
    RATE_LIMIT.backoffMaxMs,
    RATE_LIMIT.backoffStartMs * Math.pow(2, attempt),
  );
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchStatic(url: string): Promise<{ html: string; status: number } | null> {
  const host = hostOf(url);
  return getHostQueue(host)(async () => {
    await rateLimit(host);
    for (let attempt = 0; attempt < RATE_LIMIT.retries; attempt++) {
      try {
        const { statusCode, headers, body } = await request(url, {
          headers: {
            "user-agent": USER_AGENT,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        if (statusCode === 429 || statusCode === 503) {
          await backoff(attempt);
          continue;
        }
        if (statusCode >= 400) {
          return { html: "", status: statusCode };
        }
        const ct = String(headers["content-type"] || "");
        if (!ct.includes("html") && !ct.includes("xml")) {
          await body.dump();
          return { html: "", status: statusCode };
        }
        const html = await body.text();
        return { html, status: statusCode };
      } catch (err) {
        if (attempt === RATE_LIMIT.retries - 1) {
          console.error(`[fetch] ${url} failed after ${attempt + 1} attempts:`, (err as Error).message);
          return null;
        }
        await backoff(attempt);
      }
    }
    return null;
  });
}

export async function fetchDynamic(url: string): Promise<{ html: string; networkAssets: string[] } | null> {
  const host = hostOf(url);
  return getHostQueue(host)(async () => {
    await rateLimit(host);
    const b = await getBrowser();
    const ctx = await b.newContext({ userAgent: USER_AGENT });
    const page = await ctx.newPage();
    const networkAssets = new Set<string>();

    page.on("request", (req) => {
      const reqUrl = req.url();
      try {
        const u = new URL(reqUrl);
        if (ALLOWED_CDN_HOSTS.has(u.host)) {
          const type = req.resourceType();
          if (["image", "media", "font"].includes(type) || /\.(svg|json|lottie|mp4|webm|woff2?|ttf|otf|pdf)(\?|$)/i.test(reqUrl)) {
            networkAssets.add(reqUrl);
          }
        }
      } catch { /* ignore */ }
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const html = await page.content();
      return { html, networkAssets: Array.from(networkAssets) };
    } catch (err) {
      console.error(`[playwright] ${url} failed:`, (err as Error).message);
      return null;
    } finally {
      await ctx.close();
    }
  });
}

export async function fetchPage(src: PageSource): Promise<{ html: string; networkAssets: string[] } | null> {
  if (src.authWalled) return null;
  const allowed = await checkRobots(src.url);
  if (!allowed) {
    console.warn(`[robots] ${src.url} disallowed`);
    return null;
  }
  if (src.dynamic) return fetchDynamic(src.url);
  const r = await fetchStatic(src.url);
  if (!r || !r.html) return null;
  return { html: r.html, networkAssets: [] };
}
