// Builds the scenario × core matrix from two jest --json runs (see tracking-matrix.sh).
const fs = require('fs');
const [androidPath, iosPath] = process.argv.slice(2);
const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');

function load(path) {
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  const out = new Map();
  for (const file of json.testResults) {
    const fileName = file.name.split('/').pop().replace('.test.ts', '');
    for (const t of file.assertionResults) {
      const key = `${fileName} › ${t.fullName}`;
      let reason = '';
      if (t.status !== 'passed') {
        const msg = strip((t.failureMessages || []).join('\n'));
        const exp = msg.match(/Expected[^\n]*\n?[^\n]*/);
        const rec = msg.match(/Received[^\n]*\n?[^\n]*/);
        const err = msg.match(/Error: ([^\n]*)/);
        const clean = (x) => x.replace(/\s+at\s+(Object|_callee|Generator|new Promise|async)[\s\S]*$/, '').replace(/\s+/g, ' ').trim();
        reason = [exp && exp[0], rec && rec[0]].filter(Boolean).map(clean).join(' · ');
        if (!reason && err) reason = clean(err[1]);
        reason = reason.slice(0, 140);
      }
      out.set(key, { status: t.status, reason, title: t.title, file: fileName, group: t.ancestorTitles.slice(1).join(' › ') });
    }
  }
  return out;
}

const android = load(androidPath);
const ios = load(iosPath);
const keys = [...new Set([...android.keys(), ...ios.keys()])];

const cell = (r, core) => {
  if (!r) return '—';
  if (r.status === 'passed') return '✅';
  if (core === 'android' && r.title.startsWith('AS SHIPPED')) return '↔ differs by design (fixes it)';
  return `❌ ${r.reason || r.status}`;
};

const counts = (m, core) => {
  let ok = 0, bad = 0, design = 0;
  for (const k of keys) {
    const r = m.get(k); if (!r) continue;
    if (r.status === 'passed') ok++;
    else if (core === 'android' && r.title.startsWith('AS SHIPPED')) design++;
    else bad++;
  }
  return `${ok} correct / ${bad} wrong${design ? ` / ${design} differ by design` : ''}`;
};

console.log('# Tracking scenario matrix — every timeline against every core');
console.log('');
console.log(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} by \`mobile-app/scripts/tracking-matrix.sh\`.`);
console.log('');
console.log('Each row is one story (a replay timeline with the record it SHOULD produce). Each column is a');
console.log('tracking core run on that story. ✅ = the core writes the expected record; ❌ = the wrong record');
console.log('(first mismatching expectation shown). Steps a platform never delivers are skipped for that core:');
console.log('the iOS core gets no heartbeat pings, no batches, no background verification checks and no');
console.log('fence-re-registration triggers on app open. The "AS SHIPPED" rows in the iOS file describe what');
console.log('production iOS does today, so the iOS core passing them is expected and the Android core "failing"');
console.log('them means it fixes the behaviour.');
console.log('');
console.log('| Scenario file | Story | Android core (rebuilt 2026-09-28) | iOS core (as shipped) |');
console.log('|---|---|---|---|');
let lastFile = '';
for (const k of keys) {
  const r = android.get(k) || ios.get(k);
  const file = r.file;
  const title = (r.group ? `${r.group} › ` : '') + r.title;
  console.log(`| ${file === lastFile ? '' : file} | ${title.replace(/\|/g, '\\|')} | ${cell(android.get(k), 'android')} | ${cell(ios.get(k), 'ios')} |`);
  lastFile = file;
}
console.log('');
console.log(`**Totals:** Android core ${counts(android, 'android')} · iOS core ${counts(ios, 'ios')} (of ${keys.length} stories).`);
console.log('');
console.log('The pre-rebuild Android core (the layered 2026-09-27 version) is no longer in the tree; its');
console.log('results are the first adversarial review\'s findings: it failed R1–R12 (see the "review round 1"');
console.log('rows, each confirmed by running at the time) and passed the rest of the rows that existed then.');
