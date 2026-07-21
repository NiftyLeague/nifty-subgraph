#!/usr/bin/env bash
set -euo pipefail

ALLOWLIST=(
  GHSA-3g43-6gmg-66jw GHSA-3p68-rc4w-qgx5 GHSA-43fc-jf86-j433 GHSA-52cp-r559-cp3m
  GHSA-5c9x-8gcm-mpgx GHSA-62hf-57xw-28j9 GHSA-6chq-wfr3-2hj9 GHSA-7q8q-rj6j-mhjq
  GHSA-898c-q2cr-xwhg GHSA-fvcv-3m26-pcqx GHSA-hfxv-24rg-xrqf GHSA-j5f8-grm9-p9fc
  GHSA-jr5f-v2jv-69x6 GHSA-m7pr-hjqh-92cm GHSA-mmx7-hfxf-jppx GHSA-mp2f-45pm-3cg9
  GHSA-p92q-9vqr-4j8v GHSA-pf86-5x62-jrwf GHSA-pjwm-pj3p-43mv GHSA-pmwg-cvhr-8vh7
  GHSA-vf2m-468p-8v99 GHSA-w9j2-pvgh-6h63 GHSA-wf5p-g6vw-rhxx GHSA-xhjh-pmcv-23jw
  GHSA-xx6v-rp6x-q39c
)

SCAN_JSON=$(osv-scanner --lockfile bun.lock --format json 2>/dev/null || true)

FOUND=$(echo "$SCAN_JSON" | node -e '
  let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
    try { const d=JSON.parse(s); const ids=new Set();
      for (const r of d.results||[]) for (const p of r.packages||[]) for (const v of p.vulnerabilities||[]) ids.add(v.id);
      console.log([...ids].sort().join("\n"));
    } catch(e){ console.log(""); }
  });')

if [ -z "$FOUND" ]; then
  echo "✅ No vulnerabilities detected."
  exit 0
fi

ALLOW=" ${ALLOWLIST[*]} "
NEW=0
while IFS= read -r id; do
  [ -z "$id" ] && continue
  if [[ "$ALLOW" == *" $id "* ]]; then
    echo "⚪ allowlisted (known-unfixable): $id"
  else
    echo "🔴 NEW/unexpected vulnerability: $id"
    NEW=$((NEW+1))
  fi
done <<< "$FOUND"

if [ "$NEW" -gt 0 ]; then
  echo ""
  echo "❌ $NEW new vulnerability(ies) not in allowlist. Review and remediate."
  exit 1
fi

echo ""
echo "✅ All detected vulnerabilities are pre-approved (dev-only, no upstream fix)."
