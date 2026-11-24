// finder.mjs — the simulated macOS 27 Finder "Open" window (Liquid Glass) and on-page cursor.
// Headless Chrome never draws the native panel, so the video (sim.mjs) and the stills (shoot
// flows) both draw this one. Real thumbnails, real file names; the upload itself stays real.
import { readFileSync } from "node:fs"

// The in-page overlay: cursor, ripple, Finder window. `__finderOpen(files, home)` lists `files` in `home`.
export const OVERLAY = `(() => {
  const css = \`
    #__sim{position:fixed;inset:0;pointer-events:none;z-index:2147483646}
    #__cur{position:absolute;left:0;top:0;width:22px;height:22px;transform:translate(-3px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));z-index:3}
    .__rip{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #00bc6e;animation:__r .55s ease-out forwards;z-index:2}
    @keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
    #__fd{position:absolute;inset:0;display:none;pointer-events:auto;z-index:1;direction:ltr;font:13px -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:#1d1d1f;-webkit-font-smoothing:antialiased}
    #__fd.on{display:block}
    #__fw{position:absolute;left:50%;top:96px;width:720px;height:440px;transform:translateX(-50%);border-radius:26px;overflow:hidden;
      background:rgba(248,248,250,.94);backdrop-filter:blur(40px) saturate(180%);box-shadow:0 22px 60px rgba(0,0,0,.28),0 0 0 .5px rgba(0,0,0,.22);
      display:grid;grid-template-columns:196px 1fr;grid-template-rows:56px 1fr 60px}
    #__fw .side{grid-row:1/3;margin:8px 0 0 8px;border-radius:18px;background:rgba(232,232,237,.85);padding:44px 10px 10px;position:relative}
    #__fw .lights{position:absolute;top:16px;left:16px;display:flex;gap:8px}
    #__fw .lights i{width:12px;height:12px;border-radius:50%;display:block}
    #__fw .side .h{font-size:11px;font-weight:600;color:#86868b;margin:10px 8px 4px}
    #__fw .side .it{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:9px;color:#1d1d1f}
    #__fw .side .it svg{width:16px;height:16px;flex:none;color:#0a84ff}
    #__fw .side .it.sel{background:rgba(0,0,0,.09)}
    #__fw .side .tag{width:10px;height:10px;border-radius:50%;margin:0 3px}
    #__fw .tb{display:flex;align-items:center;gap:10px;padding:0 14px 0 12px}
    #__fw .cap{display:flex;align-items:center;gap:2px;height:32px;padding:0 6px;border-radius:16px;background:rgba(255,255,255,.75);box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 3px rgba(0,0,0,.06);color:#3a3a3c}
    #__fw .cap span{padding:0 7px;font-size:15px}
    #__fw .ttl{font-weight:700;font-size:15px;margin:0 4px}
    #__fw .srch{margin-left:auto;width:170px;color:#8e8e93;padding:0 12px}
    #__fw .files{padding:18px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px 10px;align-content:start;overflow:hidden}
    #__fw .f{display:flex;flex-direction:column;align-items:center;gap:7px;padding:8px 4px;border-radius:10px;text-align:center}
    #__fw .f .ic{width:86px;height:86px;display:grid;place-items:center}
    #__fw .f .ic img{max-width:86px;max-height:86px;box-shadow:0 1px 4px rgba(0,0,0,.18),0 0 0 .5px rgba(0,0,0,.12);background:#fff}
    #__fw .f .nm{font-size:12px;line-height:1.3;max-width:120px;padding:1px 6px;border-radius:5px;direction:rtl}
    #__fw .f.sel{background:rgba(0,0,0,.07)}
    #__fw .f.sel .nm{background:#0a84ff;color:#fff}
    #__fw .foot{grid-column:1/3;display:flex;align-items:center;gap:10px;padding:0 16px}
    #__fw .btn{height:32px;display:grid;place-items:center;padding:0 20px;border-radius:16px;background:rgba(255,255,255,.8);box-shadow:0 0 0 .5px rgba(0,0,0,.14),0 1px 2px rgba(0,0,0,.06);font-weight:500}
    #__fw .btn.opts{margin-right:auto}
    #__fw .btn.pri{background:#0a84ff;color:#fff;box-shadow:none;opacity:.45}
    #__fw .btn.pri.ok{opacity:1}\`
  const ico = {
    airdrop: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><circle cx='8' cy='8' r='2'/><path d='M4.5 11.5a5 5 0 1 1 7 0M2.4 13.6a8 8 0 1 1 11.2 0'/></svg>",
    recents: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><circle cx='8' cy='8' r='6.2'/><path d='M8 4.6V8l2.4 1.6'/></svg>",
    apps: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><path d='M8 1.8 3 14.2M8 1.8l5 12.4M4.6 10h6.8'/></svg>",
    desktop: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><rect x='1.8' y='2.6' width='12.4' height='8.6' rx='1.4'/><path d='M5.5 14h5M8 11.2V14'/></svg>",
    docs: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><path d='M4 1.8h5.5L12.5 5v9.2H4z'/><path d='M9.5 1.8V5h3'/></svg>",
    down: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><circle cx='8' cy='8' r='6.2'/><path d='M8 4.5v6.2M5.4 8.3 8 10.9l2.6-2.6'/></svg>",
    mac: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><rect x='2.6' y='3' width='10.8' height='7.4' rx='1'/><path d='M1 12.6h14'/></svg>",
    cloud: "<svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.4'><path d='M4.4 12.5a3 3 0 0 1-.3-6 4 4 0 0 1 7.7 1.2 2.4 2.4 0 0 1 .2 4.8z'/></svg>",
  }
  const finder = () => \`
    <div id="__fw">
      <div class="side"><div class="lights"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
        <div class="h">Favorites</div>
        <div class="it">\${ico.airdrop}AirDrop</div><div class="it" data-k="recents">\${ico.recents}Recents</div>
        <div class="it">\${ico.apps}Applications</div><div class="it" data-k="desktop">\${ico.desktop}Desktop</div>
        <div class="it" data-k="documents">\${ico.docs}Documents</div><div class="it" data-k="downloads">\${ico.down}Downloads</div>
        <div class="h">Locations</div><div class="it">\${ico.mac}MacBook Pro</div><div class="it">\${ico.cloud}iCloud Drive</div>
        <div class="h">Tags</div><div class="it"><span class="tag" style="background:#ff453a"></span>Red</div><div class="it"><span class="tag" style="background:#30d158"></span>Green</div></div>
      <div class="tb"><div class="cap"><span>‹</span><span>›</span></div><div class="ttl">Recents</div>
        <div class="cap" style="margin-left:6px"><span>▦</span><span>☰</span></div><div class="cap srch">⌕&nbsp; Search</div></div>
      <div class="files"></div>
      <div class="foot"><span class="btn opts">Show Options</span><span class="btn" data-k="cancel">Cancel</span><span class="btn pri" data-k="open">Open</span></div>
    </div>\`
  const mount = () => {
    if (document.getElementById("__sim")) return
    const root = document.createElement("div"); root.id = "__sim"
    root.innerHTML = "<style>" + css + "</style><svg id='__cur' viewBox='0 0 22 22'><path d='M2 1 L2 18 L6.5 13.8 L9.6 20.6 L12.6 19.3 L9.6 12.7 L15.6 12.7 Z' fill='#0a0a0a' stroke='#fff' stroke-width='1.4' stroke-linejoin='round'/></svg><div id='__fd'></div>"
    document.documentElement.appendChild(root)
    const s = JSON.parse(sessionStorage.__sim || "{}")
    const c = root.querySelector("#__cur"); c.style.left = (s.x ?? innerWidth * .55) + "px"; c.style.top = (s.y ?? innerHeight * .5) + "px"
  }
  const save = (p) => { sessionStorage.__sim = JSON.stringify({ ...JSON.parse(sessionStorage.__sim || "{}"), ...p }) }
  window.__simMove = (x, y, ms) => new Promise((done) => {
    mount(); const c = document.getElementById("__cur")
    const x0 = parseFloat(c.style.left), y0 = parseFloat(c.style.top), t0 = performance.now(), bend = (Math.random() - .5) * 50
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2
      c.style.left = (x0 + (x - x0) * e) + "px"; c.style.top = (y0 + (y - y0) * e + Math.sin(Math.PI * e) * bend * .4) + "px"
      if (k < 1) requestAnimationFrame(step); else { save({ x, y }); done() }
    }
    requestAnimationFrame(step)
  })
  window.__simRipple = (x, y) => { mount(); const r = document.createElement("div"); r.className = "__rip"; r.style.left = x + "px"; r.style.top = y + "px"; document.getElementById("__sim").appendChild(r); setTimeout(() => r.remove(), 600) }
  window.__finderOpen = (files, home = "downloads") => {
    mount(); const fd = document.getElementById("__fd"); fd.innerHTML = finder(); fd.classList.add("on")
    const show = (k) => {
      fd.querySelectorAll(".side .it").forEach((e) => e.classList.toggle("sel", e.dataset.k === k))
      fd.querySelector(".ttl").textContent = { recents: "Recents", downloads: "Downloads", desktop: "Desktop", documents: "Documents" }[k] || k
      fd.querySelector(".files").innerHTML = (k === home ? files : []).map((f) =>
        "<div class='f' data-f='" + f.name + "'><div class='ic'><img src='" + f.thumb + "'></div><div class='nm'>" + f.name + "</div></div>").join("")
      save({ folder: k })
    }
    show(JSON.parse(sessionStorage.__sim || "{}").folder || "recents")
    fd.onclick = (ev) => {
      const it = ev.target.closest("[data-k],.f"); if (!it) return
      if (it.classList.contains("it")) show(it.dataset.k)
      else if (it.classList.contains("f")) {
        fd.querySelectorAll(".f").forEach((e) => e.classList.remove("sel")); it.classList.add("sel")
        fd.querySelector("[data-k=open]").classList.add("ok")
      }
    }
  }
  window.__finderClose = () => { const fd = document.getElementById("__fd"); if (fd) { fd.classList.remove("on"); fd.innerHTML = "" } }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", mount); else mount()
  new MutationObserver(() => mount()).observe(document, { childList: true })
})()`

/** Stills: open the Finder on `folder`, select `pick` — no cursor, nothing clicked in the app. */
export async function finderStill(page, { files, pick, folder = "documents" }) {
  // a non-image (a CSV) brings its own Quick Look picture as `thumb`
  const list = files.map((f) => ({ name: f.name, thumb: "data:image/jpeg;base64," + readFileSync(f.thumb || f.path).toString("base64") }))
  await page.evaluate(OVERLAY)
  await page.evaluate(([list, folder]) => {
    document.getElementById("__cur").style.display = "none"
    window.__finderOpen(list, folder)
  }, [list, folder])
  await page.locator(`#__fd .side [data-k=${folder}]`).click()
  await page.locator(`#__fd .f[data-f="${pick.name}"]`).click()
}

export const finderClose = (page) => page.evaluate(() => window.__finderClose())
