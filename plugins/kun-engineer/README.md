# kun-engineer

The default role profile for builders. Opens up the full surface of `kun-core` skills.

## Depends on

- `kun-core` (full specialist surface)
- `kun-captain` (optional — engineers benefit from `/weekly` summaries)

## Effective surface

All 60 skills from `kun-core` are invokable. No `Skill(...)` deny rules.

Suitable for: Abdout (founder + lead engineer).

## Install

```bash
claude --plugin-dir /path/to/kun/plugins/kun-core \
       --plugin-dir /path/to/kun/plugins/kun-captain \
       --plugin-dir /path/to/kun/plugins/kun-engineer
```

## License

SSPL-1.0
