// The approval pages, as pure HTML builders.
//
// Import-free on purpose: the publish route cannot run under Vitest (it pulls
// @/lib/db), so everything testable about the confirm flow lives here — above
// all the invariant that the page carries the token ONLY inside a POST form.
// Chat clients unfurl links with GET; only a human presses a button.

export interface ConfirmationInput {
  brand: string;
  channel: string;
  text: string;
  /** The variant's full media set — every URL is listed for the reviewer. */
  mediaUrls: string[];
  /** Human-readable expiry, already formatted. */
  expiresAt: string;
  token: string;
  /** Where the form posts back, e.g. "/api/social/publish". */
  postPath: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A bare page, not an app route: opened from a chat client, often on a phone.
function shell(title: string, main: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 ui-sans-serif, system-ui, sans-serif; margin: 0;
         display: grid; place-items: center; min-height: 100dvh; padding: 2rem; }
  main { max-width: 46ch; }
  h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
  p { margin: 0; opacity: .75; white-space: pre-wrap; }
  .copy { border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
          border-radius: .5rem; padding: .75rem 1rem; margin: 1rem 0; }
  .copy p { opacity: 1; }
  .meta { font-size: .8125rem; opacity: .6; margin-top: .5rem; }
  form { display: flex; gap: .75rem; margin-top: 1.25rem; }
  button { font: inherit; border: 1px solid currentColor; border-radius: .5rem;
           padding: .5rem 1.25rem; cursor: pointer; background: none; color: inherit; }
  button[value="approve"] { background: light-dark(#111, #eee);
                            color: light-dark(#fff, #111); border-color: transparent; }
</style></head>
<body><main>${main}</main></body></html>`;
}

export function page(title: string, body: string): string {
  return shell(
    title,
    `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>`,
  );
}

export function confirmationPage(input: ConfirmationInput): string {
  const media = input.mediaUrls
    .map(
      (url, i) =>
        `<p class="meta">Media ${i + 1}/${input.mediaUrls.length}: ${escapeHtml(url)}</p>`,
    )
    .join("\n");
  return shell(
    "Approve & publish?",
    `<h1>Approve &amp; publish?</h1>
<p class="meta">${escapeHtml(input.brand)} → ${escapeHtml(input.channel)}</p>
<div class="copy"><p>${escapeHtml(input.text)}</p></div>
${media}
<p class="meta">Link expires ${escapeHtml(input.expiresAt)}. Approval is single-use.</p>
<form method="post" action="${escapeHtml(input.postPath)}">
  <input type="hidden" name="token" value="${escapeHtml(input.token)}">
  <button type="submit" name="action" value="approve">Approve &amp; publish</button>
  <button type="submit" name="action" value="reject">Reject</button>
</form>`,
  );
}
