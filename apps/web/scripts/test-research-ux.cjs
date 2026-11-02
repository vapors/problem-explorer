/* v0.9.7 source-contract checks. Browser QA is still necessary. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
for(const file of ['src/main.tsx','src/NewTargetWizard.tsx','src/FloatingPanel.tsx','src/TargetExplorer.tsx']){
 const r=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
 assert.equal((r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`Invalid TSX: ${file}`);
}
const app=read('src/main.tsx'),wizard=read('src/NewTargetWizard.tsx'),panels=read('src/FloatingPanel.tsx'),explorer=read('src/TargetExplorer.tsx');
assert.ok(wizard.includes("<h2>{t('wizard.namePrompt')}</h2>"),'Primary prompt must use active lens');
assert.ok(!wizard.includes("<h2>{t('wizard.genericPrompt')}</h2>"),'No fixed generic prompt');
assert.ok(wizard.includes('Save & Continue')&&wizard.includes('skipAndAdvance'),'Explicit review actions');
assert.ok(wizard.includes('if(!saved.includes(activeReviewId))'),'Retain save-once guard');
assert.ok(!wizard.includes("onClick={()=>setPhase('investigate');"),'No forced Back in review');
assert.ok(panels.includes('navigation: {isOpen: true')&&panels.includes('overview: {isOpen: true'),'First launch should show navigation and overview');
assert.ok(panels.includes('targetExplorer: {isOpen: false'),'Target Explorer starts closed');
assert.ok(panels.includes("id==='navigation' ? Math.max(190,screenHeight-88)"),'Navigation viewport height');
assert.ok(!explorer.includes('setOpenStreams(new Set(streams.map(s => s.id)))'),'Explorer branches collapsed on load');
assert.ok(app.includes('refreshResearchActivity()'),'Refresh summary immediately');
assert.ok(app.includes('selected.findings.filter(f=>f.reviewStatus!==\'rejected\')'),'Do not show rejected in active list');
assert.ok(app.includes("/research/rejected-findings?limit=50&skip="),'Rejected recovery pagination');
assert.ok(app.includes("status:'needs_review'"),'Restore rejected status');
assert.ok(app.includes('panels.generateConcepts.isOpen')&&app.includes('panels.rejected.isOpen'),'Distinct workflow windows');
assert.ok(app.includes("changeTab('generateConcepts',true)"),'Problem Concepts opens generator');
assert.ok(app.includes('selected.solutions?.length'),'Only originating saved concepts are listed');
assert.ok(app.includes('markNewConcept(created,selected.id)'),'Keep concept origin relationship');
assert.ok(app.includes("setTab('graph');if(!keepWizard"),'Bootstrapping must not auto-open Target Explorer');
console.log('PASS: v0.9.7 window defaults, lens prompt, save/skip review, finding status, rejection recovery and concept separation');
