import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Network,Search,BookOpen,Lightbulb,BarChart3,ChevronRight,RefreshCw,ExternalLink,Plus,ArrowLeft,FlaskConical,Sparkles,FolderPlus,Trash2,Share2,Lock,Settings2,PanelsTopLeft,Sun,Moon,RotateCcw} from 'lucide-react';
import NetworkCanvas, {type ConceptAdded} from './NetworkCanvas';
import GraphAppearance from './GraphAppearance';
import NewTargetWizard from './NewTargetWizard';
import ConceptWorkspaceModal, {ConceptWorkspaceDetails} from './ConceptWorkspaceModal';
import EvaluationQueue from './EvaluationQueue';
import AdminTargetManagement from './AdminTargetManagement';
import SignalConfiguration from './SignalConfiguration';
import {tenPoint} from './scoreScale';
const EvaluationRadar = React.lazy(() => import('./EvaluationRadar'));
import TargetExplorer from './TargetExplorer';
import FloatingPanel, {viewportLayouts, type PanelId, type PanelLayout, type PanelLayouts} from './FloatingPanel';
import './style.css';
import {TerminologyProvider,useTerminology} from './contexts/TerminologyContext';

type ResearchRun={id:string,focus:string,createdAt:string,findingCount:number,gaps?:string[]};
type ResearchActivity={targetId:string,ownerId:string,runCount:number,findingCount:number,reviewedCount:number,needsReviewCount:number,rejectedCount:number,recentRuns:{id:string,problemId:number,problem:string,focus:string,createdAt:string,findingCount:number}[]};
type Problem={id:number,description:string,streamId?:string,stream?:string,category:string,categoryId?:string,findings?:Finding[],researchRuns?:ResearchRun[],solutions?:Sol[]};
type Finding={id:string,claim:string,title:string,url:string,confidence:string,limitations:string,reviewStatus:string,statistic:string};
type ConceptDraft={id:string,name:string,description:string,status:string,solutionId?:string|null,details:any};
type Sol={id:string,name:string,description:string,matches?:Match[],evaluations?:{id:string,payload:string}[]};
type Match={problemId:number,description:string,relationship:string,relevance:number,rationale:string,confidence:string};
type Factor={factor:string,score:number|null,confidence:string,rationale:string,evidence_urls:string[],unanswered_questions:string[],basis?:'evidence'|'inference'|'unknown',assumptions?:string[]};
type SocialData={summary:string,factors:{factor:string,score:number,sourceCount:number,summary?:string}[],sources:{factor:string,problemId:number,url:string,title:string,summary:string}[]};
type Eval={reconciliation?:{flagged:string[],approach:string},methodVersion?:string,agentMethods?:string[],scoreMax?:5|10,summary:string,factors:Factor[],key_assumptions:string[],risks:string[],next_research:string[],mode?:'evidence'|'exploratory',sentimentIncluded?:boolean,socialSentiment?:{summary:string,factors:{factor:string,score:number,sourceCount:number,summary?:string}[]}};
async function api<T=any>(url:string,init?:RequestInit):Promise<T>{
 const res=await fetch('/api'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...init});
 if(!res.ok){let error:any;try{error=await res.json()}catch{error={detail:res.statusText}};throw new Error(typeof error.detail==='string'?error.detail:(error.detail?.message||JSON.stringify(error.detail||res.statusText)))}
 return res.json();
}
const post=<T=any,>(url:string,body?:unknown):Promise<T>=>api<T>(url,{method:'POST',body:JSON.stringify(body??{})});

type Account={id:string,email:string,name:string,role:string};
declare global { interface Window { google?:{accounts:{id:{initialize:(opts:any)=>void,renderButton:(el:HTMLElement,opts:any)=>void}}} } }
function AuthGate({onAuthenticated}:{onAuthenticated:(user:Account)=>void}){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const googleRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  let alive=true;
  api<{googleClientId:string}>('/auth/config').then(config=>{
   if(!config.googleClientId||!alive)return;
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
   script.onload=()=>{if(!alive||!window.google||!googleRef.current)return;
    window.google.accounts.id.initialize({client_id:config.googleClientId,callback:async(r:{credential:string})=>{
      try{const response=await post('/auth/google',{credential:r.credential});onAuthenticated(response.user)}
      catch(e:any){setError(e.message)}
    }});
    window.google.accounts.id.renderButton(googleRef.current,{theme:'outline',size:'large',width:310});
   };document.head.appendChild(script);
  }).catch(()=>{});
  return()=>{alive=false};
 },[]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{const result=await post('/auth/'+(mode==='login'?'login':'register'),mode==='login'?{email,password}:{name,email,password});onAuthenticated(result.user)}
  catch(err:any){setError(err.message)}finally{setBusy(false)}
 }
 return <div className="auth-screen"><section className="auth-panel">
   <div className="auth-emblem"><Network size={24}/></div><div className="auth-eyebrow">PROBLEM EXPLORER</div>
   <h1>{mode==='login'?'Welcome back':'Create your workspace'}</h1>
   <p className="muted">Explore complex problems. Organize evidence. Develop more thoughtful solutions.</p>
   <form onSubmit={submit}>
     {mode==='register'&&<label className="field">Your name<input autoComplete="name" required value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>}
     <label className="field">Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
     <label className="field">Password<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='register'?12:1} value={password} onChange={e=>setPassword(e.target.value)}/></label>
     {mode==='register'&&<p className="mini">Use at least 12 characters. Your discoveries and concepts remain in your private workspace.</p>}
     {error&&<div role="alert" className="auth-error">{error}</div>}
     <button className="primary auth-submit" disabled={busy} type="submit">{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button>
   </form>
   <div className="auth-divider"><span>or</span></div><div ref={googleRef} className="google-signin"/>
   <p className="auth-switch">{mode==='login'?'New to Problem Explorer?':'Already have an account?'} <button type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'Create an account':'Sign in'}</button></p>
 </section></div>
}

function AdminConsole({onTargetsChanged,adminUserId}:{onTargetsChanged:()=>Promise<void>;adminUserId:string}){
 const [data,setData]=useState<any>(null);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const refresh=()=>api('/admin/overview').then(setData).catch((e:any)=>setError(e.message));
 useEffect(()=>{refresh()},[]);
 const change=async(id:string,key:'role'|'status'|'ai_daily_limit',value:string)=>{try{await api('/admin/users/'+id,{method:'PATCH',body:JSON.stringify({[key]:key==='ai_daily_limit'?Number(value):value})});await refresh()}catch(e:any){setError(e.message)}};
 return <section className="admin-area"><h2>Administration</h2><p className="muted">Manage accounts and monitor AI requests and indexing work. Only administrator accounts can open this view.</p>
 {error&&<div className="alert bad">{error}</div>}{message&&<div className="alert good">{message}</div>}
 <div className="button-row"><button className="secondary" onClick={refresh}>Refresh</button><button className="secondary" onClick={async()=>{try{await post('/admin/index-shared');setMessage('Shared reference library queued for background indexing.');await refresh()}catch(e:any){setError(e.message)}}}>Queue shared-library indexing</button></div>
 {data&&<><div className="metrics"><div><strong>{data.users?.length||0}</strong><small>Accounts (up to 250 shown)</small></div><div><strong>{data.dailyLimit}</strong><small>Daily AI requests / account</small></div><div><strong>{data.jobs?.filter((j:any)=>j.state==='queued'||j.state==='running').length||0}</strong><small>Index jobs pending</small></div></div>
 <h3>Accounts</h3><div className="admin-table"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Daily AI limit</th></tr></thead><tbody>{data.users?.map((u:any)=><tr key={u.id}><td><strong>{u.name}</strong><small>{u.email}</small></td><td><select value={u.role} onChange={e=>change(u.id,'role',e.target.value)}><option value="user">User</option><option value="admin">Administrator</option></select></td><td><select value={u.status} onChange={e=>change(u.id,'status',e.target.value)}><option value="active">Active</option><option value="disabled">Disabled</option></select></td><td><input type="number" min="0" max="100000" defaultValue={u.ai_daily_limit??data.dailyLimit} key={u.id+String(u.ai_daily_limit)} style={{width:90}} onBlur={e=>{const value=Number(e.target.value);if(Number.isInteger(value)&&value>=0)change(u.id,"ai_daily_limit" as any,String(value))}}/></td></tr>)}</tbody></table></div>
 <h3>Background indexing</h3><div className="admin-table"><table><thead><tr><th>Scope</th><th>Status</th><th>Embedded</th><th>Detail</th></tr></thead><tbody>{data.jobs?.map((j:any)=><tr key={j.id}><td>{j.kind}</td><td>{j.state}</td><td>{j.processed}</td><td>{j.error||'—'}</td></tr>)}</tbody></table></div>
 <h3>Recent AI usage</h3><div className="admin-table"><table><thead><tr><th>User ID</th><th>UTC date</th><th>Requests</th></tr></thead><tbody>{data.usage?.map((r:any)=><tr key={r.user_id+r.day}><td>{r.user_id.slice(0,8)}…</td><td>{r.day}</td><td>{r.requests}</td></tr>)}</tbody></table></div></>}
 <AdminTargetManagement adminUserId={adminUserId} onChanged={onTargetsChanged}/>
 </section>;
}

// v0.7: one target-scoped workspace, shared by graph, discovery, evidence and concepts.
type Target={id:string,name:string,description:string,ownerId:string,shared:boolean,reference?:boolean,listed?:boolean,featured?:boolean,featuredLenses?:string[]};
type Directory={mine:Target[],shared:Target[],defaultTargetId?:string|null};
type NavTab='graph'|'directory'|'problems'|'research'|'discovery'|'concepts'|'generateConcepts'|'matching'|'evaluation'|'manage'|'admin';
type Scope={streamId:string,stream:string,categoryId:string|null,category:string|null,count:number};
type SeedCategory={name:string,problems:string[]};
type Draft={id:string,name:string,description:string,status:string,solutionId?:string,details:any};
const targetUrl=(id:string,rest='')=>'/targets/'+encodeURIComponent(id)+rest;
const patch=<T=any,>(url:string,body:unknown):Promise<T>=>api<T>(url,{method:'PATCH',body:JSON.stringify(body)});
const del=<T=any,>(url:string):Promise<T>=>api<T>(url,{method:'DELETE'});

