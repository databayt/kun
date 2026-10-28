"""wa-pull.py — copy one WhatsApp Desktop chat's media to a folder, full resolution, with a manifest.

  uv run --with cryptography python wa-pull.py --chat "<chat name>" --since 2026-10-27 --out <dir> [--types image,video] [--dry-run]

Reads a COPY of WhatsApp Desktop's ChatStorage.sqlite (db + wal + shm, taken into a temp dir), so the
live app is never locked. Media already on disk (Message/<ZMEDIALOCALPATH>) is copied; the rest is
fetched from its mmg.whatsapp.net URL and decrypted with the message's own media key
(HKDF-SHA256 → AES-256-CBC, the 10-byte MAC checked before anything is written).

Output: <out>/<YYYY-MM-DD>/<YYYYMMDD-HHMMSS>-<nnn>-<me|them>.<ext> plus <out>/manifest.jsonl
(one row per message: n, date, from, type, bytes, sha256, src local|cdn, file, seconds, dupe_of).
A byte-identical re-send is listed with dupe_of and not written twice. Nothing about the chat is
hard-coded: name and dates are arguments, so this file can live in a public repo.
"""
import argparse
import hashlib
import hmac
import json
import shutil
import sqlite3
import sys
import tempfile
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

STORE = Path.home() / "Library/Group Containers/group.net.whatsapp.WhatsApp.shared"
EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc)  # Core Data reference date
TYPES = {1: "image", 2: "video", 3: "audio", 8: "document"}
INFO = {"image": b"WhatsApp Image Keys", "video": b"WhatsApp Video Keys",
        "audio": b"WhatsApp Audio Keys", "document": b"WhatsApp Document Keys"}
EXT = {"image": "jpg", "video": "mp4", "audio": "opus", "document": "bin"}


def media_key(blob: bytes) -> bytes:
    # Stored as a small protobuf: field 1 (0x0a), length 32 (0x20), then the key.
    if len(blob) >= 34 and blob[0] == 0x0A and blob[1] == 0x20:
        return blob[2:34]
    if len(blob) == 32:
        return blob
    raise ValueError(f"unexpected media key blob ({len(blob)} bytes)")


