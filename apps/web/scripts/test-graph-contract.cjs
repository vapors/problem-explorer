/* Compile-free frontend graph regression guard. Full tsc + Vite runs afterward. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const base=path.resolve(__dirname,'..','src');
function text(f){return fs.readFileSync(path.join(base,f),'utf8')}
for(const f of ['NetworkCanvas.tsx','GraphAppearance.tsx','FloatingPanel.tsx','main.tsx','networkLabels.ts']){
 const result=ts.transpileModule(text(f),{fileName:f,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX}});
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,f+' has parse errors');
}
const graph=text('NetworkCanvas.tsx');
assert.ok(graph.includes('},[targetId,refreshKey,resetSequence]);'),'Graph root must persist across theme, concept, or signal changes');
assert.ok(graph.includes('series.addChildData(parentItem,[entry])'),'Concept inserts must use the existing series');
assert.ok(graph.includes('graph-view')&&graph.includes('stableKey'),'Durable application keys must be used');
assert.ok(graph.includes("fetch('/api/graph/appearance'"),'Palette must be updated separately');
const app=text('main.tsx');
assert.ok(app.includes('refreshConcepts')&&app.includes('markNewConcept'));
assert.ok(app.includes('originProblemId:originId'));
assert.ok(app.includes('onConceptNodeSelect='));
assert.ok(app.includes('<GraphAppearance onSaved='));
console.log('PASS: v0.9.3 graph continuity source contract');
