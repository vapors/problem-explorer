/* Pure frontend vocabulary regression test. Run after npm install: npm run test:lenses. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function source(relative){return fs.readFileSync(path.join(root,relative),'utf8')}
function moduleFrom(relative){
 const text=source(relative);
 const result=ts.transpileModule(text,{fileName:relative,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,strict:true}});
 const errors=(result.diagnostics||[]).filter(diag=>diag.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join('\n'));
 const mod={exports:{}};new Function('exports','module','require',result.outputText)(mod.exports,mod,require);return mod.exports;
}
const {TERMINOLOGY_LENSES,CLASSIC_ENTITIES,CLASSIC_MESSAGES,ENTITY_KEYS,resolveMessage,resolveEntity}=moduleFrom('src/types/terminology.ts');
assert.equal(Object.keys(TERMINOLOGY_LENSES).length,4);
assert.equal(TERMINOLOGY_LENSES.classic.id,'classic');
for(const lens of Object.values(TERMINOLOGY_LENSES)){
 for(const entity of ENTITY_KEYS){
  const word=resolveEntity(lens,entity);
  assert.ok(word.singular&&word.plural&&word.description,`${lens.id}: ${entity}`);
  assert.deepEqual(CLASSIC_ENTITIES[entity],resolveEntity(TERMINOLOGY_LENSES.classic,entity));
 }
 for(const key of Object.keys(CLASSIC_MESSAGES)){
  const text=resolveMessage(lens,key,{count:3,missing:2,total:5,current:1,streamCount:3,categoryCount:10,problemCount:30});
  assert.ok(text.length>0,`${lens.id} missing ${key}`);
  assert.doesNotMatch(text,/\{\w+\}/,`${lens.id} unexpanded ${key}: ${text}`);
 }
}
assert.equal(resolveMessage(TERMINOLOGY_LENSES.classic,'app.explorer'),'Target explorer');
assert.equal(resolveMessage(TERMINOLOGY_LENSES.industrial_design,'app.explorer'),'Design objective explorer');
assert.equal(resolveMessage(TERMINOLOGY_LENSES.technical_engineering,'app.hierarchyIntro'),
 'The graph is System investigation → Diagnostic track → Subsystem → Failure hypothesis. Choose a diagnostic track to generate an editable diagnostic map or add records manually.');
assert.equal(resolveMessage(TERMINOLOGY_LENSES.general_challenge,'app.graphHint',{count:9}),
 '9 friction points · click branches to explore · click a friction point to open details');
// Evaluation factor IDs belong to the evaluation schema, not to a terminology pack.
const chart=source('src/EvaluationRadar.tsx');
for(const factor of ['desirability','feasibility','viability','impact','coverage'])assert.ok(chart.includes(`'${factor}'`));
for(const pack of Object.values(TERMINOLOGY_LENSES))assert.ok(!('evaluationProfileId' in pack));
// Switching lenses may re-render title text but must not rebuild amCharts.
const graph=source('src/NetworkCanvas.tsx');
assert.ok(graph.includes('useTerminology()'));
assert.ok(graph.includes('},[targetId,refreshKey,resetSequence]);'),'Graph init must remain independent of lens and theme');
assert.ok(!graph.includes('[targetId, refreshKey, theme, lensId]'));
const wizard=source('src/NewTargetWizard.tsx');
assert.ok(wizard.includes("'name'|'focus'|'investigate'|'review'"));
for(const route of ['/targets/suggest-streams','/with-streams','/seed-preview','/taxonomy'])assert.ok(wizard.includes(route),`Original route missing: ${route}`);
const main=source('src/main.tsx');
assert.ok(main.includes('preferenceKey={account.id}'),'Lens preferences must be user scoped');
assert.ok(main.includes('<NetworkCanvas targetId=')&&!main.includes('<NetworkCanvas key={lensId}'),'No graph remount on lens switch');
console.log(`PASS: ${Object.keys(TERMINOLOGY_LENSES).length} lenses, ${Object.keys(CLASSIC_MESSAGES).length} message keys, canonical graph and evaluation invariants.`);
