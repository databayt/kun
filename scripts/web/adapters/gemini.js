// kun web seat adapter: gemini — plain browser script, evaluated in the site's page. No imports, no Node APIs.
// Contract: sets window.__kunWeb = { id, ready, needsLogin, limitHit, busy, send, lastAnswer, transcript }. Idempotent.
(() => {
  const id = 'gemini';
  // ---- shared helpers (identical in every adapter; each file stays self-contained) ----
  const $ = (sel, root = document) => { try { return root.querySelector(sel); } catch { return null; } };
  const $$ = (sel, root = document) => { try { return [...root.querySelectorAll(sel)]; } catch { return []; } };
  const first = (sels, root) => { for (const s of sels) { const e = $(s, root); if (e) return e; } return null; };
  const visible = (e) => !!e && (e.offsetParent !== null || e.getClientRects().length > 0);
  const body = () => (document.body ? document.body.innerText : '');
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const enabled = (b) => !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
  // Fill a composer so the page's framework sees it: native value setter for <textarea>/<input>,
  // select-all + execCommand('insertText') for contenteditable (ProseMirror, Quill, Lexical).
  async function fill(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const sel = getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('delete');
    // insertText treats "\n" as a paragraph break in most editors; send it in one piece
    if (!document.execCommand('insertText', false, text)) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  }
  // A DOM subtree as markdown-ish text: code blocks fenced, lists dashed, paragraphs split.
  function md(root) {
    if (!root) return '';
    const out = [];
    const walk = (n, ctx) => {
      if (n.nodeType === 3) { out.push(ctx.pre ? n.nodeValue : n.nodeValue.replace(/\s+/g, ' ')); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName.toLowerCase();
      if (['script', 'style', 'svg', 'button', 'mat-icon'].includes(t)) return;
      if (t === 'pre') {
        const code = $('code', n) || n;
        const lang = ((code.className || '').match(/language-([\w+-]+)/) || [])[1] || (($('[class*="lang"],.code-block-decoration span', n) || {}).textContent || '').trim().split(/\s/)[0].toLowerCase().replace(/[^\w+-]/g, '');
        out.push('\n\n```' + lang + '\n' + code.textContent.replace(/\n+$/, '') + '\n```\n\n');
        return;
      }
      if (t === 'br') { out.push('\n'); return; }
      if (t === 'code') { out.push('`'); n.childNodes.forEach((c) => walk(c, ctx)); out.push('`'); return; }
      if (t === 'strong' || t === 'b') { out.push('**'); n.childNodes.forEach((c) => walk(c, ctx)); out.push('**'); return; }
      if (/^h[1-6]$/.test(t)) { out.push('\n\n' + '#'.repeat(+t[1]) + ' '); n.childNodes.forEach((c) => walk(c, ctx)); out.push('\n\n'); return; }
      if (t === 'li') {
        const p = n.parentElement && n.parentElement.tagName.toLowerCase() === 'ol' ? [...n.parentElement.children].indexOf(n) + 1 + '. ' : '- ';
        out.push('\n' + p); n.childNodes.forEach((c) => walk(c, ctx)); return;
      }
      if (t === 'tr') { out.push('\n| '); n.childNodes.forEach((c) => { walk(c, ctx); if (c.nodeType === 1) out.push(' | '); }); return; }
      const block = ['p', 'div', 'ul', 'ol', 'table', 'blockquote'].includes(t);
      if (block) out.push('\n\n');
      if (t === 'blockquote') out.push('> ');
      n.childNodes.forEach((c) => walk(c, ctx));
      if (block) out.push('\n\n');
    };
    walk(root, {});
    return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  // The first line of the page that reads like a usage limit; null when there is none.
  function limitLine(re) {
    const m = body().match(re);
    return m ? m[0].trim().slice(0, 300) : null;
  }
  // ---- Gemini (gemini.google.com/app) — selectors verified 2026-11-24 (composer, Sign in) plus gemini-web.mjs (Stop response, Limit reached) ----
  const composer = () => first(['div.ql-editor[contenteditable="true"][aria-label*="prompt" i]', 'rich-textarea div.ql-editor', 'div[role="textbox"][contenteditable="true"]']);
  const sendBtn = () => first(['button[aria-label="Send message"]', 'button.send-button', 'button[mattooltip="Send message"]']);
  const stopBtn = () => first(['button[aria-label="Stop response"]', 'button[aria-label*="Stop" i].send-button', '.stop-icon']);
  const turns = () => $$('user-query, model-response');
  const isUser = (t) => t.tagName.toLowerCase() === 'user-query';
  const textOf = (t) => (isUser(t) ? (($('.query-text', t) || t).innerText || '').trim() : md($('message-content .markdown, message-content', t) || t));
  const LIMIT = /(limit reached[^\n]*|you['’]ve (hit|reached)[^\n]*limit[^\n]*|(daily|usage) limit[^\n]*|can['’]t (respond|help) with that right now[^\n]*|try again (later|tomorrow)[^\n]*limit[^\n]*)/i;
  window.__kunWeb = {
    id,
    ready: () => visible(composer()),
    // signed out: a "Sign in" link/button and no Google Account control
    needsLogin: () => /accounts\.google\.com/.test(location.href) || (!$('a[aria-label^="Google Account" i], button[aria-label^="Google Account" i]') && $$('a,button').some((b) => /^sign in$/i.test((b.innerText || '').trim()) && visible(b))),
    limitHit: () => limitLine(LIMIT),
    busy: () => !!stopBtn() || !!$('model-response .response-footer.hidden, model-response .loading, bard-avatar .thinking, .pending-response'),
    send: async (text) => {
      const c = composer();
      if (!c) throw new Error('gemini: no composer');
      await fill(c, text);
      for (let i = 0; i < 40; i++) {
        const b = sendBtn();
        if (enabled(b)) { b.click(); return; }
        await pause(150);
      }
      c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    },
    lastAnswer: () => { const a = turns().filter((t) => !isUser(t)); return a.length ? textOf(a[a.length - 1]) : ''; },
    transcript: () => turns().map((t) => ({ role: isUser(t) ? 'user' : 'assistant', text: textOf(t) })),
  };
})();
