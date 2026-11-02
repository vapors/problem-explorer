/* Regression tests for independent badge hit surfaces and settings contracts.
 * Geometry tests run on the authored TS with a no-dependencies transpile pass.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const ts=require('typescript');
const src=(name)=>fs.readFileSync(path.resolve(__dirname,'../src',name),'utf8');
const geom=ts.transpileModule(src('graphBadgeLayout.ts'),{fileName:'graphBadgeLayout.ts',compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{}};vm.runInNewContext(geom,context);
const {badgeDirections,perimeterBadges}=context.exports;
assert.ok(Math.abs(badgeDirections([{x:100,y:0}],{x:0,y:0}))<.001,'Points toward child');
assert.ok(Math.abs(badgeDirections([],{x:0,y:0},{x:-100,y:0}))<.001,'Points away from ancestor when closed');
assert.ok(Math.abs(badgeDirections([],{x:0,y:0},undefined,1.3)-1.3)<.001,'Preserves last bearing');
const pts=perimeterBadges({x:5,y:8},40,0,4);
assert.equal(pts.length,4);
for(const p of pts)assert.ok(Math.abs(Math.hypot(p.x-5,p.y-8)-53)<.001,'On perimeter');
assert.ok(pts.every(p=>p.x>5),'Badge arc faces child branch');
assert.ok(Math.abs(perimeterBadges({x:0,y:0},10,0,1)[0].x-23)<.001,'No fixed minimum radius that makes zoomed badges drift');
assert.ok(Math.abs(pts.reduce((sum,p)=>sum+p.y,0)/pts.length-8)<.01,'Badge arc centered on child direction');
assert.ok(new Set(pts.map(p=>p.y.toFixed(1))).size>1,'Spreads siblings around perimeter');
const chart=src('NetworkCanvas.tsx'),admin=src('GraphAppearance.tsx'),server=fs.readFileSync(path.resolve(__dirname,'../../api/app/graph_preferences.py'),'utf8');
for(const code of [chart,admin,server])for(const key of ['showBadgeTooltips','showConceptOpen','showConceptClosed','showReviewedOpen','showReviewedClosed','badgeReviewedOpen','badgeProblemsOpen'])assert.ok(code.includes(key),key);
assert.ok(chart.includes('const badgeLayer=zoom.contents.children.push') && chart.includes('root.events.on(\'frameended\',placeBadges)'), 'Independent badge overlay follows force nodes');
assert.ok(chart.includes('badgeLayer.toLocal(circle.toGlobal') && chart.includes('circleSprites.get(key)'), 'Anchors to the rendered amCharts circle in overlay coordinates, not the hierarchy container origin');
assert.ok(chart.includes("},[targetId,refreshKey,resetSequence]);"), 'Lens/appearance/count refresh must not replace amCharts root');
assert.ok(!chart.includes("badge=node.children.push"), 'Badges must not share parent tooltip hit surfaces');
assert.ok(chart.includes('const toggles:Record<BadgeKind,{open:keyof GraphBadgeColors;closed:keyof GraphBadgeColors}>='),
  'Badge state map must be typed before indexing to prevent string widening in tsc');
assert.ok(chart.includes('const stateKeys=toggles[kind]'),
  'Indexing must happen after the keyed map has been typed');
assert.ok(admin.includes('Show badge tooltips'));
for(const field of ['badgeHover','badgeReviewedHover','badgeUnreviewedHover','badgeProblemsHover']){
  assert.ok(chart.includes(field),`chart hover ${field}`);
  assert.ok(admin.includes(field),`admin hover ${field}`);
  assert.ok(server.includes(field),`server hover ${field}`);
}
assert.ok(chart.includes('badgeAction(key,count)'), 'Only originating Problem count toggles concepts');
assert.ok(chart.includes('badgeCopy(entry.kind,count,node)'), 'Ancestors have informational tooltips');
assert.ok(chart.includes('requestedBadges.get(badge)'), 'Only requested badges can be shown');
assert.ok(chart.includes('forceHidden:true,visible:false'), 'New badges must start invisible');
assert.ok(chart.includes('x:local.x,y:local.y,forceHidden:false,visible:true'), 'Position before visibility');
console.log('PASS: badge geometry, per-type hover settings, independent tooltips, hidden-sprite lifecycle and stable chart lifecycle');
// The v0.9.9.1 maintenance release additionally checks the overlay-pixel correction
// and its unchanged zoom-independent geometry in test-ux-v0991.cjs.
