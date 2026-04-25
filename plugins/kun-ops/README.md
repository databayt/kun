# kun-ops

Role profile for operations. Tuned for Sedon (Saudi ops + DevOps).

## Effective surface

Allowed:
- `/deploy`, `/ship`, `/watch` — full deployment pipeline
- `/monitor`, `/costs`, `/incident`, `/health` — observability + response
- `/coverage`, `/report`, `/package` — health checks + dependency audits
- All captain ceremonies (`/captain`, `/weekly`, `/standup`, `/dispatch`)

Denied:
- `/schema`, `/code`, `/wire` — engineering pipeline stages (handled by engineer profile)

## Install

```bash
claude --plugin-dir /path/to/kun/plugins/kun-core \
       --plugin-dir /path/to/kun/plugins/kun-captain \
       --plugin-dir /path/to/kun/plugins/kun-ops
```

## License

SSPL-1.0
