/* Frontend regressions without a browser. Full Vite build + pointer testing is also required. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ts=require('typescript');
const source=path.resolve(__dirname,'../src');
const load=file=>fs.readFileSync(path.join(source,file),'utf8');
for(const file of ['NetworkCanvas.tsx','GraphAppearance.tsx','graphTooltip.ts']){
  const diagnostics=ts.transpileModule(load(file),{fileName:file,reportDiagnostics:true,
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).diagnostics||[];
  assert.equal(diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,file);
}
const moduleObject={exports:{}};
const code=ts.transpileModule(load('graphTooltip.ts'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
new Function('module','exports',code)(moduleObject,moduleObject.exports);
const wrap=moduleObject.exports.wrapGraphTooltip;
const cases=[
  'Long multi-word research problem statement about accessibility barriers that affect mobility and everyday participation in local communities.',
  'Limited access to affordable safe transportation in communities where older adults cannot drive and public transit options are unreliable.',
  'A verylongunbreakablecomponentnamewhichshouldnotbechoppedintomultipleincorrecttechnicalwords alongside normal sentence text.',
];
for(const phrase of cases){
  const wrapped=wrap(phrase,50);
  assert.equal(wrapped.replace(/\s+/g,' '),phrase);
  const longestWord=Math.max(...phrase.split(/\s+/).map(word=>word.length));
  assert.ok(wrapped.split('\n').every(line=>line.length<=Math.max(80,longestWord)),
    'unexpected excessively long line');
  assert.ok(wrapped.includes('\n'));
}
assert.equal(wrap('First paragraph\nSecond paragraph',50),'First paragraph\nSecond paragraph');
const chart=load('NetworkCanvas.tsx');
const appearance=load('GraphAppearance.tsx');
assert.ok(chart.includes('hoveredBadgeKey')&&chart.includes('node.hideTooltip()'),
  'Concept badge hover must suppress parent tooltip');
assert.ok(chart.includes("badge.events.on('pointerover'")&&chart.includes("badge.events.on('pointerout'"),
  'Concept badge must have hover enter/leave states');
assert.ok(chart.includes('badgeTooltip')&&chart.includes('nodeTooltip'),
  'Badge and problem need independent tooltips');
assert.ok(chart.includes('wrapGraphTooltip(item.name,50)'),
  'Problem hover should use line-wrapped source text');
for(const field of ['badgeClosed','badgeOpen','badgeHover']){
  assert.ok(chart.includes(field)&&appearance.includes(field),`Appearance missing ${field}`);
}
assert.ok(chart.includes('badgeAction')&&chart.includes("expanded.has(key)?'Collapse':'Expand'"),'Open/closed state must be discoverable in badge tooltip');
assert.ok(!chart.includes("text:open?'−':'+'"),'v0.9.8 removes redundant plus/minus glyphs');
assert.ok(chart.includes('},[targetId,refreshKey,resetSequence]);'),
  'UI-only changes must preserve existing graph root');
console.log('PASS: wrapped graph tooltips, isolated badge hover, configurable open/closed/hover appearance');
