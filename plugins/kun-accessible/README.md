# kun-accessible

Accessibility-first overlay. Stacks on any role profile.

## Effects

- Verbose status: every step prints "Starting X… Done X." (no hidden state)
- Semantic markers: ❌→"FAIL", ✓→"OK", 🔧→"FIX" (no emoji)
- Linear structure: ordered lists preferred; tables only when essential
- Screen-reader-friendly: every interactive section has a heading the reader can navigate to

## Designed for

- Samia (blind, R&D + kun caretaker, Dell Windows + iPhone 13 Mini)
- Ali (blind, QA + sales, Windows + Android)

## Install

```bash
# Stack on your role profile
claude --plugin-dir /path/to/kun/plugins/kun-core \
       --plugin-dir /path/to/kun/plugins/kun-captain \
       --plugin-dir /path/to/kun/plugins/kun-content \
       --plugin-dir /path/to/kun/plugins/kun-accessible
```

The accessible plugin's `env` and output-style overrides apply across all loaded plugins.

## Tested with

- VoiceOver (macOS) — partial; primary target is Windows
- NVDA (Windows) — primary target
- JAWS (Windows) — secondary

## Known limitations

- Some captain dispatches still produce emoji glyphs from upstream content (Slack channels, GitHub issue templates). Track in `report` issues.
- Color-coded agent frontmatter (E21.5) is informational only — output style strips colors when this plugin is active.

## License

SSPL-1.0
