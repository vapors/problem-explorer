/* Source contract: production TypeScript/Vite and interactive amCharts browser tests are separate. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const read=f=>fs.readFileSync(path.resolve(__dirname,'../src',f),'utf8');
for(const f of ['main.tsx','NetworkCanvas.tsx','GraphAppearance.tsx','FloatingPanel.tsx','ConceptWorkspaceModal.tsx','types/terminology.ts']){
 const result=ts.transpileModule(read(f),{fileName:f,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX}});
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,f);
}
const main=read('main.tsx'),chart=read('NetworkCanvas.tsx'),appearance=read('GraphAppearance.tsx'),lens=read('types/terminology.ts');
for(const phrase of ['studioPicker','researchEntry','conceptEntry','studioPick','app.generateFromProblem','app.conceptDraftDisclaimer','app.rejectedConcepts'])assert.ok(main.includes(phrase),phrase);
assert.ok(main.includes("changeTab('research',true)")&&main.includes("changeTab('generateConcepts',true)"));
assert.ok(main.includes("status:'active'")&&!main.includes('DELETE /solutions'),'Restore is non-destructive');
for(const field of ['conceptCount','reviewedCount','unreviewedCount','problemCount'])assert.ok(chart.includes(field),field);
for(const key of ['showConceptBadges','showReviewedBadges','showUnreviewedBadges','showProblemBadges']){
 assert.ok(chart.includes(key),key);assert.ok(appearance.includes(key),key);
}
for(const msg of ['app.generateConcepts','app.rejectedConcepts','app.originatingProblem','app.graphBadgeUnreviewed'])assert.ok(lens.includes(msg),msg);
assert.ok(chart.includes('syncCountsRef')&&chart.includes('paintMetricBadges'));
assert.ok(chart.includes('},[targetId,refreshKey,resetSequence]);'),'Metric refresh must not recreate amCharts root');
assert.ok(!chart.includes("text:open?'−':'+'"),'Extra +/- symbols removed');
assert.ok(main.includes('onReject={!readOnly?'),'Concept Workspace must support owner-only rejection');
console.log('PASS: v0.9.8 graph badge rollups, admin toggles, contextual/global studios, reversible concepts and lens keys');
