# Shared org memory

Every coding agent on every machine reads and writes this memory. The repo is **public**, so it is split in two:

| Where | What | In git as |
| --- | --- | --- |
| `.claude/memory/facts/` | engine facts, conventions, gotchas, tool notes: anything safe for the world to read | plaintext, one fact per file |
| `.claude/memory/private/` | customers, pipeline, revenue, people, decisions, prices offered, contacts, money | **encrypted** (`<name>.enc`, sops + age) |

Decrypted copies live only on your machine at `~/.kun/memory-private/<same path>` (chmod 600). Never commit them, never paste them into a public issue or doc.

## Write rules (facts)

1. **One fact per file**, named `kebab-case.md`. If you need "and", it is two facts.
2. Frontmatter, same as Claude Code memory:
   ```
   ---
   name: kebab-case-name          # equals the filename without .md
   description: one line, what the fact is and when it applies
   type: reference | feedback | project | user
   ---
   **TL;DR in bold.** Then the body. Say Why and How to apply.
   ```
3. Link other facts with `[[name]]`. Link private facts only by name in prose (never quote their content).
4. Add one line to `MEMORY.md` (index): `- [Title](file.md) - short executive summary`.
5. No names with phone numbers or emails, no prices offered, no revenue, no keys. If in doubt it is private: put it under `private/` (create it in `~/.kun/memory-private/<path>`, run `memory.mjs sync`).
6. Compress a file when you touch it; move finished topics to `archive/`.

## Daily use

```
node .claude/scripts/memory/memory.mjs sync      # pull, decrypt, re-encrypt your edits, commit memory paths only, push
node .claude/scripts/memory/memory.mjs status    # what is local-only, edited, or still plaintext in the repo
```

A conflict (both sides edited the same private file) never overwrites anything: the remote version is saved next to yours as `<file>.theirs`; merge by hand and sync again.

## Enrol a teammate

1. They install `brew install sops age`, run `age-keygen -o ~/.config/sops/age/keys.txt` (chmod 600), and open an issue "memory access: <name>" containing **only the public key** (`age1...`). Never the file.
2. The owner reviews and runs `node .claude/scripts/memory/memory.mjs add-recipient age1...`, then `memory.mjs sync` (re-keys every `.enc` and commits `.sops.yaml` + `private/`).
3. The teammate pulls and runs `memory.mjs sync`. To remove someone: delete their key from `.sops.yaml`, re-key, and **rotate the contents they could read**: git history still holds what the old key opened.

Lose the private key and the encrypted files are gone: back up `~/.config/sops/age/keys.txt` (password manager), never in the repo.

## Guard

`.githooks/pre-commit` blocks plaintext in `private/` and secret patterns in staged lines. Install per clone: `git config core.hooksPath .githooks` (setup.sh should run it; see `encrypt-plan.md`).
