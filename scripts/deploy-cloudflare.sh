#!/usr/bin/env bash
# kun → Cloudflare Containers. Builds the Next standalone server on the Mac, wraps it
# in a COPY-only linux/amd64 image, smokes it locally, deploys it behind the Worker in
# cf/worker.js. Same lane as hogwarts and mkan; see DEPLOYMENT.md.
#
#   scripts/deploy-cloudflare.sh <env-file> build|smoke|deploy|all
#
# <env-file>  a dotenv with the PRODUCTION values (vercel env pull … + scripts/cf-keychain-env.sh
#             appended, so rotated values override Vercel's stale copies). Non-secret vars are
#             baked into the image as env.json; secrets go to the Worker via scripts/cf-secrets.sh.
# build       export the source, install, next build (standalone) with CF_CONTAINER=1
# smoke       docker build (linux/amd64) + run on :3300 against the env file's DATABASE_URL
#             (GET-only probes; nothing publishes), print the curl table and peak memory, stop
# deploy      wrangler deploy from the build dir (builds + pushes the image, needs Workers Paid)
#
# CF_SOURCE=<ref>|head|worktree  what to build (default head).
# CF_OVERLAY="a b c"             working-tree files copied over the export.
# CF_BUILD_DIR, CF_HEAP_MB (3072), NEXT_BUILD_CPUS (2): this 16 GB machine OOM-kills bigger builds
#             when other sessions are resident.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=${1:?dotenv with production values}; MODE=${2:-all}
ENV_FILE=$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")
BUILD_DIR=${CF_BUILD_DIR:-${TMPDIR:-/tmp}/kun-cf-build}
IMAGE=kun-cf:local

build() {
  local SOURCE=${CF_SOURCE:-head}
  rm -rf "$BUILD_DIR"; mkdir -p "$BUILD_DIR"
  if [[ "$SOURCE" == "worktree" ]]; then
    echo "==> copying the WORKING TREE ($(git rev-parse --short HEAD) + uncommitted changes) to $BUILD_DIR"
    rsync -a --exclude node_modules --exclude .next --exclude .source --exclude .vercel --exclude .wrangler \
      --exclude .git --exclude coverage --exclude playwright-report --exclude test-results ./ "$BUILD_DIR/" \
      || { rc=$?; [[ $rc == 23 || $rc == 24 ]] && echo "    (rsync $rc: files changed under us — another session is editing; continuing)" || exit $rc; }
  else
    local REF=$SOURCE; [[ "$REF" == "head" ]] && REF=HEAD
    echo "==> exporting $REF ($(git rev-parse --short "$REF")) to $BUILD_DIR"
    git archive "$REF" | tar -x -C "$BUILD_DIR"
    for f in ${CF_OVERLAY:-}; do mkdir -p "$BUILD_DIR/$(dirname "$f")"; cp -R "$f" "$BUILD_DIR/$f"; echo "    overlay: $f"; done
  fi
  cp .env "$BUILD_DIR/.env"                       # prisma.config.ts loads it; prod values override it below
  cd "$BUILD_DIR"

  echo "==> installing (postinstall: fumadocs-mdx + prisma generate)"
  pnpm install --frozen-lockfile --prefer-offline --silent
  node scripts/fetch-thmanyah.mjs 2>/dev/null || true   # fonts are fetch-only (prebuild does this on Vercel)

  echo "==> next build (standalone) with $ENV_FILE"
  export CF_CONTAINER=1 NODE_OPTIONS="--max-old-space-size=${CF_HEAP_MB:-3072}" NEXT_TELEMETRY_DISABLED=1 NEXT_BUILD_CPUS=${NEXT_BUILD_CPUS:-2}
  node cf/env-split.mjs "$ENV_FILE" run -- pnpm exec next build
  [[ -f .next/standalone/server.js ]] || { echo "ABORT: .next/standalone/server.js missing"; exit 1; }
  for p in web/install.sh content/docs content/carousels; do
    [[ -e ".next/standalone/$p" ]] && echo "    traced: $p" || echo "    WARNING: $p not traced into standalone"
  done

  echo "==> assembling: baked non-secret config"
  node cf/env-split.mjs "$ENV_FILE" config > .next/standalone/env.json
  echo "    env.json: $(node -e 'console.log(Object.keys(require("./.next/standalone/env.json")).length)') config vars; $(node cf/env-split.mjs "$ENV_FILE" secrets | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Object.keys(JSON.parse(s)).length))') secrets stay with the Worker"
  du -sh .next/standalone .next/static public | sed 's/^/    /'
}

smoke() {
  cd "$BUILD_DIR"
  echo "==> docker build (linux/amd64, COPY-only)"
  docker build --platform linux/amd64 -f Dockerfile.cf -t "$IMAGE" . 2>&1 | tail -3
  local DENV; DENV=$(mktemp -t kun-smoke.XXXXXX); trap 'rm -f "$DENV"' RETURN
  node cf/env-split.mjs "$ENV_FILE" docker > "$DENV"
  [[ -n "${SMOKE_DATABASE_URL:-}" ]] && printf 'DATABASE_URL=%s\n' "$SMOKE_DATABASE_URL" >> "$DENV"
  docker rm -f kun-cf-smoke >/dev/null 2>&1 || true
  echo "==> docker run :3300 (DATABASE_URL host: $(grep -E '^DATABASE_URL=' "$DENV" | tail -1 | sed -E 's#.*@([^/:]+).*#\1#'))"
  docker run -d --rm --name kun-cf-smoke --platform linux/amd64 -p 3300:3000 --memory 1g --env-file "$DENV" "$IMAGE" >/dev/null
  for i in $(seq 1 90); do curl -sf -o /dev/null http://localhost:3300/api/health && break; sleep 2; done
  echo "    boot: ${i}×2s"
  for p in /api/health /en /ar /en/docs /en/docs/keywords /en/graph /en/carousel/databayt/og-kun /en/social /en/login /install /api/social/canary /docs/onboarding; do
    printf "    %-32s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url} %{time_total}s' "http://localhost:3300$p")"
  done
  printf "    %-32s %s\n" "host kun.databayt.org /en" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: kun.databayt.org' http://localhost:3300/en)"
  printf "    %-32s %s\n" "canary w/ bearer" "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $(grep -E '^CRON_SECRET=' "$DENV" | tail -1 | cut -d= -f2-)" http://localhost:3300/api/social/canary)"
  echo "==> memory after the probes: $(docker stats --no-stream --format '{{.MemUsage}} ({{.MemPerc}})' kun-cf-smoke)"
  echo "==> container log tail"; docker logs --tail 15 kun-cf-smoke 2>&1 | sed 's/^/    /'
  docker stop kun-cf-smoke >/dev/null
}

deploy() {
  cd "$BUILD_DIR"
  echo "==> wrangler deploy (builds + pushes the image; needs Workers Paid)"
  pnpm exec wrangler deploy
}

case "$MODE" in
  build) build ;;
  smoke) smoke ;;
  deploy) deploy ;;
  all) build; smoke; deploy ;;
  *) echo "mode must be build|smoke|deploy|all"; exit 2 ;;
esac
echo "==> done ($MODE)"