def decrypt(enc: bytes, key: bytes, kind: str) -> bytes:
    expanded = HKDF(algorithm=hashes.SHA256(), length=112, salt=None, info=INFO[kind]).derive(key)
    iv, cipher_key, mac_key = expanded[:16], expanded[16:48], expanded[48:80]
    body, mac = enc[:-10], enc[-10:]
    if not hmac.compare_digest(hmac.new(mac_key, iv + body, hashlib.sha256).digest()[:10], mac):
        raise ValueError("MAC mismatch")
    dec = Cipher(algorithms.AES(cipher_key), modes.CBC(iv)).decryptor()
    plain = dec.update(body) + dec.finalize()
    unpad = padding.PKCS7(128).unpadder()
    return unpad.update(plain) + unpad.finalize()


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "WhatsApp/2.24 Mac"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chat", required=True, help="chat name exactly as WhatsApp shows it")
    ap.add_argument("--since", required=True, help="YYYY-MM-DD (UTC), inclusive")
    ap.add_argument("--until", help="YYYY-MM-DD (UTC), inclusive")
    ap.add_argument("--types", default="image,video,audio,document")
    ap.add_argument("--out", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    want = {t.strip() for t in a.types.split(",")}
    codes = [c for c, t in TYPES.items() if t in want]
    lo = (datetime.fromisoformat(a.since).replace(tzinfo=timezone.utc) - EPOCH).total_seconds()
    hi = ((datetime.fromisoformat(a.until).replace(tzinfo=timezone.utc) + timedelta(days=1) - EPOCH).total_seconds()
          if a.until else 1e12)

    tmp = Path(tempfile.mkdtemp(prefix="wa-pull-"))
    for suffix in ("", "-wal", "-shm"):
        src = STORE / f"ChatStorage.sqlite{suffix}"
        if src.exists():
            shutil.copy2(src, tmp / src.name)
    db = sqlite3.connect(f"file:{tmp / 'ChatStorage.sqlite'}?mode=ro", uri=True)

    chats = db.execute("SELECT Z_PK FROM ZWACHATSESSION WHERE ZPARTNERNAME = ?", (a.chat,)).fetchall()
    if len(chats) != 1:
        print(f"chat {a.chat!r}: {len(chats)} matches (need exactly 1)", file=sys.stderr)
        return 2
    rows = db.execute(
        f"""SELECT m.Z_PK, m.ZMESSAGEDATE, m.ZISFROMME, m.ZMESSAGETYPE, mi.ZMEDIALOCALPATH, mi.ZMEDIAURL,
                   mi.ZMEDIAKEY, mi.ZFILESIZE, mi.ZMOVIEDURATION, mi.ZTITLE
            FROM ZWAMESSAGE m JOIN ZWAMEDIAITEM mi ON mi.Z_PK = m.ZMEDIAITEM
            WHERE m.ZCHATSESSION = ? AND m.ZMESSAGETYPE IN ({",".join("?" * len(codes))})
              AND m.ZMESSAGEDATE >= ? AND m.ZMESSAGEDATE < ?
            ORDER BY m.ZMESSAGEDATE, m.Z_PK""",
        (chats[0][0], *codes, lo, hi)).fetchall()
    db.close()
    shutil.rmtree(tmp, ignore_errors=True)

    out = Path(a.out).expanduser()
    seen: dict[str, str] = {}
    manifest = []
    seq: dict[str, int] = {}
    failed = 0
    for pk, ts, me, code, local, url, keyblob, size, secs, title in rows:
        kind = TYPES[code]
        when = EPOCH + timedelta(seconds=ts)
        day = when.strftime("%Y-%m-%d")
        seq[day] = seq.get(day, 0) + 1
        ext = EXT[kind]
        if kind == "document" and title and "." in title:
            ext = title.rsplit(".", 1)[1].lower()
        name = f"{when:%Y%m%d-%H%M%S}-{seq[day]:03d}-{'me' if me else 'them'}.{ext}"
        row = {"n": len(manifest) + 1, "msg": pk, "date": when.isoformat(), "from": "me" if me else "them",
               "type": kind, "bytes": size, "seconds": round(secs or 0, 1), "file": f"{day}/{name}"}
        if a.dry_run:
            row["src"] = "local" if local and (STORE / "Message" / local).exists() else "cdn"
            manifest.append(row)
            continue
        try:
            if local and (STORE / "Message" / local).exists():
                data, row["src"] = (STORE / "Message" / local).read_bytes(), "local"
            else:
                if not url or not keyblob:
                    raise ValueError("no url or key")
                data, row["src"] = decrypt(fetch(url), media_key(keyblob), kind), "cdn"
        except Exception as e:  # keep going; report at the end
            row["error"] = str(e)
            failed += 1
            manifest.append(row)
            print(f"  ! {row['file']}: {e}", file=sys.stderr)
            continue
        digest = hashlib.sha256(data).hexdigest()
        row["sha256"] = digest
        if digest in seen:
            row["dupe_of"] = seen[digest]
        else:
            seen[digest] = row["file"]
            (out / day).mkdir(parents=True, exist_ok=True)
            (out / day / name).write_bytes(data)
        manifest.append(row)

    if not a.dry_run:
        out.mkdir(parents=True, exist_ok=True)
        with open(out / "manifest.jsonl", "w") as f:
            for row in manifest:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
    uniq = len(seen)
    dupes = sum(1 for r in manifest if "dupe_of" in r)
    print(f"{len(manifest)} media messages · {uniq} unique written · {dupes} duplicates · {failed} failed"
          + (" (dry run)" if a.dry_run else f" → {out}"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
