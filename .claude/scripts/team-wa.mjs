#!/usr/bin/env node
// team-wa — read the team's WhatsApp group from this Mac's WhatsApp Desktop, read-only.
//
//   node team-wa.mjs find "المدرسة 2.0"        group names + ids only, nothing else
//   node team-wa.mjs use <chat-pk>             remember which group is the team group
//   node team-wa.mjs status                    how many messages since the last read
//   node team-wa.mjs read [--all] [--since YYYY-MM-DD] [--no-advance]
//                                              new messages → transcript + inbox, cursor moves
//   node team-wa.mjs members                   who is in the group (names; phones masked)
//
// The gate (CEO desk, 2026-11-08): this script only READS. Nothing is ever posted from here;
// a post goes out only after Abdout says "send" for that exact draft (captain skill).
// WhatsApp keeps its database open, so we read a snapshot copy (db + wal + shm).
// All data stays in ~/.claude/state/team/ — outside every git repo. Only this generic
// script is committed. Pattern: mkan scripts/wa/chats.ts.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

const APP = join(homedir(), "Library/Group Containers/group.net.whatsapp.WhatsApp.shared")
const STATE = process.env.TEAM_STATE_DIR || join(homedir(), ".claude/state/team")
const SNAP = join(STATE, "snap")
const CONFIG = join(STATE, "config.json")
const CURSOR = join(STATE, "cursor.json")
const PEOPLE = join(STATE, "people.json") // optional { "<member jid>": "Display name" }
const APPLE_EPOCH = 978_307_200
const TZ = "Africa/Khartoum" // the team's clock (Kigali is the same offset)

const TYPES = { 0: "text", 1: "image", 2: "video", 3: "voice", 4: "contact", 5: "location", 6: "event", 7: "link", 8: "document", 10: "system", 11: "gif", 14: "deleted", 15: "sticker" }

const readJson = (file, empty) => {
  try { return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : empty } catch { return empty }
}
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const has = (name) => process.argv.includes(name)
const mask = (jid) => { const d = String(jid || "").replace(/@.*/, "").replace(/\D/g, ""); return d ? `…${d.slice(-3)}` : "?" }
const when = (appleSeconds) => new Date((appleSeconds + APPLE_EPOCH) * 1000)
const fmt = (d) => d.toLocaleString("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "")
const day = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ })

function snapshot() {
  const src = join(APP, "ChatStorage.sqlite")
  if (!existsSync(src)) {
    console.error(`No WhatsApp Desktop database at ${APP} — is WhatsApp installed and signed in on this Mac?`)
    process.exit(1)
  }
  mkdirSync(SNAP, { recursive: true })
  for (const ext of ["", "-wal", "-shm"]) {
    const from = join(APP, "ChatStorage.sqlite" + ext)
    if (existsSync(from)) copyFileSync(from, join(SNAP, "ChatStorage.sqlite" + ext))
  }
  return new DatabaseSync(join(SNAP, "ChatStorage.sqlite"), { readOnly: true })
}

function chatPk() {
  const pk = Number(arg("--chat") || readJson(CONFIG, {}).pk)
  if (!pk) { console.error('No team group set. Run: team-wa.mjs find "<name>" then team-wa.mjs use <pk>'); process.exit(2) }
  return pk
}

// A readable name, or null. Phone-number labels and the encoded ZCONTACTNAME blobs ("+CgAQ…=")
// are not names — a bare number never leaves this script unmasked.
const readable = (s) => {
  const t = String(s || "").replace(/[‎‏‪-‮]/g, "").trim()
  if (!t || /^\+?[\d\s()-]+$/.test(t) || /^\+[A-Za-z0-9+/]+=*$/.test(t)) return null
  return t
}

function nameBook(db, pk) {
  const people = readJson(PEOPLE, {})
  // The name Abdout saved for each person lives on their one-to-one chat row.
  const saved = new Map()
  for (const s of db.prepare("SELECT ZCONTACTJID, ZPARTNERNAME FROM ZWACHATSESSION WHERE ZSESSIONTYPE = 0").all()) saved.set(s.ZCONTACTJID, s.ZPARTNERNAME)
  const push = new Map()
  for (const p of db.prepare("SELECT ZJID, ZPUSHNAME FROM ZWAPROFILEPUSHNAME").all()) if (p.ZPUSHNAME) push.set(p.ZJID, p.ZPUSHNAME)
  const members = new Map()
  for (const m of db.prepare("SELECT Z_PK, ZMEMBERJID, ZFIRSTNAME, ZISADMIN, ZISACTIVE FROM ZWAGROUPMEMBER WHERE ZCHATSESSION = ?").all(pk)) members.set(m.Z_PK, m)
  const me = people.me || "Abdout"
  const byJid = (jid) => {
    const s = readable(saved.get(jid))
    if (s === "You") return me // WhatsApp labels Abdout's own row "You"
    return people[jid] || s || readable(push.get(jid)) || mask(jid)
  }
  return { members, byJid, me }
}

function senderNamer(db, pk) {
  const book = nameBook(db, pk)
  return (row) => {
    if (row.ZISFROMME) return book.me
    const m = book.members.get(row.ZGROUPMEMBER)
    return book.byJid(m?.ZMEMBERJID || row.ZFROMJID)
  }
}

