#!/bin/bash
# Every internal link in onboarding.mdx must resolve.
# Catches: dead /docs/<x> links + anchor drift (e.g. #tailscale vs #tailscale-vpn).

suite_name "links — /docs/<x> resolution"

ONBOARDING="$PWD/content/docs/onboarding.mdx"
DOCS_DIR="$PWD/content/docs"

assert_file_exists "$ONBOARDING" "onboarding.mdx present"

# Extract every (/docs/<slug>[#anchor]) link in the file.
# Tolerates trailing parens by stopping at )" or space or ].
LINKS=()
while IFS= read -r line; do
    LINKS+=("$line")
done < <(grep -oE '\(/docs/[a-z0-9_/-]+(#[a-z0-9-]+)?\)' "$ONBOARDING" \
    | sed -E 's/^\(|\)$//g' \
    | sort -u)

if [[ ${#LINKS[@]} -eq 0 ]]; then
    fail "no /docs/* links found in onboarding.mdx" "regex extracted nothing"
fi

# Each link's <slug> must map to content/docs/<slug>.mdx
for link in "${LINKS[@]}"; do
    path="${link#/docs/}"
    slug="${path%#*}"
    anchor="${path#*#}"
    [[ "$anchor" == "$path" ]] && anchor=""   # no '#' present
    target="$DOCS_DIR/$slug.mdx"

    if [[ -f "$target" ]]; then
        pass "link target exists: /docs/$slug"

        if [[ -n "$anchor" ]]; then
            # GitHub-flavored anchor: lowercase, spaces → -, strip punctuation
            # Build the set of headings in the target file, slugify each, compare.
            anchor_found=0
            while IFS= read -r heading; do
                slugified=$(echo "$heading" \
                    | tr '[:upper:]' '[:lower:]' \
                    | sed -E 's/[^a-z0-9 -]//g' \
                    | tr -s ' ' '-' \
                    | sed -E 's/^-+|-+$//g')
                if [[ "$slugified" == "$anchor" ]]; then
                    anchor_found=1
                    break
                fi
            done < <(grep -E '^#{1,6} ' "$target" | sed -E 's/^#+\s+//')

            if [[ "$anchor_found" -eq 1 ]]; then
                pass "anchor resolves: /docs/$slug#$anchor"
            else
                fail "anchor missing: /docs/$slug#$anchor" "no matching heading in $target"
            fi
        fi
    else
        fail "link target missing: /docs/$slug" "expected: $target"
    fi
done

# External GitHub link sanity (just shape, not network reachability)
GH=()
while IFS= read -r line; do
    GH+=("$line")
done < <(grep -oE 'https://github\.com/databayt/[^)" ]+' "$ONBOARDING" | sort -u)
for url in "${GH[@]}"; do
    # Must point at databayt org repo, sane path
    assert_match '^https://github\.com/databayt/[a-z0-9-]+(/blob/main/.+|/issues)?' "$url" \
        "external GH URL well-formed: $url"
done

# Mobile-app links present and well-formed
assert_contains "apps.apple.com/app/claude-by-anthropic" "$ONBOARDING" "iOS app link present"
assert_contains "play.google.com/store/apps/details" "$ONBOARDING" "Android app link present"

# Anti-regression: we should never re-introduce broken /docs/self-hosting or /docs/dispatch links
# (Tailscale + Apple Notes Dispatch were intentionally removed.)
# These targets still exist as files but the onboarding journey shouldn't link to them.
self_hosting_links=$(grep -cE '\(/docs/self-hosting' "$ONBOARDING" || true)
dispatch_links=$(grep -cE '\(/docs/dispatch' "$ONBOARDING" || true)
assert_eq "0" "$self_hosting_links" "no /docs/self-hosting links in onboarding"
assert_eq "0" "$dispatch_links"      "no /docs/dispatch links in onboarding"

suite_summary
