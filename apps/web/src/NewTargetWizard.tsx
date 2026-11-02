import {useState} from 'react';
import {Check, ChevronLeft, ChevronRight, CircleHelp, Compass, Cpu, Lightbulb, Network, Plus, Sparkles} from 'lucide-react';
import {useTerminology} from './contexts/TerminologyContext';

type Target={id:string,name:string,description:string,ownerId:string,shared:boolean};
type Stream={id:string,name:string,description:string};
type Suggestion={name:string,description:string,selected:boolean};
type DraftCategory={name:string,problems:string[]};
type Phase='name'|'focus'|'investigate'|'review';
const LENS_ICONS={classic:Network,general_challenge:Compass,technical_engineering:Cpu,industrial_design:Lightbulb};
async function request<T>(path:string,body?:object):Promise<T>{
 const response=await fetch('/api'+path,{method:body?'POST':'GET',credentials:'same-origin',
  headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(typeof data.detail==='string'?data.detail:`Request failed: ${response.status}`)}
 return response.json();
}

/** Four-step, source-preserving onboarding. Each reviewed stream is saved at most once.
 * Uses the existing target-scoped API; no new persistence fields or schemas. */
export default function NewTargetWizard({onCreated,onOpenGraph,onClose,featuredTarget,onOpenFeatured}:{
 onCreated:(target:Target)=>Promise<void>;onOpenGraph:()=>void;onClose:()=>void;
 featuredTarget?:Target|null;onOpenFeatured?:(target:Target)=>Promise<void>;
}){
 const {t,lensId,setLens,availableLenses}=useTerminology();
 const [phase,setPhase]=useState<Phase>('name');
 const [lensChosen,setLensChosen]=useState(false);
 const [name,setName]=useState('');const [scope,setScope]=useState('');
 const [advanced,setAdvanced]=useState(false);const [detail,setDetail]=useState('outline');
 const [shared,setShared]=useState(false);const [suggestions,setSuggestions]=useState<Suggestion[]>([]);
 const [custom,setCustom]=useState('');const [created,setCreated]=useState<Target|null>(null);
 const [streams,setStreams]=useState<Stream[]>([]);const [selected,setSelected]=useState<string[]>([]);
 const [taxonomyDetail,setTaxonomyDetail]=useState('standard');
 const [drafts,setDrafts]=useState<Record<string,DraftCategory[]>>({});
 const [skipped,setSkipped]=useState<string[]>([]);
 const [saved,setSaved]=useState<string[]>([]);const [reviewIds,setReviewIds]=useState<string[]>([]);
 const [reviewIndex,setReviewIndex]=useState(0);
 const [newStream,setNewStream]=useState('');const [newCategory,setNewCategory]=useState('');
 const [categoryStream,setCategoryStream]=useState('');
 const [working,setWorking]=useState('');const [error,setError]=useState('');const [message,setMessage]=useState('');
 const stepNames=[t('wizard.nameStep'),t('wizard.focusStep'),t('wizard.depthStep'),t('wizard.reviewStep')];
 const phaseIndex:{[key in Phase]:number}={name:0,focus:1,investigate:2,review:3};
 const targetBase=created?`/targets/${encodeURIComponent(created.id)}`:'';
 const activeReviewId=reviewIds[reviewIndex];
 const activeStream=streams.find(s=>s.id===activeReviewId);
 const activeCategories=drafts[activeReviewId]||[];
 const selectedForGeneration=selected.filter(id=>!saved.includes(id));
 const busy=!!working;
 async function perform(label:string,action:()=>Promise<void>){
  if(busy)return;
  setWorking(label);setError('');setMessage('');
  try{await action()}catch(e:unknown){setError(e instanceof Error?e.message:'Operation failed')}finally{setWorking('')}
 }
 async function suggested(){const response=await request<{streams:Stream[]}>('/targets/suggest-streams',{
  name,description:scope,detail});const next=response.streams.map(s=>({...s,selected:true}));setSuggestions(next);return next;}
 function chooseStream(sid:string){setSelected(previous=>previous.includes(sid)?previous.filter(x=>x!==sid):[...previous,sid]);}
 async function create(){await perform('create',async()=>{
  let proposed=suggestions;
  if(!proposed.length)proposed=await suggested();
  const chosen=proposed.filter(s=>s.selected&&s.name.trim().length>=3).map(s=>({name:s.name.trim(),description:s.description.trim()}));
  if(!chosen.length)throw new Error('Select at least one research stream, or use Suggest streams.');
  const target=await request<Target>('/targets/with-streams',{name,description:scope,shared,streams:chosen});
  setCreated(target);
  // After creation the wizard remains available even if a subsequent callback fails.
  const rows=await request<Stream[]>(`/targets/${encodeURIComponent(target.id)}/streams`);
  setStreams(rows);setSelected(rows.map(s=>s.id));setCategoryStream(rows[0]?.id||'');
  setPhase('investigate');
  await onCreated(target);
 });}
 async function generateAndReview(){if(!created)return;
  await perform('taxonomy',async()=>{
   if(!selected.length)throw new Error('Select at least one research stream.');
   for(const sid of selectedForGeneration){
    if(drafts[sid]?.length)continue; // Retry only failed streams; never spend allowance twice for a stored preview.
    const streamName=streams.find(s=>s.id===sid)?.name||sid;
    setWorking(`Generating map for ${streamName}`);
    const result=await request<{categories:DraftCategory[]}>(`${targetBase}/streams/${encodeURIComponent(sid)}/seed-preview`,{detail:taxonomyDetail});
    if(!result.categories?.length)throw new Error(`No categories were generated for ${streamName}. Retry or change map depth.`);
    setDrafts(previous=>({...previous,[sid]:result.categories}));
   }
   setReviewIds([...selected]);setReviewIndex(0);setPhase('review');
  });
 }
 function validateCategories(categories:DraftCategory[]){
  if(!categories.length)throw new Error('This stream has no generated categories to save.');
  for(const cat of categories){
   if(cat.name.trim().length<3)throw new Error('Category names must contain at least three characters.');
   if(cat.problems.some(p=>p.trim().length>0&&p.trim().length<20))throw new Error('Each problem statement must have at least 20 characters, or be cleared.');
  }
 }
 async function saveAndAdvance(){
  if(!activeReviewId)return;
  await perform('save',async()=>{
   if(!saved.includes(activeReviewId)){
    const categories=activeCategories.map(c=>({name:c.name.trim(),problems:c.problems.map(p=>p.trim()).filter(Boolean)}));
    validateCategories(categories);
    await request(`${targetBase}/streams/${encodeURIComponent(activeReviewId)}/taxonomy`,{categories});
    setSaved(previous=>previous.includes(activeReviewId)?previous:[...previous,activeReviewId]);
    // An additive taxonomy endpoint must never receive the same draft twice.
    setDrafts(previous=>{const next={...previous};delete next[activeReviewId];return next});
   }
   if(reviewIndex===reviewIds.length-1){onOpenGraph()}else{setReviewIndex(i=>i+1)}
  });
 }
 function skipAndAdvance(){
  if(!activeReviewId||busy)return;
  setSkipped(previous=>previous.includes(activeReviewId)?previous:[...previous,activeReviewId]);
  if(reviewIndex===reviewIds.length-1)onOpenGraph();
  else setReviewIndex(index=>index+1);
 }
 async function addStream(){await perform('stream',async()=>{
  const row=await request<Stream>(`${targetBase}/streams`,{name:newStream.trim(),description:''});
  setStreams(previous=>[...previous,row]);setSelected(previous=>[...previous,row.id]);setNewStream('');setCategoryStream(row.id);
 });}
 async function addCategory(){await perform('category',async()=>{
  await request(`${targetBase}/streams/${encodeURIComponent(categoryStream)}/categories`,{name:newCategory.trim()});
  setNewCategory('');setMessage(t('wizard.manualSaved'));
 });}
 function updateDraft(sid:string,index:number,kind:'name'|'problem',value:string,problemIndex=0){
  if(saved.includes(sid))return;
  setDrafts(previous=>({...previous,[sid]:(previous[sid]||[]).map((c,i)=>i!==index?c:
   kind==='name'?{...c,name:value}:{...c,problems:c.problems.map((p,j)=>j===problemIndex?value:p)})}));
 }
 return <div className="wizard-backdrop" role="dialog" aria-modal="true" aria-label={t('wizard.nameTitle')}>
  <div className="wizard-card onboarding-card">
   <div className="onboarding-progress" aria-label={t('wizard.progress')}>
    {stepNames.map((title,index)=><div key={index} className={`onboarding-progress-step ${index===phaseIndex[phase]?'active':index<phaseIndex[phase]?'complete':''}`}>
     <span className="onboarding-step-square" aria-hidden="true">{index<phaseIndex[phase]?<Check size={12}/>:index+1}</span>
     <span>{title}</span>{index<3&&<ChevronRight size={14} aria-hidden="true"/>}
    </div>)}
   </div>
   {phase==='name'&&<>
    <div className="wizard-head"><div><div className="eyebrow">{t('wizard.nameTitle').toUpperCase()}</div>
      <h2>{t('wizard.chooseLens')}</h2></div><button className="ghost" type="button" onClick={onClose}>{t('wizard.close')}</button></div>
    <div className="onboarding-lens-grid" role="group" aria-label={t('lens.label')}>
     {availableLenses.map(l=>{
      const Icon=LENS_ICONS[l.id as keyof typeof LENS_ICONS]||Network;
      return <div key={l.id} className={`onboarding-lens-option ${lensChosen&&lensId===l.id?'selected':''}`}>
       <button type="button" className="onboarding-lens-button" aria-pressed={lensChosen&&lensId===l.id} onClick={()=>{setLens(l.id);setLensChosen(true)}}>
        <Icon size={24} strokeWidth={1.5} aria-hidden="true"/>
        <span>{l.displayName}</span>
        {lensChosen&&lensId===l.id&&<Check className="onboarding-lens-check" size={14} aria-hidden="true"/>}
       </button>
       <span className="onboarding-lens-info" tabIndex={0} role="note" aria-label={`${l.displayName}: ${l.description}`}>
        <CircleHelp size={15} aria-hidden="true"/><span className="onboarding-lens-tooltip" role="tooltip">{l.description}</span>
       </span>
      </div>;
     })}
    </div>
    {lensChosen&&<div className="onboarding-lens-next" key={lensId}>
     <h2>{t('wizard.namePrompt')}</h2>
     <label className="field">{t('wizard.targetName')}<input autoFocus required maxLength={120} value={name}
        onChange={e=>setName(e.target.value)} placeholder={t('wizard.targetPlaceholder')}/></label>
     {featuredTarget&&onOpenFeatured&&<div className="onboarding-featured-target">
       <strong>{t('wizard.featuredTitle')}</strong>
       <p className="mini">{featuredTarget.name} · {featuredTarget.description||t('wizard.sharedReference')} · {t('wizard.featuredReadOnly')}</p>
       <button className="secondary" type="button" onClick={()=>void onOpenFeatured(featuredTarget)}>{t('wizard.exploreFeatured')}</button>
     </div>}
    </div>}
    <div className="wizard-actions"><button className="ghost" type="button" onClick={onClose}>{t('wizard.cancel')}</button>
     <button className="primary" type="button" disabled={!lensChosen||name.trim().length<3} onClick={()=>setPhase('focus')}>{t('wizard.next')} <ChevronRight size={15}/></button></div>
   </>}
   {phase==='focus'&&<>
    <div className="wizard-head"><div><div className="eyebrow">{name}</div><h2>{t('wizard.focusTitle')}</h2></div>
     <button className="ghost" type="button" onClick={onClose}>{t('wizard.close')}</button></div>
    <label className="field">{t('wizard.focusPrompt')}
      <textarea rows={4} maxLength={1500} value={scope} onChange={e=>setScope(e.target.value)} placeholder={t('wizard.focusPlaceholder')}/></label>
    <p className="mini">{t('wizard.initialStreams')}</p>
    <button className="text-link" type="button" aria-expanded={advanced} onClick={()=>setAdvanced(!advanced)}>{advanced?t('wizard.hide'):t('wizard.show')} {t('wizard.advanced')}</button>
    {advanced&&<div className="onboarding-advanced">
     <label className="field">{t('wizard.researchDetail')}<select value={detail} onChange={e=>{setDetail(e.target.value);setSuggestions([])}}>
      <option value="outline">Outline · 3 streams (default)</option><option value="standard">Standard · 5 streams</option><option value="detailed">Detailed · 7 streams</option></select></label>
     <label className="field"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)} style={{width:'auto',marginRight:8}}/>{t('wizard.share')}</label>
     <button className="secondary" type="button" disabled={busy||name.trim().length<3} onClick={()=>perform('suggest',async()=>{await suggested()})}><Sparkles size={14}/> {t('wizard.suggest')}</button>
     {suggestions.map((s,i)=><div className="wizard-stream" key={i}><input type="checkbox" checked={s.selected} onChange={e=>setSuggestions(old=>old.map((x,j)=>j===i?{...x,selected:e.target.checked}:x))}/><div>
      <input value={s.name} aria-label={t('wizard.streamName')} onChange={e=>setSuggestions(old=>old.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/>
      <textarea rows={2} value={s.description} aria-label={t('wizard.streamDescription')} onChange={e=>setSuggestions(old=>old.map((x,j)=>j===i?{...x,description:e.target.value}:x))}/></div></div>)}
     <div className="quick-add"><input value={custom} onChange={e=>setCustom(e.target.value)} placeholder={t('wizard.newManualStream')}/>
      <button className="secondary" type="button" disabled={custom.trim().length<3} onClick={()=>{setSuggestions(x=>[...x,{name:custom.trim(),description:'',selected:true}]);setCustom('')}}><Plus size={14}/> {t('wizard.add')}</button></div>
    </div>}
    <div className="wizard-actions"><button className="ghost" type="button" onClick={()=>setPhase('name')}><ChevronLeft size={15}/>{t('wizard.back')}</button>
     <button className="primary" type="button" disabled={busy||name.trim().length<3} onClick={create}>{busy?t('wizard.preparing'):t('wizard.create')} <ChevronRight size={15}/></button></div>
   </>}
   {phase==='investigate'&&<>
    <div className="wizard-head"><div><div className="eyebrow">{created?.name}</div>
     <h2>{t('wizard.mapTitle')}</h2><p className="muted">{t('wizard.depthPrompt')}</p></div></div>
    <div className="onboarding-stream-list">{streams.map(s=><label key={s.id} className="onboarding-stream-row">
     <input type="checkbox" checked={selected.includes(s.id)} disabled={saved.includes(s.id)||busy} onChange={()=>chooseStream(s.id)}/>
     <span><strong>{s.name}</strong><small>{s.description||t('wizard.manualStream')}</small></span>
     {saved.includes(s.id)?<span className="onboarding-complete"><Check size={14}/> {t('wizard.completed')}</span>:drafts[s.id]?.length?<span className="pill">{t('wizard.reviewDraft')}</span>:<span className="mini">{t('wizard.ready')}</span>}</label>)}</div>
    <label className="field onboarding-map-depth">{t('wizard.mapDepth')}
     <select value={taxonomyDetail} onChange={e=>{setTaxonomyDetail(e.target.value);setDrafts({})}}>
      <option value="outline">Outline · 3 categories</option><option value="standard">Standard · 5 categories, 3 problems each</option><option value="detailed">Detailed · 7 categories, 6 problems each</option></select></label>
    <button className="text-link" type="button" aria-expanded={advanced} onClick={()=>setAdvanced(!advanced)}>{advanced?t('wizard.hide'):t('wizard.show')} {t('wizard.manual')}</button>
    {advanced&&<div className="onboarding-advanced">
     <div className="quick-add"><input placeholder={t('wizard.newManualStream')} value={newStream} onChange={e=>setNewStream(e.target.value)}/><button className="secondary" type="button" disabled={busy||newStream.trim().length<3} onClick={addStream}>{t('wizard.addStream')}</button></div>
     <div className="quick-add"><select value={categoryStream} onChange={e=>setCategoryStream(e.target.value)}>{streams.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select>
      <input placeholder={t('app.newCategoryPlaceholder')} value={newCategory} onChange={e=>setNewCategory(e.target.value)}/>
      <button className="secondary" type="button" disabled={busy||newCategory.trim().length<3||!categoryStream} onClick={addCategory}>{t('wizard.addCategory')}</button></div>
     <button className="ghost" type="button" disabled={busy} onClick={onOpenGraph}>{t('wizard.skipGeneration')}</button>
    </div>}
    <div className="wizard-actions">
     <span className="mini">{t('wizard.generateNote')}</span>
     <button className="primary" type="button" disabled={busy||selectedForGeneration.length===0} onClick={generateAndReview}>
      {busy?t('wizard.generating'):t('wizard.next')} <ChevronRight size={15}/></button></div>
   </>}
   {phase==='review'&&<>
    <div className="wizard-head"><div><div className="eyebrow">{created?.name} · {t('wizard.reviewProgress',{current:reviewIndex+1,total:reviewIds.length})}</div>
     <h2>{t('wizard.reviewTitle')}</h2><p className="muted">{t('wizard.reviewIntro')}</p></div></div>
    <nav className="onboarding-review-steps" aria-label={t('wizard.reviewTitle')}>
     {reviewIds.map((id,i)=>{
      const done=saved.includes(id);const skippedStream=skipped.includes(id);const current=i===reviewIndex;
      return <button type="button" key={id} className={`onboarding-review-step ${skippedStream?'skipped':''} ${done?'done':''} ${current?'current':''}`}
       disabled={busy||(!done&&!skippedStream&&!current)} aria-current={current?'step':undefined} onClick={()=>setReviewIndex(i)}>
       <span className="onboarding-review-square">{done?<Check size={13}/>:skippedStream?'–':i+1}</span>
       <span>{streams.find(s=>s.id===id)?.name||id}</span>
      </button>;
     })}
    </nav>
    <section className="onboarding-review-body" aria-label={activeStream?.name||t('wizard.reviewTitle')}>
     <div className="onboarding-review-heading"><strong>{activeStream?.name}</strong>
      {saved.includes(activeReviewId)?<span className="onboarding-complete"><Check size={14}/>{t('wizard.completed')}</span>
       :<span className="pill">{activeCategories.length} {t('wizard.category').toLowerCase()}</span>}</div>
     {saved.includes(activeReviewId)?<p className="mini">{t('wizard.alreadySaved')}</p>:
      activeCategories.map((cat,i)=><details key={`${activeReviewId}-${i}`} className="onboarding-category">
       <summary><span className="onboarding-category-summary">{cat.name} <small>· {cat.problems.length} {t('app.problemHypothesis').toLowerCase()}s</small></span></summary>
       <div className="onboarding-category-editor"><label className="field">{t('wizard.category')}<input value={cat.name} onChange={e=>updateDraft(activeReviewId,i,'name',e.target.value)}/></label>
        {cat.problems.map((p,j)=><label key={j} className="field">{t('app.problemHypothesis')} {j+1}
         <textarea rows={2} value={p} onChange={e=>updateDraft(activeReviewId,i,'problem',e.target.value,j)}/></label>)}
       </div></details>)}
     {!saved.includes(activeReviewId)&&<p className="mini">{t('wizard.reviewSaveNote')}</p>}
    </section>
    <div className="wizard-actions onboarding-review-actions">
     <span className="mini">{t('wizard.doneNote',{count:saved.length,total:reviewIds.length})} · {skipped.length} skipped</span>
     <button className="secondary" type="button" disabled={busy} onClick={skipAndAdvance}>Skip <ChevronRight size={15}/></button>
     <button className="primary" type="button" disabled={busy} onClick={saveAndAdvance}>{busy?t('wizard.saving'):
      reviewIndex===reviewIds.length-1?'Save & Open Graph':'Save & Continue'} <ChevronRight size={15}/></button></div>
   </>}
   {working&&<div className="alert" role="status">{working==='create'?t('wizard.preparing'):working==='save'?t('wizard.saving'):working==='taxonomy'?t('wizard.generating'):working}</div>}
   {error&&<div role="alert" className="alert bad">{error}</div>}{message&&<div role="status" className="alert good">{message}</div>}
  </div>
 </div>;
}
