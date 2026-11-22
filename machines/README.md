# machines — who gets what

One JSON file per teammate machine: `machines/<login>.json`. The login is the file name and
the `login` field, lowercase `[a-z0-9-]`. machine loads the file for the login saved in its
settings (`setup.ps1 --machine <login>`); no login or no file means the full-access default,
which is how the founder's own Mac behaves.

| Field | Meaning |
| --- | --- |
| `login` | Same as the file name. |
| `name` | Display name (Arabic first). |
| `os` | `windows`, `macos` or `linux`. Informational. |
| `driver` | Agent CLI the machine locks to (`claude`, `codex`, `opencode`). Omit to let the person pick. |
| `department` | The default department, set by the machine ID: Machine opens in it and the task board starts there. Must be one of `departments`; omitted means the first. |
| `departments` | The departments this machine is authorized for (switchable in Machine → Settings → General). Packs from `departments/<name>/`. Only their skills and agents are installed and linked. |
| `repos` | Public databayt repos cloned read-only into `~/Kun/repos/<name>` and added to every run. |
| `access.code` | `read`: the generated `--settings` denies Edit/Write under `repos/**`, `git push`, `git commit`, `rm`. `write`: no such denies. |
| `access.workspace` | `write`: runs may write in `~/Kun/<login>/work/`. `none`: nowhere. |
| `access.catalog` | `profile`: the catalog lists, installs and uninstalls only the profile's packs and what they need. `all`: everything. |
| `access.engine` | Whether the Engine section is shown. |
| `secrets` | Names the person may store in the OS credential store (Keychain / Credential Manager). Passed to a run as environment variables, never shown to the UI. |
| `launchers` | Optional list of launcher letters (`c`, `a`, `o`, `h`; see `.claude/machine/launchers.json`) written to the shell's managed block. Omit for every launcher whose agent is installed. |
| `hidden` | Catalog ids (`skill:edit`) this machine never gets, even inside its packs: not in the menu, not installable, not linked into the workspace. Use it for lanes that need someone else's credentials or another OS (see `moed.md`). |

The registry (`pnpm kun:registry`) publishes each file as a `kun:machine` item that depends on
its departments' packs. A missing `access` block means least privilege (read, workspace write,
catalog profile, no engine). This is configuration, not a security wall: the person is an
administrator on their own laptop, so the real boundary is that they only receive what the
profile lists.
