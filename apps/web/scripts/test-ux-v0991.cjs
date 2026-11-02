/** v0.9.9.1 interface maintenance checks. Do not alter research and chart semantics. */
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const main=src('main.tsx'),panel=src('FloatingPanel.tsx'),style=src('style.css'),chart=src('NetworkCanvas.tsx'),geo=src('graphBadgeLayout.ts'),terms=src('types/terminology.ts');
for(const n of ['main.tsx','FloatingPanel.tsx','NetworkCanvas.tsx','graphBadgeLayout.ts','types/terminology.ts']){
  const r=ts.transpileModule(src(n),{fileName:n,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}});
  assert.equal((r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,n+' TS syntax');
}
assert.ok(panel.includes('width: 420, height: 760')&&panel.includes("id==='overview' ? Math.max(190,screenHeight-100)"),'Overview default uses most of desktop viewport');
assert.ok(main.includes('className="metrics overview-metrics"')&&main.includes('className="metrics overview-metrics research-overview-metrics"'),'Both Overview metric groups use same style');
assert.ok(style.includes('.workspace-v08 .overview-metrics > button')&&style.includes(':focus-visible'),'Uniform accessible clickable metric buttons');
const metricRegion=main.slice(main.indexOf('className="metrics overview-metrics"'),main.indexOf('<h3>Saved findings</h3>'));
assert.ok(metricRegion.includes("onClick={()=>changeTab('manage')}")&&metricRegion.includes("onClick={()=>changeTab('problems')}")&&metricRegion.includes("onClick={()=>changeTab('concepts')}")&&metricRegion.includes("openPanel('rejectedConcepts')"),'Overview cards route to the correct windows');
assert.ok(terms.includes("'app.createNewTarget':'Create new {target}'"),'New navigation label resolves through terminology tokens');
const navStart=main.indexOf('className="sidebar target-sidebar-v07"');const navEnd=main.indexOf('</aside>',navStart);const navArea=main.slice(navStart,navEnd);
for(const phrase of ["t('app.createNewTarget')","t('app.directory')","t('app.overview')","t('app.explorer')"]){assert.ok(navArea.includes(phrase),'Missing nav control '+phrase)}
assert.ok(navArea.indexOf("t('app.createNewTarget')")<navArea.indexOf("t('app.directory')")&&navArea.indexOf("t('app.directory')")<navArea.indexOf("t('app.overview')")&&navArea.indexOf("t('app.overview')")<navArea.indexOf("t('app.explorer')"),'Navigation order');
const list=main.slice(main.indexOf('const nav:{'),main.indexOf('const choose='));
assert.ok(!list.includes("{id:'graph'")&&!list.includes("{id:'generateConcepts'")&&!list.includes("{id:'directory'"),'No redundant graph, directory, or generate concepts entries');
assert.ok(main.includes('panels.generateConcepts.isOpen')&&main.includes('concept-ai-disclosure'),'Contextual/Concept Studio concept generation remains reachable');
assert.ok(geo.includes('export function alignOverlayBadge')&&geo.includes('dy=-4')&&geo.includes('dx=4'),'Optical overlay correction in fixed overlay coordinates');
assert.ok(chart.includes('alignOverlayBadge(computed,4,-4,zoomScale)')&&chart.includes('badgeLayer.toLocal(circle.toGlobal')&&chart.includes("},[targetId,refreshKey,resetSequence]);"),'Chart continuity and same-coordinate-circle mapping retained');
const transpiled=ts.transpileModule(geo,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const {Module}=require('node:module');const m=new Module('badge-alignment-test');m._compile(transpiled,'badge-alignment-test');
assert.deepEqual(m.exports.alignOverlayBadge({x:100,y:200}),{x:104,y:196});
assert.deepEqual(m.exports.alignOverlayBadge({x:100,y:200},4,-4,2),{x:102,y:198},'Four screen-space pixels independent of 2x chart zoom');
console.log('PASS: v0.9.9.1 navigation, terminology, overview height/style/routes and fixed overlay alignment');
