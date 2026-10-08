#!/usr/bin/env bash
set -euo pipefail

# Dependabot's bun updater only parses lockfileVersion 1. Bun 1.4 writes version 2
# for a plain `bun install` and version 3 when scoped `parent>child` overrides are
# present, and either one silently disables the weekly dependency lane, so the
# committed lockfile is held at version 1. See the toolchain notes in AGENTS.md.
LOCKFILE_VERSION=$(sed -n 's/.*"lockfileVersion": *\([0-9][0-9]*\).*/\1/p' bun.lock | head -1)
if [ "$LOCKFILE_VERSION" != "1" ]; then
  echo "❌ bun.lock declares lockfileVersion ${LOCKFILE_VERSION:-none}; Dependabot only parses version 1."
  echo "   Set the field back to 1 and confirm with 'bun install --frozen-lockfile'."
  exit 1
fi

# Allowed ids are known-unfixable transitive advisories in the dev-only Graph CLI
# dependency tree. They are not shipped by the deployed subgraph.
#
# GHSA-528h-pc64-c93x (stream-json@1.9.1) is the newest entry. It reaches the
# tree only through jayson@4.2.0, which the Graph CLI uses for JSON-RPC. The
# advisory covers the pick/ignore/filter/replace streams; jayson imports only
# StreamValues and Verifier, so the vulnerable path is not reachable here. The
# fix is stream-json 3.5.0, which is ESM-only and dropped the
# `streamers/StreamValues` and `utils/Verifier` subpaths jayson requires, so
# overriding to it breaks graph-cli. Drop this id when jayson or graph-cli
# moves off stream-json 1.x.
#
# GHSA-hqr4-qq8f-hg3x and GHSA-mjw6-4jj6-33hc (also stream-json@1.9.1) share
# that rationale: both are fixed only in the ESM-only 3.6.0+ line, which still
# cannot be overridden into graph-cli's CJS jayson usage, and the tree is
# dev-only.
#
# GHSA-vfj7-8cjw-p6xm (braces, high): no patched release exists as of
# 2026-10-03 (3.0.3 is the newest npm version and the advisory's patched field
# is null). Dev-tooling transitive of the graph-cli tooling chain with a
# build-time stack-exhaustion scenario only; drop when a fixed version
# publishes.
ALLOWLIST=(
  GHSA-3g43-6gmg-66jw GHSA-3p68-rc4w-qgx5 GHSA-43fc-jf86-j433 GHSA-528h-pc64-c93x
  GHSA-h39j-r5qq-r9mm GHSA-5c9x-8gcm-mpgx GHSA-62hf-57xw-28j9 GHSA-6chq-wfr3-2hj9
  GHSA-7q8q-rj6j-mhjq GHSA-hqr4-qq8f-hg3x
  GHSA-898c-q2cr-xwhg GHSA-fvcv-3m26-pcqx GHSA-hfxv-24rg-xrqf GHSA-j5f8-grm9-p9fc
  GHSA-jr5f-v2jv-69x6 GHSA-m7pr-hjqh-92cm GHSA-mjw6-4jj6-33hc GHSA-mmx7-hfxf-jppx
  GHSA-mp2f-45pm-3cg9 GHSA-vfj7-8cjw-p6xm
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