function Root(){
 const [account,setAccount]=useState<Account|null>(null);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{api<{user:Account|null}>('/auth/me').then(r=>setAccount(r.user)).finally(()=>setLoading(false))},[]);
 if(loading)return <div className="auth-screen"><div className="auth-panel">Loading your workspace…</div></div>;
 if(!account)return <AuthGate onAuthenticated={setAccount}/>;
 return <TerminologyProvider preferenceKey={account.id}><IntegratedWorkspace account={account} onLogout={async()=>{await post('/auth/logout');setAccount(null)}}/></TerminologyProvider>;
}

function IntegratedWorkspace({account,onLogout}:{account:Account,onLogout:()=>Promise<void>}){
 const {t,getLabel,lensId,setLens,availableLenses}=useTerminology();
 const [directory,setDirectory]=useState<Directory>({mine:[],shared:[]});
 const [current,setCurrent]=useState<Target|null>(null);
 const [tab,setTab]=useState<NavTab>('graph');
 const [theme,setTheme]=useState<'dark'|'light'>(()=>{
   const saved=window.localStorage.getItem('problem-explorer-theme');
   if(saved==='light'||saved==='dark')return saved;
   return window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
 });
 useEffect(()=>{
   if(window.localStorage.getItem('problem-explorer-theme'))return;
   const media=window.matchMedia('(prefers-color-scheme: light)');
   const update=()=>setTheme(media.matches?'light':'dark');
   media.addEventListener('change',update);
   return()=>media.removeEventListener('change',update);
 },[]);
 const [panels,setPanels]=useState<PanelLayouts>(viewportLayouts);
 const highestZ=useRef(20);
 const [problemModalOpen,setProblemModalOpen]=useState(false);
 const [conceptModalOpen,setConceptModalOpen]=useState(false);
 useEffect(()=>{
   if(!problemModalOpen&&!conceptModalOpen)return;
   const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setProblemModalOpen(false);setConceptModalOpen(false)}};
   document.addEventListener('keydown',close);
   return()=>document.removeEventListener('keydown',close);
 },[problemModalOpen,conceptModalOpen]);
 const updatePanel=(id:PanelId,patch:Partial<PanelLayout>)=>setPanels(previous=>({...previous,[id]:{...previous[id],...patch}}));
 const focusPanel=(id:PanelId)=>setPanels(previous=>({...previous,[id]:{...previous[id],z:++highestZ.current}}));
 const openPanel=(id:PanelId)=>setPanels(previous=>{
   const panel=previous[id];
   const width=Math.min(panel.width,Math.max(240,window.innerWidth-24));
   return {...previous,[id]:{...panel,isOpen:true,isCollapsed:false,z:++highestZ.current,
     width,x:Math.max(8,Math.min(panel.x,window.innerWidth-width-12)),
     y:Math.max(64,Math.min(panel.y,window.innerHeight-52))}};
 });
 const switchTheme=()=>setTheme(value=>{const next=value==='dark'?'light':'dark';window.localStorage.setItem('problem-explorer-theme',next);return next});

 const [wizard,setWizard]=useState(false);
 const [busy,setBusy]=useState(''); const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [version,setVersion]=useState(0);
 const [appearanceVersion,setAppearanceVersion]=useState(0);
 const [graphActivityVersion,setGraphActivityVersion]=useState(0);
 const [researchEntry,setResearchEntry]=useState<'studio'|'problem'>('studio');
 const [evaluationEntry,setEvaluationEntry]=useState<'studio'|'concept'>('studio');
 const [conceptEntry,setConceptEntry]=useState<'studio'|'problem'>('studio');
 const [studioPick,setStudioPick]=useState<number|null>(null);
 const [studioQuery,setStudioQuery]=useState('');
 const [rejectedConcepts,setRejectedConcepts]=useState<{id:string;name:string;description:string;originProblemId:number|null;originProblem:string|null}[]>([]);
 const [rejectedConceptPage,setRejectedConceptPage]=useState(0);
 const [rejectedConceptVersion,setRejectedConceptVersion]=useState(0);
 const [conceptAdded,setConceptAdded]=useState<ConceptAdded|null>(null);
 const [revealProblem,setRevealProblem]=useState<{problemId:number;sequence:number}|null>(null);
 const [conceptOrigin,setConceptOrigin]=useState('');
 const [stats,setStats]=useState<any>({streams:0,categories:0,problems:0,solutions:0});
 const [researchActivity,setResearchActivity]=useState<ResearchActivity|null>(null);
 const [rejectedFindings,setRejectedFindings]=useState<(Finding & {problemId:number;problem:string;rejectedAt:string})[]>([]);
 const [rejectedVersion,setRejectedVersion]=useState(0);
 const [rejectedPage,setRejectedPage]=useState(0);
 const [streams,setStreams]=useState<{id:string,name:string,description:string}[]>([]);
 const [hierarchy,setHierarchy]=useState<Scope[]>([]);
 const [problems,setProblems]=useState<Problem[]>([]);
 const [sols,setSols]=useState<Sol[]>([]);
 const [discoveries,setDiscoveries]=useState<any[]>([]);
 const [selected,setSelected]=useState<Problem|null>(null);
 const [drafts,setDrafts]=useState<Draft[]>([]); const [draftEdits,setDraftEdits]=useState<Record<string,{name:string,description:string}>>({});
 const [solution,setSolution]=useState<Sol|null>(null);
 const [evaluation,setEvaluation]=useState<Eval|null>(null);
 const [evaluationMode,setEvaluationMode]=useState<'evidence'|'exploratory'>('exploratory');
 const [showSocial,setShowSocial]=useState(false);
 const [socialData,setSocialData]=useState<SocialData|null>(null);
 const [signalVisible,setSignalVisible]=useState(false);
 const [signalVersion,setSignalVersion]=useState(0);
 useEffect(()=>{
   let active=true;
   if(!panels.evaluation.isOpen || !current?.id || !solution?.id || !evaluation) {setSocialData(null);return;}
   api<SocialData>(`/targets/${encodeURIComponent(current.id)}/signals/solutions/${encodeURIComponent(solution.id)}`)
     .then(result=>{if(active)setSocialData(result)})
     .catch(()=>{if(active)setSocialData(null)});
   return()=>{active=false};
 },[current?.id,solution?.id,panels.evaluation.isOpen,signalVersion,!!evaluation]);
 const [searchText,setSearchText]=useState('');const [searchMode,setSearchMode]=useState('exact');const [searchResults,setSearchResults]=useState<any[]|null>(null);
 const [focus,setFocus]=useState('prevalence, affected populations, existing responses, limitations and gaps');
 const [designDirection,setDesignDirection]=useState(''); const [conceptCount,setConceptCount]=useState(4);
 const [conceptSearch,setConceptSearch]=useState('');
 const [conceptName,setConceptName]=useState('');const [conceptDescription,setConceptDescription]=useState('');
 const [discoveryTopic,setDiscoveryTopic]=useState(''); const [discoveryEdits,setDiscoveryEdits]=useState<Record<string,string>>({});
 const [selectedStream,setSelectedStream]=useState('');const [selectedCategory,setSelectedCategory]=useState('');
 const [newStream,setNewStream]=useState('');const [newCategory,setNewCategory]=useState('');const [newProblem,setNewProblem]=useState('');
 const [seedDetail,setSeedDetail]=useState('standard');const [seedPreview,setSeedPreview]=useState<SeedCategory[]|null>(null);
 const [editTarget,setEditTarget]=useState(false);const [editingName,setEditingName]=useState('');const [editingDesc,setEditingDesc]=useState('');const [editingShared,setEditingShared]=useState(false);
 const readOnly=!!current && current.ownerId!==account.id;
 const path=current?targetUrl(current.id):'';
 const refreshResearchActivity=async()=>{if(current)setResearchActivity(await api<ResearchActivity>(targetUrl(current.id)+'/research/activity'))};
 useEffect(()=>{if(!panels.rejected.isOpen||!current?.id)return;
  let active=true;api<typeof rejectedFindings>(targetUrl(current.id)+'/research/rejected-findings?limit=50&skip='+String(rejectedPage*50))
   .then(rows=>{if(!active)return;if(rows.length===0&&rejectedPage>0)setRejectedPage(page=>page-1);else setRejectedFindings(rows)}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[current?.id,panels.rejected.isOpen,rejectedVersion,rejectedPage]);
 useEffect(()=>{if(!panels.rejectedConcepts.isOpen||!current?.id)return;
   let live=true;
   api<typeof rejectedConcepts>(targetUrl(current.id)+'/solutions/rejected?limit=50&skip='+String(rejectedConceptPage*50))
     .then(rows=>{if(live)setRejectedConcepts(rows)}).catch(e=>{if(live)setError(e.message)});
   return()=>{live=false};
 },[current?.id,panels.rejectedConcepts.isOpen,rejectedConceptVersion,rejectedConceptPage]);
 const run=async(label:string,fn:()=>Promise<void>)=>{
   setBusy(label);setError('');setNotice('');
   try{await fn()}catch(e:any){setError(e.message||'Unexpected error')}finally{setBusy('')}
 };
 const reloadDirectory=async()=>{const d=await api<Directory>('/targets?lens='+encodeURIComponent(lensId));setDirectory(d);return d};
 const loadData=async(tid:string)=>{
   const p=targetUrl(tid);
   const [s,h,pr,sol,disc,metrics,activity]=await Promise.all([
     api<typeof streams>(p+'/streams'),api<Scope[]>(p+'/hierarchy'),api<Problem[]>(p+'/problems?limit=1000'),
     api<Sol[]>(p+'/solutions'),api<any[]>(p+'/discoveries'),api<any>(p+'/stats'),
     api<ResearchActivity>(p+'/research/activity')]);
   setStreams(s);setHierarchy(h);setProblems(pr);setSols(sol);setDiscoveries(disc);setStats(metrics);setResearchActivity(activity);
   setSelectedStream(v=>s.some(x=>x.id===v)?v:s[0]?.id||'');
   setSelectedCategory(v=>h.some(x=>x.categoryId===v)?v:h.find(x=>x.categoryId)?.categoryId||'');
 };
 const selectTarget=async(t:Target,keepWizard=false)=>{
   setCurrent(t);setRejectedFindings([]);setRejectedPage(0);setRejectedConcepts([]);setRejectedConceptPage(0);setStudioPick(null);setResearchEntry('studio');setConceptEntry('studio');setEvaluationEntry('studio');setConceptAdded(null);setRevealProblem(null);setConceptOrigin('');setResearchActivity(null);setSelected(null);setProblemModalOpen(false);setConceptModalOpen(false);setDrafts([]);setSolution(null);setEvaluation(null);setSearchResults(null);setSeedPreview(null);setTab('graph');if(!keepWizard)setWizard(false);
   await loadData(t.id);
 };
 const refreshTarget=async()=>{if(current){await loadData(current.id);setVersion(v=>v+1)}};
 const refreshConcepts=async()=>{if(current)await loadData(current.id)};
 const markNewConcept=(created:{id:string;name:string},originId:number|null)=>{
   if(originId!==null)setConceptAdded({id:created.id,name:created.name,
     originProblemId:originId,sequence:Date.now()});
 };
 const bootstrapped=useRef(false);
 useEffect(()=>{
   // A lens change refreshes directory recommendations only. It must not
   // close the wizard, switch an active Target, or remount the network.
   let cancelled=false;
   reloadDirectory().then(d=>{
     if(cancelled||bootstrapped.current)return;
     bootstrapped.current=true;
     const recommended=d.shared.find(item=>item.id===d.defaultTargetId);
     const first=d.mine[0]||recommended;
     if(first)selectTarget(first).catch((e:any)=>setError(e.message));
     else setWizard(true);
   }).catch((e:any)=>{if(!cancelled)setError(e.message)});
   return()=>{cancelled=true};
 },[lensId]);
 const onProblemNodeSelect=(recordId:number)=>run('problem',async()=>{
   await loadProblem(recordId,false);
   setProblemModalOpen(true);
 });
 const loadProblem=async(id:number,go=true)=>{
   if(!current)return;
   const [p,d]=await Promise.all([api<Problem>(path+'/problems/'+id),api<Draft[]>(path+'/problems/'+id+'/concepts')]);
   setSelected(p);setDrafts(d);setConceptOrigin(String(id));if(go)changeTab('research',true);
 };
 const loadSolution=async(id:string,go=true)=>{
   if(!current)return;
   const s=await api<Sol>(path+'/solutions/'+id);
   setSolution(s);
   try{const ev:Eval|null=s.evaluations?.[0]?.payload?JSON.parse(s.evaluations[0].payload):null;setEvaluation(ev);setEvaluationMode('exploratory')}catch{setEvaluation(null)}
   if(go)changeTab('matching');
 };
 const openConceptWorkspace=async(id:string, inStudio=false)=>{
   setConceptModalOpen(false);
   await loadSolution(id,false);
   setProblemModalOpen(false);
   if(inStudio){setTab('concepts');openPanel('concepts')}else setConceptModalOpen(true);
 };
 const openProblemResearch=async(id:number)=>{
   await loadProblem(id,false);setResearchEntry('problem');setTab('research');openPanel('problemResearch');setProblemModalOpen(false);
 };
 const saveManualConcept=(withMatching:boolean)=>run('newConcept',async()=>{
   if(!current)return;
   const originId=conceptOrigin?Number(conceptOrigin):null;
   const created=await post<Sol>(path+'/solutions',{name:conceptName,description:conceptDescription,originProblemId:originId});
   markNewConcept(created,originId);setConceptName('');setConceptDescription('');
   await refreshConcepts();await loadSolution(created.id,false);
   setGraphActivityVersion(v=>v+1);
   if(withMatching){
     const result=await post<{matches:Match[]}>(path+'/solutions/'+created.id+'/match');
     await loadSolution(created.id,false);
     setNotice('Concept saved · '+result.matches.length+' potential Problem matches generated.');
   }else setNotice('Concept saved. Choose Save & Match to calculate potential relationships.');
 });
 const rejectSelectedConcept=()=>{if(!solution||!window.confirm('Reject this concept? It can be restored later.'))return;
   const id=solution.id;void run('rejectConcept',async()=>{
     await patch(path+'/solutions/'+id+'/status',{status:'rejected'});
     setSolution(null);setEvaluation(null);setConceptModalOpen(false);
     await refreshConcepts();if(selected)await loadProblem(selected.id,false);
     setGraphActivityVersion(v=>v+1);setRejectedConceptVersion(v=>v+1);
     setNotice('Concept moved to rejected concepts.');
   });};
 const newTarget=()=>setWizard(true);
 const copyTarget=(t:Target)=>run('copyTarget',async()=>{
   const copy=await post<Target & {streamCount:number,problemCount:number}>(targetUrl(t.id)+'/copy');
   await reloadDirectory();await selectTarget(copy);setNotice('Editable copy created: '+copy.streamCount+' streams and '+copy.problemCount+' problems.');
 });
 const changeTab=(value:NavTab,fromProblem=false)=>{
   if(value==='research')setResearchEntry(fromProblem?'problem':'studio');
   if(value==='evaluation'){setEvaluationEntry(fromProblem?'concept':'studio');if(fromProblem)setEvaluationMode('exploratory')}
   if(value==='generateConcepts')setConceptEntry(fromProblem?'problem':'studio');
   if(!fromProblem&&['research','generateConcepts'].includes(value))setStudioPick(null);
   setTab(value);
   if(value==='graph')openPanel('targetExplorer');
   else if(value==='research'&&fromProblem)openPanel('problemResearch');
   else openPanel(value);
   setError('');setNotice('')};
 const nav:{id:NavTab,label:string,icon:React.ReactNode}[]=[
   {id:'problems',label:t('app.problems'),icon:<Search size={16}/>},
   {id:'research',label:t('app.research'),icon:<BookOpen size={16}/>},
   {id:'discovery',label:t('app.discovery'),icon:<Sparkles size={16}/>},
   {id:'concepts',label:t('app.concepts'),icon:<Lightbulb size={16}/>},
   {id:'matching',label:t('app.matching'),icon:<Network size={16}/>},
   {id:'evaluation',label:t('app.analysis'),icon:<BarChart3 size={16}/>},
   {id:'manage',label:t('app.manage'),icon:<Settings2 size={16}/>},
 ];
 const choose=(id:string)=>run('switch',async()=>{
   const t=[...directory.mine,...directory.shared].find(x=>x.id===id);
   if(t)await selectTarget(t);
 });
 const saveSettings=()=>run('editTarget',async()=>{
   if(!current)return;
   await patch(path,{name:editingName,description:editingDesc,shared:editingShared});
   await reloadDirectory();const updated={...current,name:editingName,description:editingDesc,shared:editingShared};setCurrent(updated);
   setEditTarget(false);setNotice('Target details saved.');setVersion(v=>v+1);
 });
 const startEdit=()=>{if(!current)return;setEditingName(current.name);setEditingDesc(current.description);setEditingShared(current.shared);setEditTarget(true)};
 const studioPicker=(kind:'research'|'generateConcepts')=><div className="studio-global-filter">
   <h3>{kind==='research'?t('app.research'):t('app.generateConcepts')} · {t('app.allProblems')}</h3>
   <input aria-label={t('app.studioSearch')} value={studioQuery} onChange={e=>setStudioQuery(e.target.value)}
     placeholder={t('app.studioSearch')}/>
   <label className="field">{t('app.originatingProblem')}
     <select value={studioPick??''} onChange={e=>{const id=Number(e.target.value);setStudioPick(id||null);
       if(id)void run('problem',()=>loadProblem(id,false));}}>
       <option value="">{t('app.chooseProblem')}</option>
       {problems.filter(p=>p.description.toLowerCase().includes(studioQuery.toLowerCase())).map(p=><option key={p.id} value={p.id}>#{p.id} · {p.description.slice(0,120)}</option>)}
     </select>
   </label>
 </div>;
 const renderProblemList=(items:Problem[])=>items.length?<div className="problem-list-v07">{items.map(p=><button className="problem-item" key={p.id} onClick={()=>run('problem',()=>loadProblem(p.id))}><span className="num">#{p.id}</span><span>{p.description}<small>{p.stream} · {p.category}</small></span><ChevronRight size={14}/></button>)}</div>:<p className="empty">{t('app.noProblems')}</p>;

 return <div className={`app workspace-v08 theme-${theme}`}>
  <NetworkCanvas targetId={current?.id||null} refreshKey={version} theme={theme}
    onProblemNodeSelect={onProblemNodeSelect}
    onConceptNodeSelect={id=>run('concept',()=>openConceptWorkspace(id))}
    conceptAdded={conceptAdded} revealProblem={revealProblem} signalVisible={signalVisible} signalVersion={signalVersion}
    onRestoreSignal={setSignalVisible} appearanceVersion={appearanceVersion} activityVersion={graphActivityVersion}/>
  <div className="workspace-toolbar">
    <div className="toolbar-brand"><Network size={19}/><strong>PROBLEM EXPLORER</strong><span className="toolbar-separator"/>
      <span className="toolbar-target" title={current?.description||t('app.noTargetSelected')}>{current?.name||t('app.noTarget')}</span>
      {readOnly&&<span className="toolbar-badge">READ ONLY</span>}</div>
    <div className="toolbar-actions">
      <button type="button" onClick={()=>openPanel('navigation')} title="Open navigation"><PanelsTopLeft size={16}/> <span>Navigation</span></button>
      <button type="button" onClick={()=>openPanel('targetExplorer')} title={t('app.openExplorer')}><Network size={16}/> <span>{t('app.explorer')}</span></button>
      <button type="button" onClick={()=>openPanel('overview')} title={t('app.overview')}><BookOpen size={16}/> <span>{t('app.overview')}</span></button>
      <button type="button" onClick={()=>setSignalVisible(v=>!v)} title="Toggle social discussion ring on network"
        aria-pressed={signalVisible}>{signalVisible?'Social signals on':'Social signals off'}</button>
      {account.role==='admin'&&<button type="button" onClick={()=>openPanel('signals')} title="Configure social discussion signal sources">Signals</button>}
      {account.role==='admin'&&<button type="button" onClick={()=>openPanel('appearance')} title="Configure graph hierarchy colors">Appearance</button>}
      <label className="toolbar-lens" title={t('lens.description')}>
        <span>{t('lens.label')}</span><select value={lensId} aria-label={t('lens.change')} onChange={e=>setLens(e.target.value)}>
          {availableLenses.map(lens=><option key={lens.id} value={lens.id}>{lens.displayName}</option>)}
        </select></label>
      <button type="button" onClick={()=>setPanels(viewportLayouts())} title="Restore panel positions"><RotateCcw size={15}/></button>
      <button type="button" onClick={switchTheme} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'}
        aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>
    </div>
  </div>
  {(error||notice)&&<div className={'workspace-toast '+(error?'is-error':'')} role={error?'alert':'status'}>
    <span>{error||notice}</span><button type="button" onClick={()=>{setError('');setNotice('')}} aria-label="Dismiss notification">×</button>
  </div>}
  <div className="windows-layer">
   <FloatingPanel id="navigation" title={t('app.navigation')} state={panels.navigation} update={updatePanel} focus={focusPanel}>
  <aside className="sidebar target-sidebar-v07">
   <div className="brand"><div className="brandmark"><Network size={21}/></div><div><strong>PROBLEM <b>EXPLORER</b></strong><small>RESEARCH WORKSPACE · v0.9.9.1</small></div></div>
   <div className="side-heading" style={{marginTop:20}}>{t('app.workspace').toUpperCase()}</div>
   <button type="button" className="nav" onClick={newTarget}><Plus size={16}/> {t('app.createNewTarget')}</button>
   <button type="button" className={'nav '+(tab==='directory'?'on':'')} onClick={()=>changeTab('directory')}><BookOpen size={16}/> {t('app.directory')}</button>
   <button type="button" className="nav" onClick={()=>openPanel('overview')}><BookOpen size={16}/> {t('app.overview')}</button>
   <button type="button" className="nav" onClick={()=>openPanel('targetExplorer')}><Network size={16}/> {t('app.explorer')}</button>
   {nav.map(item=><button className={'nav '+(tab===item.id?'on':'')} key={item.id} onClick={()=>changeTab(item.id)}>{item.icon}{item.label}</button>)}
   {account.role==='admin'&&<><div className="side-heading" style={{marginTop:18}}>{t('app.platform').toUpperCase()}</div><button className={'nav '+(tab==='admin'?'on':'')} onClick={()=>changeTab('admin')}><Settings2 size={16}/> {t('app.admin')}</button></>}
   {account.role==='admin'&&<button type="button" className="nav" onClick={()=>openPanel('signals')}><Settings2 size={16}/> Social signal settings</button>}
   <div className="side-bottom"><div>{account.name}</div><div>{account.email}</div><button className="text-link" onClick={onLogout}>Sign out</button></div>
  </aside>
   </FloatingPanel>
   <FloatingPanel id="targetExplorer" title={t('app.explorer')} state={panels.targetExplorer} update={updatePanel} focus={focusPanel}>
     <TargetExplorer target={current} mine={directory.mine} shared={directory.shared}
       streams={streams} hierarchy={hierarchy} problems={problems} readOnly={readOnly} busy={!!busy}
       onTargetChange={choose} onNewTarget={newTarget} onBrowseTargets={()=>changeTab('directory')}
       onOpenProblem={onProblemNodeSelect}/>
   </FloatingPanel>
   <FloatingPanel id="overview" title={t('app.overview')} state={panels.overview} update={updatePanel} focus={focusPanel}>
    <main className="main target-main-v07">
   <header className="topbar"><div><div className="eyebrow">{current?(readOnly?'SHARED · READ ONLY':'PRIVATE WORKSPACE'):'YOUR WORKSPACE'}</div><h1>{tab==='admin'?t('app.admin'):current?.name||t('app.createTarget')}</h1><p>{current?.description||'Create a target to begin research, or open the shared target library.'}</p></div><div className="top-actions">{current&&readOnly&&<button className="primary" disabled={!!busy} onClick={()=>copyTarget(current)}><Plus size={15}/> Copy to workspace</button>}{current&&!readOnly&&<button className="ghost small" onClick={startEdit}>Edit target</button>}<span className="status"><span className="dot"/> {busy?'Working…':'Workspace ready'}</span></div></header>
   {error&&<div className="alert bad" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
   {notice&&<div className="alert good" role="status">{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}
   {current&&<><div className="metrics overview-metrics">
    <button type="button" onClick={()=>changeTab('manage')}><strong>{stats.streams}</strong><small>{t('app.researchStreams')}</small></button>
    <button type="button" onClick={()=>changeTab('manage')}><strong>{stats.categories}</strong><small>{t('app.categories')}</small></button>
    <button type="button" onClick={()=>changeTab('problems')}><strong>{stats.problems}</strong><small>{getLabel('problem','plural')}</small></button>
    <button type="button" onClick={()=>changeTab('concepts')}><strong>{stats.solutions}</strong><small>{t('app.savedConcepts')}</small></button>
    <button type="button" onClick={()=>openPanel('rejectedConcepts')}><strong>{stats.rejectedSolutions??0}</strong><small>{t('app.rejectedConcepts')}</small></button>
   </div>
   <h3>Saved findings</h3><div className="metrics overview-metrics research-overview-metrics">
    <button type="button" onClick={()=>changeTab('research')}><strong>{researchActivity?.findingCount??0}</strong><small>Total findings</small></button>
    <button type="button" onClick={()=>changeTab('research')}><strong>{researchActivity?.reviewedCount??0}</strong><small>Reviewed findings</small></button>
    <button type="button" onClick={()=>changeTab('research')}><strong>{researchActivity?.needsReviewCount??0}</strong><small>Needs review</small></button>
    <button type="button" onClick={()=>openPanel('rejected')}><strong>{researchActivity?.rejectedCount??0}</strong><small>Rejected · review or restore</small></button>
   </div></>}

<div className="overview-quick-actions">
      <p className="muted">Browse the research structure in {t('app.explorer')}, or open a focused workflow alongside the graph.</p>
      <div className="button-row">
        <button type="button" className="primary" onClick={()=>openPanel('targetExplorer')}><Network size={15}/> {t('app.openExplorer')}</button>
        <button type="button" className="secondary" onClick={()=>changeTab('problems')}><Search size={15}/> {t('app.searchProblems')}</button>
        <button type="button" className="ghost" onClick={()=>changeTab('research')}><BookOpen size={15}/> {t('app.research')}</button>
      </div>
    </div>
    </main>
   </FloatingPanel>
   {panels.directory.isOpen&&<FloatingPanel id="directory" title={t('app.directory')} state={panels.directory} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><BookOpen size={18}/> {t('app.directory')}</span><button className="primary" onClick={newTarget}><Plus size={14}/> {t('app.createTarget')}</button></div><p className="muted">{t('app.targetDirectoryIntro')}</p><h3>{t('app.myTargets')}</h3>{directory.mine.length?directory.mine.map(t=><div className="target-row" key={t.id}><div><strong>{t.name}</strong><p>{t.description||'No description'}</p></div><button className="secondary" onClick={()=>run('open',()=>selectTarget(t))}>Open</button></div>):<p className="empty">{t('app.noTargets')}</p>}
   <h3>{t('app.sharedTargets')}</h3>{directory.shared.map(t=><div className="target-row" key={t.id}><div><strong>{t.name}</strong>{t.id===directory.defaultTargetId&&<span className="mini featured-target-marker">Recommended · {availableLenses.find(l=>l.id===lensId)?.displayName||'Classic'}</span>}<p>{t.description||'Shared research'}</p></div><div className="button-row"><button className="secondary" onClick={()=>run('open',()=>selectTarget(t))}>Explore</button><button className="primary" onClick={()=>copyTarget(t)} disabled={!!busy}>Copy to workspace</button></div></div>)}</section></div></FloatingPanel>}

   {panels.appearance.isOpen && account.role==='admin'&&<FloatingPanel id="appearance" title="Graph appearance" state={panels.appearance} update={updatePanel} focus={focusPanel}><GraphAppearance onSaved={()=>setAppearanceVersion(v=>v+1)}/></FloatingPanel>}
   {panels.admin.isOpen && account.role==='admin'&&<FloatingPanel id="admin" title={t('app.admin')} state={panels.admin} update={updatePanel} focus={focusPanel}><AdminConsole adminUserId={account.id} onTargetsChanged={async()=>{const d=await reloadDirectory();if(current && ![...d.mine,...d.shared].some(t=>t.id===current.id)){setCurrent(null);setSelected(null);setSolution(null);setEvaluation(null);if(d.mine.length)await selectTarget(d.mine[0]);else{setWizard(true);setVersion(v=>v+1)}}}}/></FloatingPanel>}

   {panels.problems.isOpen&&<FloatingPanel id="problems" title={t('app.problems')} state={panels.problems} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><Search size={17}/> {t('app.problemLibraryMatching')}</span></div><p className="muted">{t('app.searchScope')}</p><div className="search-row"><input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder={t('app.problemQuery')}/><select value={searchMode} onChange={e=>setSearchMode(e.target.value)}><option value="exact">Lexical</option><option value="hybrid">Hybrid</option><option value="semantic">Semantic</option></select><button className="primary" disabled={!current||!!busy||searchText.length<3} onClick={()=>run('search',async()=>{const r=await post<{results:any[],mode:string}>(path+'/search',{text:searchText,mode:searchMode});setSearchResults(r.results);setNotice(r.results.length+' '+r.mode+' results.')})}>Search</button></div><div className="button-row">{!readOnly&&current&&<button className="secondary" onClick={()=>run('index',async()=>{await post(path+'/index/queue');setNotice('Background semantic indexing queued for this target.')})}>Queue target indexing</button>}<button className="ghost" onClick={()=>{setSearchResults(null);setSearchText('')}}>Clear</button></div><h3>{searchResults?'Search results':'All problems'}</h3>{renderProblemList((searchResults||problems) as Problem[])}</section></div></FloatingPanel>}

   {panels.signals.isOpen && account.role==='admin'&&<FloatingPanel id="signals" title={t('app.signals')} state={panels.signals} update={updatePanel} focus={focusPanel}>
     <SignalConfiguration targetId={current?.id||null} api={api} changed={()=>setSignalVersion(v=>v+1)}/>
   </FloatingPanel>}
   {/* Global research studio: only target-wide history and discovery. This is not the Problem research view. */}
   {panels.research.isOpen&&<FloatingPanel id="research" title={t('app.research')} state={panels.research} update={updatePanel} focus={focusPanel}>
     <div className="content wide-content"><section className="panel research-studio-panel">
       <div className="pane-title"><span><BookOpen size={17}/> {t('app.research')}</span></div>
       <p className="muted">Research sessions and source findings for this {getLabel('target').toLowerCase()}.</p>
       <div className="research-persistence">
         <div><strong>{researchActivity?.runCount??0}</strong><small>Saved research sessions</small></div>
         <div><strong>{researchActivity?.findingCount??0}</strong><small>Total findings</small></div>
         <div><strong>{researchActivity?.reviewedCount??0}</strong><small>Reviewed findings</small></div>
         <div><strong>{researchActivity?.needsReviewCount??0}</strong><small>Needs review</small></div>
         <button type="button" onClick={()=>openPanel('rejected')}><strong>{researchActivity?.rejectedCount??0}</strong><small>Rejected · view / restore</small></button>
       </div>
       <p className="mini">{readOnly?'Read-only shared research. Make a copy to add findings.':`Showing research saved to this workspace by ${account.name}.`}</p>
       <label className="field">{t('app.studioSearch')}<input value={studioQuery} onChange={e=>setStudioQuery(e.target.value)} placeholder={t('app.studioSearch')}/></label>
       <h3>Saved research sessions</h3>
       {researchActivity?.recentRuns.filter(r=>[r.problem,r.focus].some(value=>value.toLowerCase().includes(studioQuery.toLowerCase()))).length?
         <div className="research-studio-sessions">{researchActivity.recentRuns.filter(r=>[r.problem,r.focus].some(value=>value.toLowerCase().includes(studioQuery.toLowerCase()))).map(r=>
           <button type="button" className="research-history-item" key={r.id} onClick={()=>run('problem',()=>openProblemResearch(r.problemId))}>
             <strong>{r.problem}</strong><small>{r.createdAt?.slice(0,16).replace('T',' ')} · {r.findingCount} findings · {r.focus}</small>
           </button>)}</div> : <p className="empty">No saved research sessions match the search.</p>}
       <h3>{getLabel('problem','plural')}</h3>
       <p className="mini">Choose a {getLabel('problem').toLowerCase()} to open its dedicated research window.</p>
       <div className="research-studio-problems">{problems.filter(problem=>problem.description.toLowerCase().includes(studioQuery.toLowerCase())).slice(0,100).map(problem=><button className="saved-item" type="button" key={problem.id} onClick={()=>run('problem',()=>openProblemResearch(problem.id))}>{problem.description}<ChevronRight size={14}/></button>)}</div>
     </section></div>
   </FloatingPanel>}
   {/* A distinct, Problem-bound research window with the original review/save contracts. */}
   {panels.problemResearch.isOpen&&<FloatingPanel id="problemResearch" title={t('app.problemResearch')} state={panels.problemResearch} update={updatePanel} focus={focusPanel}>
     <div className="content wide-content"><section className="panel problem-research-panel">
       {selected?<><h2>{selected.description}</h2><button className="secondary small" type="button" onClick={()=>{setRevealProblem({problemId:selected.id,sequence:Date.now()});setProblemModalOpen(false)}}>Reveal linked concepts on graph</button><p className="muted">{selected.stream} · {selected.category}</p><h3>{t('app.problemResearch')}</h3><p className="muted">{t('app.researchDisclaimer')}</p><label className="field">Research focus<textarea rows={3} value={focus} onChange={e=>setFocus(e.target.value)}/></label><button className="primary" disabled={readOnly||!!busy} onClick={()=>run('research',async()=>{const r=await post<{saved:number,researchRunId:string}>(path+'/problems/'+selected.id+'/research',{focus});await loadProblem(selected.id,false);await refreshResearchActivity();setGraphActivityVersion(v=>v+1);setNotice('Research saved to your workspace · '+r.saved+' findings · run '+r.researchRunId.slice(0,8)+'.')})}><FlaskConical size={16}/> {busy==='research'?'Researching…':'Research with OpenAI'}</button>{readOnly&&<p className="mini">Copy this shared target to conduct your own research.</p>}<div className="divider"/><h3>Saved research for this problem · {selected.researchRuns?.length||0}</h3>{selected.researchRuns?.length?<div className="research-runs">{selected.researchRuns.map(r=><div className="finding" key={r.id}><div className="row"><strong>{r.findingCount} sourced findings</strong><span className="mini">{r.createdAt?.slice(0,16).replace('T',' ')}</span></div><p className="mini">Focus: {r.focus}</p>{!!r.gaps?.length&&<details><summary>Unresolved evidence gaps</summary><ul>{r.gaps.map((gap,i)=><li key={i}>{gap}</li>)}</ul></details>}</div>)}</div>:<p className="empty">No research has been saved for this problem by your account.</p>}<div className="divider"/><h3>Findings · {selected.findings?.filter(f=>f.reviewStatus!=='rejected').length||0}</h3>{selected.findings?.some(f=>f.reviewStatus!=='rejected')?selected.findings.filter(f=>f.reviewStatus!=='rejected').map(f=><div className="finding" key={f.id}><span className="pill">{f.reviewStatus||'needs_review'}</span><p>{f.claim}</p>{f.statistic&&<p><strong>{f.statistic}</strong></p>}{f.limitations&&<small>Limitations: {f.limitations}</small>}{f.url&&<a href={f.url} rel="noreferrer" target="_blank">{f.title||f.url}<ExternalLink size={12}/></a>}{!readOnly&&<div className="button-row"><button className="secondary" disabled={!!busy||f.reviewStatus==='reviewed'} onClick={()=>run('reviewFinding',async()=>{await patch(path+'/findings/'+f.id,{status:'reviewed'});await Promise.all([loadProblem(selected.id,false),refreshResearchActivity()]);setGraphActivityVersion(v=>v+1)})}>Mark source reviewed</button><button className="ghost" disabled={!!busy||f.reviewStatus==='rejected'} onClick={()=>run('rejectFinding',async()=>{await patch(path+'/findings/'+f.id,{status:'rejected'});await Promise.all([loadProblem(selected.id,false),refreshResearchActivity()]);setRejectedVersion(v=>v+1);setGraphActivityVersion(v=>v+1)})}>Reject finding</button></div>}</div>):<p className="empty">No sourced findings yet.</p>}<div className="divider"/><button className="secondary" type="button" onClick={()=>changeTab('generateConcepts',true)}><Sparkles size={15}/> Generate concepts from this problem</button></>:<p className="empty">Select a {getLabel('problem').toLowerCase()} in the graph or research studio.</p>}
     </section></div>
   </FloatingPanel>}
   {panels.generateConcepts.isOpen&&<FloatingPanel id="generateConcepts" title={t('app.generateConcepts')} state={panels.generateConcepts} update={updatePanel} focus={focusPanel}>
    <div className="content wide-content"><section className="panel">{conceptEntry==='studio'&&<><div className="pane-title"><span><Sparkles size={17}/> {t('app.generateConcepts')}</span></div>
    <p className="muted">{t('app.conceptDraftDisclaimer')}</p>{studioPicker('generateConcepts')}</>}
    {selected&&(conceptEntry==='problem'||selected.id===studioPick)?<>
    {conceptEntry==='problem'&&<div className="studio-focus-header"><h3><Sparkles size={17}/> {t('app.generateFromProblem')}</h3></div>}
    <h2 className="studio-origin-title">{selected.description}</h2>
    {conceptEntry==='problem'&&<p className="muted studio-muted">{t('app.conceptDraftDisclaimer')}</p>}
    <div className="divider"/><label className="field">{t('app.designDirection')}<textarea rows={2} value={designDirection} onChange={e=>setDesignDirection(e.target.value)} placeholder="Optional: affordability, low-tech options, dignity, maintenance…"/></label><div className="button-row"><select value={conceptCount} onChange={e=>setConceptCount(Number(e.target.value))}>{[2,3,4,5,6].map(n=><option value={n} key={n}>{n} concepts</option>)}</select><button className="primary" disabled={readOnly||!!busy} onClick={()=>run('generate',async()=>{const r=await post<{concepts:any[]}>(path+'/problems/'+selected.id+'/concepts/generate',{count:conceptCount,direction:designDirection});await loadProblem(selected.id,false);setNotice(r.concepts.length+' drafts generated.')})}><Sparkles size={15}/> Generate draft concepts</button></div><h3>{t('app.generateConcepts')} · {drafts.length} drafts</h3>{drafts.map(d=><div className="finding" key={d.id}><span className="pill">{d.status}</span><label className="field">Concept name<input disabled={d.status==='saved'||readOnly} value={draftEdits[d.id]?.name??d.name} onChange={e=>setDraftEdits(prev=>({...prev,[d.id]:{name:e.target.value,description:prev[d.id]?.description??d.description}}))}/></label><label className="field">Description<textarea rows={3} disabled={d.status==='saved'||readOnly} value={draftEdits[d.id]?.description??d.description} onChange={e=>setDraftEdits(prev=>({...prev,[d.id]:{name:prev[d.id]?.name??d.name,description:e.target.value}}))}/></label><details><summary>Mechanism, risks, and assumptions</summary><p>{d.details?.mechanism}</p><ul>{(d.details?.assumptions||[]).map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></details>{d.status==='rejected'?<p className="mini">This concept is rejected. Restore it from {t('app.rejectedConcepts')} before reopening.</p>:d.status==='saved'&&d.solutionId?<button className="secondary" onClick={()=>run('concept',()=>openConceptWorkspace(d.solutionId!))}>Open saved concept</button>:<button disabled={readOnly||!!busy} className="secondary" onClick={()=>run('saveDraft',async()=>{const created=await post<Sol>(path+'/concept-drafts/'+d.id+'/save',{name:draftEdits[d.id]?.name??d.name,description:draftEdits[d.id]?.description??d.description});markNewConcept(created,selected.id);await loadProblem(selected.id,false);await refreshConcepts();setGraphActivityVersion(v=>v+1);setNotice('Saved as a concept.')})}>{t('app.saveToConcepts')}</button>}</div>)}
    <div className="divider"/><h3>{t('app.savedConcepts')} · {selected.solutions?.length||0}</h3>
    {selected.solutions?.length?selected.solutions.map(s=><button type="button" className="saved-item" key={s.id} onClick={()=>run('concept',()=>openConceptWorkspace(s.id))}>{s.name}<ChevronRight size={15}/></button>):<p className="empty">{t('app.noSavedOrigin')}</p>}
    </>:<p className="empty">{conceptEntry==='studio'?t('app.chooseProblem'):'Open a problem to generate concepts.'}</p>}
    </section></div></FloatingPanel>}
   {panels.rejectedConcepts.isOpen&&<FloatingPanel id="rejectedConcepts" title={t('app.rejectedConcepts')} state={panels.rejectedConcepts} update={updatePanel} focus={focusPanel}>
      <div className="content wide-content"><section className="panel"><h3>{t('app.rejectedConcepts')}</h3>
      <p className="muted">These saved concepts are hidden from active matching, graph counts and concept lists. Restoring keeps prior analysis and originating links.</p>
      {rejectedConcepts.map(s=><div className="finding" key={s.id}><strong>{s.name}</strong><p>{s.description}</p>
        {s.originProblemId!=null&&<small>#{s.originProblemId} · {s.originProblem}</small>}
        {!readOnly&&<button className="secondary" disabled={!!busy} onClick={()=>run('restoreConcept',async()=>{
          await patch(path+'/solutions/'+s.id+'/status',{status:'active'});
          await refreshConcepts();setRejectedConceptVersion(v=>v+1);setGraphActivityVersion(v=>v+1);
          setNotice('Concept restored.');})}>{t('app.restoreConcept')}</button>}
      </div>)}
      {!rejectedConcepts.length&&<p className="empty">No rejected concepts on this page.</p>}
      <div className="button-row"><button className="secondary" disabled={rejectedConceptPage===0} onClick={()=>setRejectedConceptPage(v=>v-1)}>Previous</button>
      <span className="mini">Page {rejectedConceptPage+1}</span><button className="secondary" disabled={rejectedConcepts.length<50} onClick={()=>setRejectedConceptPage(v=>v+1)}>Next</button></div>
      </section></div>
   </FloatingPanel>}
   {panels.rejected.isOpen&&<FloatingPanel id="rejected" title="Rejected findings" state={panels.rejected} update={updatePanel} focus={focusPanel}>
    <div className="content wide-content"><section className="panel"><div className="pane-title"><span><BookOpen size={16}/> Rejected findings</span><span className="pill">{researchActivity?.rejectedCount??0} total</span></div>
     <p className="muted">Rejected findings remain saved for auditability. Restoring a finding returns it to Needs review; it does not verify its claim.</p>
     {rejectedFindings.map(f=><div className="finding" key={f.id}><p><strong>Problem #{f.problemId}:</strong> {f.problem}</p><p>{f.claim}</p>
      {f.url&&<a href={f.url} rel="noreferrer" target="_blank">{f.title||f.url}<ExternalLink size={12}/></a>}
      <div className="button-row">{!readOnly&&<button className="primary" disabled={!!busy} onClick={()=>run('restoreFinding',async()=>{
        await patch(path+'/findings/'+f.id,{status:'needs_review'});await refreshResearchActivity();setRejectedVersion(v=>v+1);setGraphActivityVersion(v=>v+1);
        if(selected?.id===f.problemId)await loadProblem(f.problemId,false);setNotice('Finding returned to Needs review.');
       })}>Restore to Needs review</button>}
       <button className="secondary" onClick={()=>run('problem',async()=>{await loadProblem(f.problemId,false);changeTab('research')})}>Open problem research</button></div></div>)}
     {!rejectedFindings.length&&<p className="empty">No rejected findings in this target for your account.</p>}
     <div className="button-row"><button className="secondary" type="button" disabled={rejectedPage===0} onClick={()=>setRejectedPage(p=>Math.max(0,p-1))}>Previous</button>
      <span className="mini">Page {rejectedPage+1} · {researchActivity?.rejectedCount??0} total</span>
      <button className="secondary" type="button" disabled={(rejectedPage+1)*50>=(researchActivity?.rejectedCount??0)} onClick={()=>setRejectedPage(p=>p+1)}>Next</button></div>
    </section></div></FloatingPanel>}
   {panels.discovery.isOpen&&<FloatingPanel id="discovery" title={t('app.discovery')} state={panels.discovery} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><Sparkles size={17}/> AI {t('app.discovery')}</span></div><p className="muted">{t('app.problemDiscoveryIntro')}</p><label className="field">Research topic<textarea rows={3} value={discoveryTopic} onChange={e=>setDiscoveryTopic(e.target.value)} placeholder="Who is affected, where, and which unmet needs should be explored?"/></label><button className="primary" disabled={!current||readOnly||!!busy||discoveryTopic.length<10} onClick={()=>run('discover',async()=>{const result=await post<{count:number}>(path+'/discoveries/search',{topic:discoveryTopic});await refreshTarget();setNotice(result.count+' candidates discovered for review.')})}><Sparkles size={15}/> {t('app.discoverProblems')}</button><h3>Review queue · {discoveries.length}</h3>{discoveries.length?discoveries.map(d=><div className="finding" key={d.id}><div className="row"><strong>Discovery candidate</strong><span className="pill">{d.status}</span></div>{d.status==='pending_review'&&!readOnly?<label className="field">Edit problem statement<textarea rows={3} value={discoveryEdits[d.id]??d.statement} onChange={e=>setDiscoveryEdits(prev=>({...prev,[d.id]:e.target.value}))}/></label>:<p>{d.statement}</p>}<p className="muted">{d.rationale}</p>{d.evidenceUrls?.map((url:string,i:number)=><a key={i} target="_blank" rel="noreferrer" href={url}>{url}<ExternalLink size={12}/></a>)}{d.status==='pending_review'&&!readOnly&&<div className="button-row"><button className="primary" disabled={!!busy} onClick={()=>run('approve',async()=>{await post(path+'/discoveries/'+d.id+'/approve',{statement:discoveryEdits[d.id]||undefined});await refreshTarget();setNotice('Discovery approved and added to the graph.')})}>Approve problem</button><button className="secondary" disabled={!!busy} onClick={()=>run('reject',async()=>{await post(path+'/discoveries/'+d.id+'/reject');await refreshTarget()})}>Reject</button></div>}</div>):<p className="empty">{t('app.noDiscoveries')}</p>}</section></div></FloatingPanel>}

   {panels.concepts.isOpen&&<FloatingPanel id="concepts" title={t('app.conceptStudio')} state={panels.concepts} update={updatePanel} focus={focusPanel}>
    <div className="solution-layout concept-studio-layout">
      <section className="panel"><div className="pane-title"><span><Lightbulb size={17}/> {t('app.savedConcepts')}</span></div>
        <label className="field">{t('app.studioSearch')}<input value={conceptSearch} onChange={e=>setConceptSearch(e.target.value)} placeholder={t('app.studioSearch')}/></label>
        {sols.filter(s=>[s.name,s.description].some(v=>v.toLowerCase().includes(conceptSearch.toLowerCase()))).map(s=><button className={'saved-item '+(solution?.id===s.id?'active':'')} key={s.id} onClick={()=>run('concept',()=>openConceptWorkspace(s.id,true))}>{s.name}<ChevronRight size={15}/></button>)}
        {!sols.length&&<p className="empty">{t('app.noConcepts')}</p>}
        <button className="ghost small" type="button" onClick={()=>openPanel('rejectedConcepts')}>{t('app.rejectedConcepts')} · {stats.rejectedSolutions??0}</button>
        <details className="concept-create-disclosure"><summary><Plus size={14}/> {t('app.createConcept')}</summary>
          <label className="field">Name<input value={conceptName} onChange={e=>setConceptName(e.target.value)}/></label>
          <label className="field">Description<textarea rows={5} value={conceptDescription} onChange={e=>setConceptDescription(e.target.value)} placeholder={t('app.conceptDescription')}/></label>
          <label className="field">{t('app.originatingProblem')} (optional)<select value={conceptOrigin} onChange={e=>setConceptOrigin(e.target.value)}><option value="">Unlinked concept — keep in Concept Studio</option>{problems.map(p=><option value={p.id} key={p.id}>#{p.id} · {p.description.slice(0,100)}</option>)}</select></label>
          <div className="button-row">
            <button className="primary" disabled={readOnly||!!busy||conceptName.trim().length<3||conceptDescription.trim().length<40} onClick={()=>saveManualConcept(false)}><Plus size={14}/> {t('app.saveConcept')}</button>
            <button className="secondary" disabled={readOnly||!!busy||conceptName.trim().length<3||conceptDescription.trim().length<40} onClick={()=>saveManualConcept(true)}>Save & Match</button>
          </div>
          <p className="mini">Choosing an originating {getLabel('problem').toLowerCase()} links the concept to its source; matching relevance is calculated only when requested.</p>
          <details className="concept-ai-disclosure"><summary><Sparkles size={14}/> {t('app.generateConcepts')}</summary>
            <p className="mini">Generate editable drafts for a selected {getLabel('problem').toLowerCase()} without leaving Concept Studio. Drafts are not saved concepts.</p>
            <label className="field">{t('app.originatingProblem')}<select value={conceptOrigin} onChange={e=>setConceptOrigin(e.target.value)}><option value="">{t('app.chooseProblem')}</option>{problems.map(p=><option value={p.id} key={p.id}>#{p.id} · {p.description.slice(0,100)}</option>)}</select></label>
            <label className="field">{t('app.designDirection')}<textarea rows={2} value={designDirection} onChange={e=>setDesignDirection(e.target.value)} placeholder="Optional: materials, affordability, repairability…"/></label>
            <div className="button-row"><select value={conceptCount} onChange={e=>setConceptCount(Number(e.target.value))}>{[2,3,4,5,6].map(n=><option value={n} key={n}>{n} concepts</option>)}</select>
              <button className="primary" type="button" disabled={readOnly||!!busy||!conceptOrigin} onClick={()=>run('generate',async()=>{
                const originId=Number(conceptOrigin);
                const result=await post<{concepts:ConceptDraft[]}>(path+'/problems/'+originId+'/concepts/generate',{count:conceptCount,direction:designDirection});
                await loadProblem(originId,false);setNotice(result.concepts.length+' draft concepts generated.');
              })}><Sparkles size={14}/> Generate draft concepts</button></div>
            {selected&&selected.id===Number(conceptOrigin)&&drafts.map(d=><div className="finding" key={d.id}>
              <span className="pill">{d.status}</span>
              <label className="field">Concept name<input value={draftEdits[d.id]?.name??d.name} disabled={d.status!=='draft'||readOnly} onChange={e=>setDraftEdits(prev=>({...prev,[d.id]:{name:e.target.value,description:prev[d.id]?.description??d.description}}))}/></label>
              <label className="field">Description<textarea rows={3} value={draftEdits[d.id]?.description??d.description} disabled={d.status!=='draft'||readOnly} onChange={e=>setDraftEdits(prev=>({...prev,[d.id]:{name:prev[d.id]?.name??d.name,description:e.target.value}}))}/></label>
              <details><summary>Mechanism, risks, and assumptions</summary><p>{d.details?.mechanism}</p><ul>{(d.details?.assumptions||[]).map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></details>
              {d.status==='saved'&&d.solutionId?<button className="secondary" onClick={()=>run('concept',()=>openConceptWorkspace(d.solutionId!,true))}>Open saved concept</button>:
                d.status==='draft'?<button className="secondary" disabled={readOnly||!!busy} onClick={()=>run('saveDraft',async()=>{
                  const originId=Number(conceptOrigin);
                  const created=await post<Sol>(path+'/concept-drafts/'+d.id+'/save',{name:draftEdits[d.id]?.name??d.name,description:draftEdits[d.id]?.description??d.description});
                  markNewConcept(created,originId);await loadProblem(originId,false);await refreshConcepts();await loadSolution(created.id,false);
                  setGraphActivityVersion(v=>v+1);setNotice('Saved concept from draft.');
                })}>{t('app.saveToConcepts')}</button>:<p className="mini">Rejected draft cannot be saved.</p>}
            </div>)}
          </details>
        </details>
      </section>
      <section className="panel concept-studio-workspace"><div className="pane-title"><span><Lightbulb size={17}/> {t('app.conceptWorkspace')}</span></div>
        {solution?<ConceptWorkspaceDetails concept={solution} matchingLabel={t('app.matching')} analysisLabel={t('app.analysis')} rejectLabel={t('app.rejectConcept')}
          onMatching={()=>changeTab('matching')} onAnalysis={()=>changeTab('evaluation',true)}
          onReject={!readOnly?()=>rejectSelectedConcept():undefined}/>
          :<p className="empty">Select a saved concept to work on its matching and evaluation.</p>}
      </section>
    </div>
   </FloatingPanel>}
   {panels.matching.isOpen&&<FloatingPanel id="matching" title={t('app.conceptMatching')} state={panels.matching} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><Network size={17}/> {t('app.matching')}</span></div><label className="field">Selected concept<select value={solution?.id||''} onChange={e=>{if(e.target.value)run('concept',()=>loadSolution(e.target.value,false))}}><option value="">Choose a concept</option>{sols.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>{solution?<><h2>{solution.name}</h2><p className="muted">{solution.description}</p><button className="primary" disabled={readOnly||!!busy} onClick={()=>run('match',async()=>{const result=await post<{matches:any[]}>(path+'/solutions/'+solution.id+'/match');await loadSolution(solution.id,false);setNotice(result.matches.length+' potential matches generated.')})}><Network size={15}/> Match to target problems</button><h3>Potential problem matches</h3>{solution.matches?.length?solution.matches.map(m=><div className="match" key={m.problemId}><div className="row"><strong>#{m.problemId}: {m.description}</strong><span className="score">{m.relevance}% relevance</span></div><p>{m.rationale}</p><small>{m.relationship} · {m.confidence} confidence · not proven impact</small><button className="text-link" onClick={()=>run('problem',()=>loadProblem(m.problemId))}>Inspect problem →</button></div>):<p className="empty">Run matching to identify possible relationships. Matching is not proof of effectiveness.</p>}</>:<p className="empty">{t('app.noCurrentConcept')}</p>}</section></div></FloatingPanel>}

   {panels.evaluation.isOpen&&<FloatingPanel id="evaluation" title={t('app.evaluation')} state={panels.evaluation} update={updatePanel} focus={focusPanel}>
     <div className="content wide-content"><section className="panel">
       {evaluationEntry==='studio'&&<div className="pane-title"><span><BarChart3 size={17}/> {t('app.analysis')}</span></div>}
       {evaluationEntry==='studio'&&<label className="field">Selected concept<select value={solution?.id||''} onChange={e=>{if(e.target.value)run('concept',()=>loadSolution(e.target.value,false))}}>
         <option value="">Choose a concept</option>{sols.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
       </select></label>}
       {solution?<>
         <h2>{solution.name}</h2><p className="muted">{solution.matches?.length||0} saved problem matches in this target</p>
         <div className="eval-mode-group"><label htmlFor="evaluation-mode">Evaluation method</label>
           <select id="evaluation-mode" value={evaluationMode} onChange={e=>setEvaluationMode(e.target.value as 'evidence'|'exploratory')}>
             <option value="evidence">Evidence-based · cautious</option>
             <option value="exploratory">Exploratory · provisional estimates</option>
           </select>
         </div>
         <p className="eval-integrity-note">{evaluationMode==='evidence'
          ?'Only factors supported by research receive ratings. Missing data stays unrated.'
          :'Provisional scores can be inferred from explicitly stated assumptions. They are hypotheses, not empirical measurements.'}</p>
         <EvaluationQueue key={solution.id} targetId={current!.id} solutionId={solution.id} mode={evaluationMode} readOnly={readOnly}
           onSaved={async()=>{await loadSolution(solution.id,false);setNotice('Multi-agent evaluation saved.')}}/>
         {evaluation?<>
           <h3>Saved evaluation · {evaluation.mode==='exploratory'?'Exploratory estimates':evaluation.mode==='evidence'?'Evidence-based assessment':'Legacy provisional assessment · methodology unverified'}</h3>
           <p className="muted">{evaluation.summary}</p>
           {evaluation.methodVersion&&<p className="mini">Method: {evaluation.methodVersion} · Independent quantitative and qualitative analyses</p>}
           {!!evaluation.reconciliation?.flagged?.length&&<details className="eval-integrity-note"><summary>Evidence reconciliation · {evaluation.reconciliation.flagged.length} items need attention</summary><ul>{evaluation.reconciliation.flagged.map((issue,i)=><li key={i}>{issue}</li>)}</ul></details>}
           <label className="eval-mode-group"><input type="checkbox" style={{width:'auto'}}
             checked={showSocial} disabled={!socialData?.factors.some(f=>f.sourceCount>0)}
             onChange={e=>setShowSocial(e.target.checked)}/> Show separate social sentiment layer</label>
           {!socialData?.factors.some(f=>f.sourceCount>0)&&<p className="mini">No reviewed, factor-specific social discussion observations exist for this concept's matched problems. Sources must be entered and approved by an administrator.</p>}
           <div className="evalchart"><React.Suspense fallback={<p className="muted">Loading assessment chart…</p>}>
             <EvaluationRadar factors={evaluation.factors} theme={theme} exploratory={evaluation.mode!=='evidence'}
               scoreMax={evaluation.scoreMax||5} socialFactors={showSocial?socialData?.factors:undefined}/>
           </React.Suspense></div>
           {showSocial&&socialData&&<div className="eval-integrity-note"><strong>Separate social discussion overview</strong><p>{socialData.summary}</p>
             {socialData.sources.map((source,i)=><p key={`${source.url}-${i}`}><strong>{source.factor}</strong> · <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.summary}</p>)}
           </div>}
           <div className="factor-grid">{evaluation.factors.map(f=><div className="factor" key={f.factor}>
             <div className="row"><strong>{f.factor}</strong><span className="score">{f.score===null?'Unrated':tenPoint(f.score,evaluation.scoreMax||5)?.toFixed(1)+'/10'}</span></div>
             <p className="eval-basis">{f.basis==='inference'?'Inferred estimate':f.basis==='evidence'?'Evidence-supported':'Evidence unknown'}</p>
             <p>{f.rationale}</p><small>{f.confidence} confidence</small>
             {showSocial&&socialData?.factors.filter(s=>s.factor===f.factor&&s.sourceCount>0).map(signal=><div className="eval-integrity-note" key={signal.factor}><strong>Social discussion · {signal.score}/10</strong><p>{signal.summary||'Reported discussion signal; not empirical validation.'} · {signal.sourceCount} source observations</p></div>)}
             {!!f.assumptions?.length&&<details><summary>Assumptions</summary>{f.assumptions.map((x,i)=><p key={i}>{x}</p>)}</details>}
             {!!f.evidence_urls?.length&&<details><summary>Referenced research</summary>{f.evidence_urls.map((url,i)=><p key={i}><a href={url} rel="noopener noreferrer" target="_blank">{url}</a></p>)}</details>}
             <details><summary>Open questions</summary>{f.unanswered_questions.map((x,i)=><p key={i}>{x}</p>)}</details>
           </div>)}</div>
           <h3>Risks</h3><ul>{evaluation.risks.map((x,i)=><li key={i}>{x}</li>)}</ul>
           <h3>Next research</h3><ul>{evaluation.next_research.map((x,i)=><li key={i}>{x}</li>)}</ul>
         </>:<p className="empty">No evaluation yet. Exploratory estimates are provisional; insufficient evidence is never silently scored as zero.</p>}
       </>:<p className="empty">Choose a saved concept to analyze.</p>}
     </section></div>
   </FloatingPanel>}
   {panels.manage.isOpen&&<FloatingPanel id="manage" title={t('app.researchStructure')} state={panels.manage} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><Settings2 size={17}/> {t('app.targetHierarchy')}</span><span className="pill">{readOnly?'Read-only':'Editable'}</span></div><p className="muted">{t('app.hierarchyIntro')}</p><div className="hierarchy-columns"><div><h3>{t('app.researchStreams')}</h3>{streams.map(s=><button className={'saved-item '+(selectedStream===s.id?'active':'')} key={s.id} onClick={()=>{setSelectedStream(s.id);setSeedPreview(null);setSelectedCategory('')}}>{s.name}<ChevronRight size={14}/></button>)}{!readOnly&&<div className="quick-add"><input value={newStream} placeholder={t('app.newStreamPlaceholder')} onChange={e=>setNewStream(e.target.value)}/><button className="secondary" disabled={!current||!!busy||newStream.length<3} onClick={()=>run('addStream',async()=>{await post(path+'/streams',{name:newStream,description:''});setNewStream('');await refreshTarget()})}>Add</button></div>}</div><div><h3>{t('app.categories')}</h3>{hierarchy.filter(h=>h.streamId===selectedStream&&h.categoryId).map(h=><button key={h.categoryId} className={'saved-item '+(selectedCategory===h.categoryId?'active':'')} onClick={()=>setSelectedCategory(h.categoryId!)}>{h.category} <span className="mini">{h.count}</span></button>)}{!readOnly&&selectedStream&&<div className="quick-add"><input value={newCategory} placeholder={t('app.newCategoryPlaceholder')} onChange={e=>setNewCategory(e.target.value)}/><button className="secondary" disabled={!!busy||newCategory.length<3} onClick={()=>run('addCategory',async()=>{await post(path+'/streams/'+selectedStream+'/categories',{name:newCategory});setNewCategory('');await refreshTarget()})}>Add</button></div>}</div></div>{selectedCategory&&<><h3>{getLabel('problem','plural')} in selected {getLabel('category').toLowerCase()}</h3>{problems.filter(p=>p.categoryId===selectedCategory).map(p=><div className="target-row" key={p.id}><div><strong>#{p.id}</strong><p>{p.description}</p></div><div className="button-row"><button className="secondary" onClick={()=>run('problem',()=>loadProblem(p.id))}>Open</button>{!readOnly&&<><button className="ghost small" onClick={()=>{const statement=window.prompt('Edit problem statement',p.description);if(!statement||statement.trim().length<20)return;run('editProblem',async()=>{await patch(path+'/problems/'+p.id,{statement});await refreshTarget()})}}>Edit</button><button className="ghost small danger" onClick={()=>{if(!window.confirm('Delete this problem?'))return;run('deleteProblem',async()=>{await del(path+'/problems/'+p.id);await refreshTarget()})}}>Delete</button></>}</div></div>)}{!readOnly&&<div className="quick-add"><textarea value={newProblem} rows={3} placeholder={t('app.problemStatementPlaceholder')} onChange={e=>setNewProblem(e.target.value)}/><button className="primary" disabled={!!busy||newProblem.length<20} onClick={()=>run('addProblem',async()=>{await post(path+'/categories/'+encodeURIComponent(selectedCategory)+'/problems',{statement:newProblem});setNewProblem('');await refreshTarget()})}>Add problem</button></div>}</>}
   {!readOnly&&selectedStream&&<div className="button-row"><button className="ghost small" onClick={()=>{const found=streams.find(s=>s.id===selectedStream);if(!found)return;const name=window.prompt('Rename stream',found.name);if(!name||name.trim().length<3)return;run('renameStream',async()=>{await patch(path+'/streams/'+selectedStream,{name,description:found.description||''});await refreshTarget()})}}>Rename stream</button><button className="ghost small danger" onClick={()=>{if(!window.confirm('Delete stream and its categories and problems?'))return;run('deleteStream',async()=>{await del(path+'/streams/'+selectedStream);setSelectedStream('');setSelectedCategory('');await refreshTarget()})}}>Delete stream</button></div>}
   {!readOnly&&selectedCategory&&<div className="button-row"><button className="ghost small" onClick={()=>{const category=hierarchy.find(h=>h.categoryId===selectedCategory);const name=window.prompt('Rename category',category?.category||'');if(!name||name.trim().length<3)return;run('renameCategory',async()=>{await patch(path+'/categories/'+encodeURIComponent(selectedCategory),{name});await refreshTarget()})}}>Rename category</button><button className="ghost small danger" onClick={()=>{if(!window.confirm('Delete this category and all problems within it?'))return;run('deleteCategory',async()=>{await del(path+'/categories/'+encodeURIComponent(selectedCategory));setSelectedCategory('');await refreshTarget()})}}>Delete category</button></div>}
   {!readOnly&&selectedStream&&<div className="divider"/>}{!readOnly&&selectedStream&&<><h3>AI-generated {getLabel('taxonomy')}</h3><p className="muted">Create editable draft categories and problem hypotheses for this stream. These are not verified evidence.</p><div className="button-row"><select value={seedDetail} onChange={e=>setSeedDetail(e.target.value)}><option value="outline">Outline · 3 categories</option><option value="standard">Standard · 5 categories / 3 problems each</option><option value="detailed">Detailed · 7 categories / 6 problems each</option></select><button className="secondary" disabled={!!busy} onClick={()=>run('previewSeed',async()=>{const r=await post<{categories:SeedCategory[]}>(path+'/streams/'+selectedStream+'/seed-preview',{detail:seedDetail});setSeedPreview(r.categories)})}><Sparkles size={15}/> Generate draft</button></div>{seedPreview&&<div className="seed-preview"><h3>Review before saving</h3>{seedPreview.map((c,i)=><div className="finding" key={i}><label className="field">Category<input value={c.name} onChange={e=>setSeedPreview(old=>old?.map((x,j)=>i===j?{...x,name:e.target.value}:x)||null)}/></label>{c.problems.map((p,j)=><label className="field" key={j}>Problem hypothesis<textarea rows={2} value={p} onChange={e=>setSeedPreview(old=>old?.map((x,k)=>k===i?{...x,problems:x.problems.map((v,n)=>n===j?e.target.value:v)}:x)||null)}/></label>)}</div>)}<div className="button-row"><button className="primary" disabled={!!busy} onClick={()=>run('saveSeed',async()=>{const r=await post<{categories:any[]}>(path+'/streams/'+selectedStream+'/taxonomy',{categories:seedPreview});setSeedPreview(null);await refreshTarget();setNotice(r.categories.length+' draft categories saved.')})}>Save reviewed taxonomy</button><button className="ghost" onClick={()=>setSeedPreview(null)}>Discard draft</button></div></div>}</>}</section></div></FloatingPanel>}
  </div>
   {conceptModalOpen&&solution&&<ConceptWorkspaceModal
     key={solution.id} concept={solution} label={t('app.conceptWorkspace')}
     matchingLabel={t('app.matching')} analysisLabel={t('app.analysis')} rejectLabel={t('app.rejectConcept')}
     onClose={()=>setConceptModalOpen(false)}
     onMatching={()=>{setConceptModalOpen(false);changeTab('matching')}}
     onAnalysis={()=>{setConceptModalOpen(false);changeTab('evaluation',true)}}
     onReject={!readOnly?()=>run('rejectConcept',async()=>{
       await patch(path+'/solutions/'+solution.id+'/status',{status:'rejected'});
       setConceptModalOpen(false);setSolution(null);setEvaluation(null);
       await refreshConcepts();if(selected)await loadProblem(selected.id,false);
       setGraphActivityVersion(v=>v+1);setRejectedConceptVersion(v=>v+1);setNotice('Concept moved to rejected concepts.');
     }):undefined}
   />}
  {problemModalOpen&&selected&&<div className="context-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setProblemModalOpen(false)}}>
    <section className="context-modal" role="dialog" aria-modal="true" aria-label="Problem detail">
      <div className="context-modal-heading"><div className="eyebrow">PROBLEM #{selected.id} · {selected.stream} / {selected.category}</div>
        <button className="ghost small" onClick={()=>setProblemModalOpen(false)} aria-label="Close problem details">Close</button></div>
      <h2>{selected.description}</h2>
      <p className="muted">{selected.researchRuns?.length||0} saved research sessions · {selected.findings?.length||0} sourced findings · {selected.solutions?.length||0} linked saved concepts · {drafts.length} concept drafts</p>
      <div className="context-modal-actions">
        <button className="primary" onClick={()=>{setProblemModalOpen(false);changeTab('research',true)}}><BookOpen size={15}/> Research & evidence</button>
        <button className="secondary" onClick={()=>{setProblemModalOpen(false);changeTab('generateConcepts',true)}}><Lightbulb size={15}/> Concepts</button>
        <button className="ghost" onClick={()=>{setProblemModalOpen(false);changeTab('problems')}}>Problem library</button>
      </div>
      {!!selected.solutions?.length&&<div className="modal-findings"><h3>Saved concepts · {selected.solutions.length}</h3>
       {selected.solutions.map(s=><button type="button" className="saved-item" key={s.id} onClick={()=>run('concept',()=>openConceptWorkspace(s.id))}>{s.name}<ChevronRight size={14}/></button>)}</div>}
      {!!selected.findings?.length&&<div className="modal-findings"><h3>Recent evidence</h3>{selected.findings.filter(item=>item.reviewStatus!=='rejected').slice(0,4).map(item=><div className="finding" key={item.id}><small>{item.reviewStatus||'needs_review'}</small><p>{item.claim}</p>{item.url&&<a href={item.url} target="_blank" rel="noreferrer">{item.title||'View source'} <ExternalLink size={13}/></a>}</div>)}</div>}
      {readOnly&&<p className="mini">Shared targets are read-only. Copy the target into your workspace to edit or run AI research.</p>}
    </section>
  </div>}
  {wizard&&<NewTargetWizard onClose={()=>{setWizard(false);if(!current)changeTab('directory')}}
    featuredTarget={directory.shared.find(target=>target.id===directory.defaultTargetId)}
    onOpenFeatured={async(target)=>{await selectTarget(target)}}
    onCreated={async(t)=>{await reloadDirectory();await selectTarget(t,true)}}
    onOpenGraph={()=>{setWizard(false);void refreshTarget();changeTab('graph')}}/>}

  {editTarget&&current&&<div className="wizard-backdrop" role="dialog" aria-modal="true" aria-label="Edit target"><div className="wizard-card"><h2>{t('app.editTarget')}</h2><label className="field">Name<input value={editingName} onChange={e=>setEditingName(e.target.value)}/></label><label className="field">Scope<textarea rows={4} value={editingDesc} onChange={e=>setEditingDesc(e.target.value)}/></label><label className="field"><input type="checkbox" checked={editingShared} onChange={e=>setEditingShared(e.target.checked)} style={{display:'inline-block',width:'auto',marginRight:10}}/>Allow others to view or copy this target</label><div className="wizard-actions"><button className="ghost" onClick={()=>setEditTarget(false)}>Cancel</button><button className="primary" disabled={!!busy||editingName.length<3} onClick={saveSettings}>Save changes</button><button className="ghost danger" onClick={()=>{if(!window.confirm('Permanently delete this target and all its research, concepts and data?'))return;run('deleteTarget',async()=>{await del(path);setCurrent(null);setEditTarget(false);const d=await reloadDirectory();if(d.mine.length)await selectTarget(d.mine[0]);else{setWizard(true);changeTab('graph')}})}}><Trash2 size={14}/> {t('app.deleteTarget')}</button></div></div></div>}
 </div>;
}

createRoot(document.getElementById('root')!).render(<Root/>);
