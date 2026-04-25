# kun-business

Role profile for business operations. Tuned for Ali (sales + QA + outreach).

## Effective surface

Allowed:
- `/weekly`, `/captain`, `/sprint-plan`, `/standup`, `/sprint-review`, `/refine` — captain ceremonies
- `/proposal`, `/pricing`, `/content-calendar` — revenue + growth tools
- `/monitor`, `/costs`, `/coverage`, `/health` — observability
- `/dispatch`, `/idea`, `/spec`, `/issue`, `/report` — communication + reporting
- `/repos`, `/codebase`, `/screenshot`, `/docs`, `/credentials` — utilities

Denied:
- `/deploy`, `/ship` — production deployment is engineer-only
- `/schema`, `/code`, `/wire`, `/check` — engineering pipeline stages

## Install

```bash
claude --plugin-dir /path/to/kun/plugins/kun-core \
       --plugin-dir /path/to/kun/plugins/kun-captain \
       --plugin-dir /path/to/kun/plugins/kun-business
```

## License

SSPL-1.0
