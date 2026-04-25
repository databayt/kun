#!/usr/bin/env bash
set -euo pipefail

# Add cdn.databayt.org as a CNAME alias to the existing CloudFront distribution.
# This is purely additive — d1dlwtcfl0db67.cloudfront.net keeps working unchanged,
# so any code in hogwarts (or anywhere) that hardcodes the old URL is unaffected.
#
# Run this when you have AWS CLI installed and credentials configured.
# Without AWS CLI, do steps 1-3 manually in the AWS console.

DISTRIBUTION_ID="${DISTRIBUTION_ID:-}"      # e.g. EXXXXXXXXXXX (find in CloudFront console)
DOMAIN="${DOMAIN:-cdn.databayt.org}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"        # Route 53 hosted zone for databayt.org
CERT_ARN="${CERT_ARN:-}"                    # ACM cert ARN in us-east-1, set after step 2

if ! command -v aws >/dev/null 2>&1; then
  cat <<EOF
AWS CLI not installed. Do these 4 steps manually in the AWS console:

  1. Route 53 (or your DNS provider): add a CNAME record
        Name:  cdn.databayt.org
        Type:  CNAME
        Value: d1dlwtcfl0db67.cloudfront.net
        TTL:   300

  2. ACM (region MUST be us-east-1, required for CloudFront):
        Request a public certificate for: cdn.databayt.org
        Validation: DNS (auto-validates if you use Route 53)
        Wait until status = "Issued"

  3. CloudFront → distribution d1dlwtcfl0db67 → Settings → Edit:
        - Alternate domain names (CNAMEs): add cdn.databayt.org
        - Custom SSL certificate: select the ACM cert from step 2
        Save and wait for "Deployed" (~5–10 min)

  4. Verify:
        curl -sI https://cdn.databayt.org/anthropic/brand/claude-wordmark.svg
     Should return 200 OK with the same ETag as:
        curl -sI https://d1dlwtcfl0db67.cloudfront.net/anthropic/brand/claude-wordmark.svg

After verify passes, change CDN_BASE in src/components/root/anthropic/data.ts to:
        export const CDN_BASE = "https://cdn.databayt.org";

That single edit rewrites all 169+ asset URLs to the new friendly host.
Hogwarts references stay valid — adding a CNAME is purely additive.
EOF
  exit 0
fi

echo "[1/4] Route 53 CNAME"
if [[ -n "$HOSTED_ZONE_ID" ]]; then
  aws route53 change-resource-record-sets --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch '{
      "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "'"$DOMAIN"'",
          "Type": "CNAME",
          "TTL": 300,
          "ResourceRecords": [{"Value": "d1dlwtcfl0db67.cloudfront.net"}]
        }
      }]
    }' >/dev/null
  echo "  CNAME upsert submitted"
else
  echo "  HOSTED_ZONE_ID not set — skip; do this manually in DNS provider"
fi

echo "[2/4] ACM certificate (us-east-1)"
if [[ -z "$CERT_ARN" ]]; then
  CERT_ARN=$(aws acm request-certificate \
    --region us-east-1 \
    --domain-name "$DOMAIN" \
    --validation-method DNS \
    --query CertificateArn --output text)
  echo "  Requested: $CERT_ARN"
  echo "  Validate via DNS (Route 53 will auto-create CNAME if hosted there)."
  echo "  Re-run with CERT_ARN=$CERT_ARN once status = ISSUED"
  exit 0
fi
echo "  Using: $CERT_ARN"

echo "[3/4] CloudFront alias"
if [[ -z "$DISTRIBUTION_ID" ]]; then
  echo "  ERROR: set DISTRIBUTION_ID (find in CloudFront console)"
  exit 1
fi

CFG_FILE=$(mktemp)
ETAG=$(aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" \
  --query 'ETag' --output text)
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" \
  --query 'DistributionConfig' > "$CFG_FILE"

# Add CNAME and SSL cert via jq
jq --arg cname "$DOMAIN" --arg cert "$CERT_ARN" '
  .Aliases = (.Aliases // {Quantity:0,Items:[]}) |
  .Aliases.Items = ((.Aliases.Items // []) + [$cname] | unique) |
  .Aliases.Quantity = (.Aliases.Items | length) |
  .ViewerCertificate = {
    ACMCertificateArn: $cert,
    SSLSupportMethod: "sni-only",
    MinimumProtocolVersion: "TLSv1.2_2021",
    Certificate: $cert,
    CertificateSource: "acm"
  }
' "$CFG_FILE" > "${CFG_FILE}.new"

aws cloudfront update-distribution --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config "file://${CFG_FILE}.new" >/dev/null
echo "  Alias added — wait ~5-10 min for distribution to redeploy"

echo "[4/4] Verify (after distribution status = Deployed):"
echo "  curl -sI https://$DOMAIN/anthropic/brand/claude-wordmark.svg"
echo ""
echo "When verify returns 200, edit src/components/root/anthropic/data.ts:"
echo "  export const CDN_BASE = \"https://$DOMAIN\";"