function messages(db, pk, sinceApple) {
  return db.prepare(`
    SELECT m.Z_PK, m.ZMESSAGEDATE, m.ZISFROMME, m.ZFROMJID, m.ZGROUPMEMBER, m.ZTEXT, m.ZMESSAGETYPE,
           m.ZPARENTMESSAGE, mi.ZTITLE AS caption, mi.ZMEDIALOCALPATH AS localPath, mi.ZMOVIEDURATION AS seconds
    FROM ZWAMESSAGE m LEFT JOIN ZWAMEDIAITEM mi ON mi.Z_PK = m.ZMEDIAITEM
    WHERE m.ZCHATSESSION = ? AND m.ZMESSAGEDATE > ?
    ORDER BY m.ZMESSAGEDATE, m.Z_PK`).all(pk, sinceApple)
}

const cmd = process.argv[2]

if (cmd === "find") {
  const q = process.argv[3] || ""
  const db = snapshot()
  const rows = db.prepare(`SELECT s.Z_PK AS pk, s.ZPARTNERNAME AS name,
      (SELECT count(*) FROM ZWAGROUPMEMBER g WHERE g.ZCHATSESSION = s.Z_PK) AS members,
      s.ZLASTMESSAGEDATE AS last
    FROM ZWACHATSESSION s WHERE s.ZSESSIONTYPE = 1 AND s.ZPARTNERNAME LIKE ? ORDER BY s.ZLASTMESSAGEDATE DESC`).all(`%${q}%`)
  for (const r of rows) console.log(`${r.pk}\t${r.name}\t${r.members} members\tlast ${r.last ? fmt(when(r.last)) : "—"}`)
  if (!rows.length) console.log("no group matches")
} else if (cmd === "use") {
  const pk = Number(process.argv[3])
  const db = snapshot()
  const s = db.prepare("SELECT Z_PK AS pk, ZPARTNERNAME AS name, ZCONTACTJID AS jid FROM ZWACHATSESSION WHERE Z_PK = ? AND ZSESSIONTYPE = 1").get(pk)
  if (!s) { console.error(`no group with id ${pk}`); process.exit(2) }
  mkdirSync(STATE, { recursive: true })
  writeFileSync(CONFIG, JSON.stringify({ pk: s.pk, name: s.name, jid: s.jid, setAt: new Date().toISOString() }, null, 2))
  console.log(`team group = ${s.name} (${s.pk}); state in ${STATE}`)
} else if (cmd === "members") {
  const pk = chatPk(); const db = snapshot(); const book = nameBook(db, pk)
  for (const m of book.members.values())
    console.log(`${book.byJid(m.ZMEMBERJID)}\t${mask(m.ZMEMBERJID)}${m.ZISADMIN ? "\tadmin" : ""}${m.ZISACTIVE === 0 ? "\tleft" : ""}`)
} else if (cmd === "status" || cmd === "read") {
  const pk = chatPk(); const db = snapshot()
  const cursor = readJson(CURSOR, {})
  const since = arg("--since") ? (new Date(`${arg("--since")}T00:00:00+02:00`).getTime() / 1000 - APPLE_EPOCH) : has("--all") ? 0 : (cursor[pk] ?? 0)
  const rows = messages(db, pk, since)
  if (cmd === "status") {
    const last = rows.at(-1)
    console.log(`${rows.length} new in ${readJson(CONFIG, {}).name || pk}${last ? ` · latest ${fmt(when(last.ZMESSAGEDATE))}` : ""}`)
    process.exit(0)
  }
  const name = senderNamer(db, pk)
  const byPk = new Map(rows.map((r) => [r.Z_PK, r]))
  mkdirSync(join(STATE, "inbox"), { recursive: true })
  const lines = []
  for (const r of rows) {
    const d = when(r.ZMESSAGEDATE); const type = TYPES[r.ZMESSAGETYPE] || `type${r.ZMESSAGETYPE}`
    const parent = r.ZPARENTMESSAGE && byPk.get(r.ZPARENTMESSAGE)
    const rec = { id: r.Z_PK, at: d.toISOString(), from: name(r), type, text: r.ZTEXT || "", caption: r.caption || "", media: r.localPath || "", seconds: r.seconds || 0, replyTo: r.ZPARENTMESSAGE || null }
    appendFileSync(join(STATE, "inbox", `${day(d)}.jsonl`), JSON.stringify(rec) + "\n")
    const body = type === "text" || type === "link" ? rec.text : `[${type}${rec.seconds ? ` ${Math.round(rec.seconds)}s` : ""}${rec.caption ? `: ${rec.caption}` : ""}${rec.text ? ` ${rec.text}` : ""}${rec.media ? "" : " · not downloaded"}]`
    lines.push(`${fmt(d)} | ${rec.from}${parent ? ` ↩ ${name(parent)}` : ""} | ${body.replace(/\s+/g, " ").trim()}`)
  }
  if (lines.length) appendFileSync(join(STATE, "transcript.md"), lines.join("\n") + "\n")
  console.log(lines.join("\n") || "nothing new")
  if (!has("--no-advance") && rows.length) {
    cursor[pk] = rows.at(-1).ZMESSAGEDATE
    writeFileSync(CURSOR, JSON.stringify(cursor, null, 2))
  }
} else {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 15).join("\n"))
}
