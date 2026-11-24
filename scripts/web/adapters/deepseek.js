// kun web seat adapter: deepseek — plain browser script, evaluated in the site's page. No imports, no Node APIs.
// Contract: sets window.__kunWeb = { id, ready, needsLogin, limitHit, busy, send, lastAnswer, transcript }. Idempotent.
(() => {
  const id = 'deepseek';
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
  // ---- DeepSeek (chat.deepseek.com) — written 2026-11-24 from known DOM (.ds-message / .ds-markdown / #chat-input); logged-out redirects to /sign_in so the logged-in selectors are UNVERIFIED ----
  const composer = () => first(['textarea#chat-input', 'textarea[placeholder*="DeepSeek" i]', 'textarea[placeholder*="Message" i]', 'textarea']);
  // DeepSeek has no testid on its buttons: the send/stop control is the last [role=button] inside the composer's box
  const sendBtn = () => {
    const c = composer();
    if (!c) return null;
    let box = c.parentElement;
    for (let i = 0; i < 4 && box && !$$('[role="button"]', box).length; i++) box = box.parentElement;
    const bs = box ? $$('[role="button"]', box).filter((b) => $('svg', b)) : [];
    return bs[bs.length - 1] || null;
  };
  const msgs = () => $$('.ds-message').filter((m) => !m.parentElement.closest('.ds-message'));
  const isAssistant = (m) => !!$('.ds-markdown', m);
  const textOf = (m) => (isAssistant(m) ? md($$('.ds-markdown', m).pop()) : (m.innerText || '').trim());
  const LIMIT = /(server is busy[^\n]*|too many (requests|messages)[^\n]*|(daily|usage) (limit|quota)[^\n]*|reached (the|your) [^\n]*limit[^\n]*|rate limit[^\n]*|messages? (are )?sending too (fast|frequently)[^\n]*)/i;
  window.__kunWeb = {
    id,
    ready: () => visible(composer()),
    needsLogin: () => /\/sign_in|\/login/.test(location.pathname) || (!composer() && $$('a,button,div[role="button"]').some((b) => /^log in$/i.test((b.innerText || '').trim()))),
    limitHit: () => limitLine(LIMIT),
    // while an answer streams the send arrow turns into a stop square (aria-disabled never flips), and the markdown block carries the typing cursor
    busy: () => !!$('[aria-label*="stop" i], [data-testid*="stop" i]') || !!$('.ds-markdown--block ~ .ds-typing, .ds-typing, [class*="cursor" i][class*="ds-" i]') || (() => { const b = sendBtn(); return !!b && !!$('svg rect', b) && !$('svg path', b); })(),
    send: async (text) => {
      const c = composer();
      if (!c) throw new Error('deepseek: no composer');
      await fill(c, text);
      await pause(300);
      const b = sendBtn();
      if (b && b.getAttribute('aria-disabled') !== 'true') { b.click(); return; }
      c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    },
    lastAnswer: () => { const a = msgs().filter(isAssistant); return a.length ? textOf(a[a.length - 1]) : ''; },
    transcript: () => msgs().map((m) => ({ role: isAssistant(m) ? 'assistant' : 'user', text: textOf(m) })),
  };
})();
