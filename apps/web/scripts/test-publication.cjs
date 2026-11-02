/* Non-browser regression guard for v0.9.5 publication controls. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const base=path.resolve(__dirname,'..','src');
const file=(name)=>fs.readFileSync(path.join(base,name),'utf8');
for(const name of ['main.tsx','NewTargetWizard.tsx','AdminTargetManagement.tsx']){
 const result=ts.transpileModule(file(name),{fileName:name,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX}});
 assert.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`${name}: TSX parsing`);
}
const admin=file('AdminTargetManagement.tsx');
assert.ok(admin.includes('featuredLenses')&&admin.includes('TERMINOLOGY_LENSES'));
assert.ok(admin.includes('directoryVisible')||admin.includes('Directory'));
assert.ok(admin.includes("featuredLenses:event.target.checked"));
const main=file('main.tsx');
assert.ok(main.includes("'/targets?lens='+encodeURIComponent(lensId)"),'Directory request must supply active lens');
assert.ok(main.includes('if(cancelled||bootstrapped.current)return'),'Lens changes must not forcibly replace current target');
assert.ok(main.includes('featuredTarget={directory.shared.find'),'Wizard must show lens-specific featured workspace');
assert.ok(main.includes('onOpenFeatured='));
const wizard=file('NewTargetWizard.tsx');
assert.ok(wizard.includes("t('wizard.featuredTitle')"));
assert.ok(file('types/terminology.ts').includes("'wizard.featuredTitle':'Featured for this research lens'"));
console.log('PASS: publication, featured lens defaults, wizard choice and continuity source contracts');
