#!/usr/bin/env bash
# REA (morluto/rea) under a supported Node. REA 6.7 requires Node 22.19+, 24.11+ or 26+;
# the Mac runs Node 25, which `rea doctor` fails. `-p node@24` puts a Node 24 binary first on
# PATH for this one call — no global install, no nvm. Bump REA_VERSION deliberately.
set -euo pipefail
REA_VERSION="${REA_VERSION:-6.7.0}"
exec npx -y -p node@24 -p "rea-agents@${REA_VERSION}" -- rea "$@" 2> >(grep -v '^npm warn' >&2)
