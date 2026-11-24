// kun web seat adapter: chatgpt — plain browser script, evaluated in the site's page. No imports, no Node APIs.
// Contract: sets window.__kunWeb = { id, ready, needsLogin, limitHit, busy, send, lastAnswer, transcript }. Idempotent.
(() => {
  const id = 'chatgpt';
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
  // ---- ChatGPT (chatgpt.com) — selectors verified 2026-11-24 (logged-out DOM) + known logged-in testids ----
  const composer = () => first(['#prompt-textarea', 'div.ProseMirror[contenteditable="true"]', 'textarea[name="prompt-textarea"]', 'textarea[placeholder*="Ask" i]', 'textarea'].filter(Boolean));
  const sendBtn = () => first(['[data-testid="send-button"]', 'button[aria-label="Send prompt"]', 'button[aria-label="Send message"]']);
  const stopBtn = () => first(['[data-testid="stop-button"]', 'button[aria-label="Stop streaming"]', 'button[aria-label="Stop generating"]']);
  // two DOMs seen on 2026-11-24: the classic [data-message-author-role] and the newer <li data-message-role> transcript (the logged-out page serves it)
  const turns = () => $$('[data-message-author-role], li[data-message-role]');
  const roleOf = (el) => ((el.getAttribute('data-message-author-role') || el.getAttribute('data-message-role')) === 'user' ? 'user' : 'assistant');
  const textOf = (el) => (roleOf(el) === 'user'
    ? ($('[data-user-message-bubble]', el) || el).innerText.trim()
    : md($('[data-assistant-markdown-root], .markdown', el) || el));
  const LIMIT = /(you['’]ve (hit|reached) (the|your|our)[^\n]*limit[^\n]*|you['’]re (sending|chatting) (messages )?too (fast|quickly)[^\n]*|too many (requests|messages)[^\n]*|(free )?(plan )?usage (cap|limit)[^\n]*(reached|hit)[^\n]*|limit (reached|hit)[^\n]*come back[^\n]*)/i;
  window.__kunWeb = {
    id,
    ready: () => visible(composer()),
    needsLogin: () => {
      if ($('[data-testid="profile-button"], [data-testid="accounts-profile-button"]')) return false;
      if (location.pathname.startsWith('/auth') || /auth\.openai\.com|\/log-?in/.test(location.href)) return true;
      return !!$('[data-testid="login-button"], [data-testid="signup-button"]') || $$('a,button').some((b) => /^(log in|sign up for free)$/i.test((b.innerText || '').trim()) && visible(b));
    },
    limitHit: () => limitLine(LIMIT),
    busy: () => !!stopBtn() || !!$('.result-streaming, [data-is-streaming="true"]') || (() => { const a = turns().filter((t) => roleOf(t) === 'assistant'); const l = a[a.length - 1]; return !!l && l.hasAttribute('data-message-role') && !l.hasAttribute('data-message-complete'); })(),
    send: async (text) => {
      const c = composer();
      if (!c) throw new Error('chatgpt: no composer');
      await fill(c, text);
      for (let i = 0; i < 40; i++) { // the send button wakes once React has seen the text
        const b = sendBtn();
        if (enabled(b)) { b.click(); return; }
        await pause(150);
      }
      c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    },
    lastAnswer: () => {
      const a = turns().filter((t) => roleOf(t) === 'assistant');
      return a.length ? textOf(a[a.length - 1]) : '';
    },
    transcript: () => turns().map((t) => ({ role: roleOf(t), text: textOf(t) })),
  };
})();
