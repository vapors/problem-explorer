/* Lightweight static regression checks. Run the full TypeScript/Vite build and browser tests as well. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const base=path.resolve(__dirname,'..','src');
const read=(name)=>fs.readFileSync(path.join(base,name),'utf8');
for(const file of ['NetworkCanvas.tsx','main.tsx','ConceptWorkspaceModal.tsx']){
  const parsed=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}});
  assert.equal((parsed.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,file);
}
const chart=read('NetworkCanvas.tsx');
assert.ok(chart.includes('series.nodes.template.setup='),'Count controls must be created on amCharts nodes');
assert.ok(chart.includes("badge.events.on('click'"),'Badge must be independently clickable');
assert.ok(chart.includes('series.disableDataItem(item)')&&chart.includes('series.enableDataItem(item,1)'),
  'Badge must toggle saved concept branches in both directions');
assert.ok(chart.includes('suppressedProblemClick'),'Badge must not also open Problem detail');
assert.ok(chart.includes("'stopPropagation' in nativeEvent"),
  'Native event propagation must be type-guarded because amCharts IPointerEvent includes Touch');
assert.ok(chart.includes("series.addChildData(parentItem,[entry])"),'Saving must remain incremental');
assert.ok(chart.includes('badge.countLabel.set')&&chart.includes("paintBadge('problem:'+added.originProblemId)"),
  'New concept must update badge count and request safe positioning');
assert.ok(chart.includes('},[targetId,refreshKey,resetSequence]);'),
  'Concept modal and badge interactions must not dispose chart root');
const app=read('main.tsx');
assert.ok(app.includes('onConceptNodeSelect={id=>run(\'concept\',()=>openConceptWorkspace(id))}'),
  'Concept node must open distinct workspace modal');
assert.ok(app.includes('onMatching={()=>{setConceptModalOpen(false);changeTab(\'matching\')}}'));
assert.ok(app.includes('onAnalysis={()=>{setConceptModalOpen(false);changeTab(\'evaluation\',true)}}'));
assert.ok(app.includes('setConceptModalOpen(false);setDrafts([])'),
  'Switching targets must close any open Concept Workspace');
console.log('PASS: concept badge expansion, incremental saves, modal navigation and chart continuity');
