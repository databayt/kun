// kun web seat adapter: glm — plain browser script, evaluated in the site's page. No imports, no Node APIs.
// Contract: sets window.__kunWeb = { id, ready, needsLogin, limitHit, busy, send, lastAnswer, transcript }. Idempotent.
(() => {
  const id = 'glm';
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
  // ---- GLM (chat.z.ai, an Open WebUI fork) — selectors verified 2026-11-24 on the guest page (textarea#chat-input, "Send Message"); message containers from the Open WebUI DOM ----
  const composer = () => first(['textarea#chat-input', 'textarea[placeholder*="Send a Message" i]', '#chat-input', 'textarea']);
  const sendBtn = () => first(['button#send-message-button', 'button[aria-label="Send Message"]', 'button[type="submit"]']);
  const stopBtn = () => first(['button.stop-response-button', 'button[aria-label="Stop"]', 'button[aria-label="Stop Generating"]', 'button[aria-label*="stop" i]']);
  const msgs = () => $$('.chat-user, .chat-assistant');
  const isUser = (m) => m.classList.contains('chat-user');
  const textOf = (m) => (isUser(m) ? (($('[data-user-bubble]', m) || m).innerText || '').trim() : md($('.markdown-prose, #response-content-container, .prose', m) || m));
  const LIMIT = /(you['’]ve (hit|reached)[^\n]*limit[^\n]*|(daily|usage) (limit|quota)[^\n]*|too many (requests|messages)[^\n]*|rate limit[^\n]*|(concurrency|request) limit[^\n]*|quota (exceeded|exhausted)[^\n]*|insufficient (balance|quota)[^\n]*)/i;
  window.__kunWeb = {
    id,
    ready: () => visible(composer()),
    // guests see a "Log in" button in the header; a signed-in account shows an avatar and no such button
    needsLogin: () => /\/auth/.test(location.pathname) || $$('a,button').some((b) => /^(log in|sign in)$/i.test((b.innerText || '').trim()) && visible(b)) && !$('img[alt*="User" i], img[alt*="Profile" i]'),
    limitHit: () => limitLine(LIMIT),
    busy: () => !!stopBtn() || !!$('.chat-assistant [data-slot="agent-thinking"], .chat-assistant .loading, .chat-assistant [class*="skeleton" i]'),
    send: async (text) => {
      const c = composer();
      if (!c) throw new Error('glm: no composer');
      await fill(c, text);
      for (let i = 0; i < 40; i++) {
        const b = sendBtn();
        if (enabled(b)) { b.click(); return; }
        await pause(150);
      }
      c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    },
    lastAnswer: () => { const a = msgs().filter((m) => !isUser(m)); return a.length ? textOf(a[a.length - 1]) : ''; },
    transcript: () => msgs().map((m) => ({ role: isUser(m) ? 'user' : 'assistant', text: textOf(m) })),
  };
})();
