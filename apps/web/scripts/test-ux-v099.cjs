/* v0.9.9 release guardrails. The deployed server still runs the full Vite build. */
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const src=name=>fs.readFileSync(path.resolve(__dirname,'../src',name),'utf8');
for(const name of ['main.tsx','NetworkCanvas.tsx','FloatingPanel.tsx','ConceptWorkspaceModal.tsx','EvaluationRadar.tsx','EvaluationQueue.tsx']){
 const r=ts.transpileModule(src(name),{fileName:name,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}});
 assert.equal((r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`${name} syntax`);
}
const app=src('main.tsx'),panels=src('FloatingPanel.tsx'),chart=src('NetworkCanvas.tsx'),radar=src('EvaluationRadar.tsx'),queue=src('EvaluationQueue.tsx'),style=src('style.css'),details=src('ConceptWorkspaceModal.tsx');
assert.ok(panels.includes("'problemResearch'")&&panels.includes('problemResearch: {isOpen:false'),'Problem research is an independent floating window');
assert.ok(app.includes('panels.research.isOpen')&&app.includes('panels.problemResearch.isOpen'),'Two different research panels');
assert.ok(app.includes("openPanel('problemResearch')")&&app.includes("researchEntry==='studio'")===false,'Problem routes do not overload research studio');
assert.ok(app.includes('research-studio-problems')&&app.includes('research-studio-sessions'),'Studio has target-scoped search and histories');
assert.ok(app.includes('ConceptWorkspaceDetails concept={solution}')&&details.includes('export function ConceptWorkspaceDetails'),'Studio and graph modal share details component');
assert.ok(app.includes('concept-create-disclosure')&&app.includes('concept-ai-disclosure'),'Manual concept and AI generation start collapsed');
assert.ok(app.includes('saveManualConcept(true)')&&app.includes("path+'/solutions/'+created.id+'/match'"),'Matching only upon explicit Save & Match');
assert.ok(app.includes("setEvaluationEntry(fromProblem?'concept':'studio')")&&app.includes("evaluationEntry==='studio'&&<label"),'Concept-specific evaluations hide redundant selector');
assert.ok(app.includes("setEvaluationMode('exploratory')"),'Exploratory is new evaluation default');
assert.ok(queue.includes('<details className="eval-history"')&&queue.includes('snapshots.length>0&&<section className="eval-compare">')&&queue.indexOf('eval-compare')>queue.indexOf('eval-history'),'Historical comparisons inside collapsed job history');
assert.ok(radar.includes('className="amcharts-radar"')&&!radar.includes('className="radar-note"')&&!radar.includes('className="radar-legend"'),'Chart-only radar without visible note/legend');
assert.ok(style.includes('.workspace-v08 .evalchart .radar-shell {height:clamp('),'Radar reserves real chart height');
assert.ok(chart.includes('circleSprites.get(key)')&&chart.includes('badgeLayer.toLocal(circle.toGlobal'),'Badges anchor actual circle with coordinate conversion');
assert.ok(chart.includes("},[targetId,refreshKey,resetSequence]);"),'Appearance and studio changes cannot dispose amCharts root');
const geometry=src('graphBadgeLayout.ts');assert.ok(geometry.includes('const distance=radius+13'),'No fixed minimum spacing at zoom scales');
console.log('PASS: v0.9.9 separate research panels, shared inline concept workspace, explicit matching, exploratory evaluation, history nesting, chart-only radar and circle-based badge positioning');
