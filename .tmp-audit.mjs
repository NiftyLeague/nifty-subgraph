let s = ''
process.stdin.on('data', (d) => (s += d))
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(s)
    for (const r of d.results || []) {
      console.log('--- Source:', r.source ? r.source.path || r.source.name : 'unknown')
      for (const p of r.packages || []) {
        for (const v of p.vulnerabilities || []) {
          if (
            ['GHSA-52cp-r559-cp3m', 'GHSA-7q8q-rj6j-mhjq', 'GHSA-mmx7-hfxf-jppx'].includes(v.id)
          ) {
            console.log('ADVISORY:', v.id)
            console.log(
              '  Package:',
              p.package ? p.package.name : p.name || 'unknown',
              p.package ? p.package.version : p.version || 'unknown'
            )
            console.log('  Source:', r.source?.path || r.source?.name || 'unknown')
            console.log('  Title:', v.summary || v.advisory?.summary || '')
            const fixed = (v.affected || []).flatMap((a) =>
              (a.ranges || []).flatMap((rng) =>
                (rng.events || []).filter((e) => e.fixed).map((e) => e.fixed)
              )
            )
            console.log('  Fixed versions:', fixed.length ? fixed.join(', ') : 'none listed')
            console.log('')
          }
        }
      }
    }
  } catch (e) {
    console.error('parse error', e)
  }
})
