/* v0.9.7 source-contract regression. Runtime browser verification is also required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const base = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(base,file), 'utf8');
for(const file of ['src/NewTargetWizard.tsx','src/types/terminology.ts','src/contexts/TerminologyContext.tsx']){
 const data=ts.transpileModule(source(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
 assert.equal((data.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`Parse ${file}`);
}
const wizard=source('src/NewTargetWizard.tsx');
const types=source('src/types/terminology.ts');
const css=source('src/style.css');
assert.match(wizard,/type Phase='name'\|'focus'\|'investigate'\|'review'/);
assert.ok(wizard.includes('onboarding-lens-grid'));
assert.ok(wizard.includes('lensChosen&&<div className="onboarding-lens-next"'));
assert.ok(wizard.includes('CircleHelp'));
assert.ok(wizard.includes('aria-pressed={lensChosen&&lensId===l.id}'));
assert.ok(wizard.includes('t(\'wizard.namePrompt\')'));
assert.ok(!wizard.includes("t('wizard.nameHelp')"),'Remove redundant help copy');
assert.ok(!wizard.includes("t('wizard.focusHelp')"),'Remove redundant focus copy');
assert.ok(wizard.includes("setPhase('review')"));
assert.ok(wizard.includes('onClick={generateAndReview}'),'Continue should generate previews');
assert.ok(wizard.includes("onClick={saveAndAdvance}"),'Review Next saves then advances');
assert.ok(wizard.includes("if(!saved.includes(activeReviewId))"),'Idempotent save guard');
assert.ok(wizard.includes('if(drafts[sid]?.length)continue'),'Preserve previews after partial generation failure');
assert.ok(wizard.includes('details key={`${activeReviewId}-${i}`} className="onboarding-category"'));
assert.ok(!wizard.includes('className="onboarding-category" open='),'All categories should start collapsed');
assert.ok(wizard.includes('onClick={onOpenGraph}>{t(\'wizard.skipGeneration\')}'), 'Keep manual/no-AI escape hatch under Advanced');
for(const endpoint of ['/targets/suggest-streams','/targets/with-streams','/seed-preview','/taxonomy']){
 // The /with-streams literal doesn't include prefix in source; accept exact suffix.
 const route=endpoint==='/targets/with-streams'?'/with-streams':endpoint;
 assert.ok(wizard.includes(route),`API contract ${route}`);
}
for(const key of ['wizard.chooseLens','wizard.genericPrompt','wizard.mapTitle','wizard.reviewTitle','wizard.reviewStep'])assert.ok(types.includes(`'${key}'`));
for(const cls of ['.onboarding-lens-grid','.onboarding-lens-tooltip','.onboarding-review-steps','.onboarding-review-square'])assert.ok(css.includes(cls));
const graph=source('src/NetworkCanvas.tsx');
assert.ok(graph.includes('},[targetId,refreshKey,resetSequence]);'), 'Terminology must not rebuild amCharts');
console.log('PASS: four-step onboarding, icon lenses, review progression, existing endpoints, save-once and graph isolation');
