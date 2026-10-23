import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Radar,RadarChart,PolarGrid,PolarAngleAxis,ResponsiveContainer,Tooltip} from 'recharts';
import {Network,Search,BookOpen,Lightbulb,BarChart3,ChevronRight,RefreshCw,ExternalLink,Plus,ArrowLeft,FlaskConical,Sparkles,FolderPlus,Trash2,Share2,Lock,Settings2,PanelsTopLeft,Sun,Moon,RotateCcw} from 'lucide-react';
import NetworkCanvas from './NetworkCanvas';
import FloatingPanel, {viewportLayouts, type PanelId, type PanelLayout, type PanelLayouts} from './FloatingPanel';
import './style.css';

type Problem={id:number,description:string,streamId?:string,stream?:string,category:string,categoryId?:string,findings?:Finding[],researchRuns?:any[],solutions?:any[]};
type Finding={id:string,claim:string,title:string,url:string,confidence:string,limitations:string,reviewStatus:string,statistic:string};
type ConceptDraft={id:string,name:string,description:string,status:string,solutionId?:string|null,details:any};
type Sol={id:string,name:string,description:string,matches?:Match[],evaluations?:{id:string,payload:string}[]};
type Match={problemId:number,description:string,relationship:string,relevance:number,rationale:string,confidence:string};
type Factor={factor:string,score:number|null,confidence:string,rationale:string,evidence_urls:string[],unanswered_questions:string[]};
type Eval={summary:string,factors:Factor[],key_assumptions:string[],risks:string[],next_research:string[]};
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

function AdminConsole(){
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
 </section>;
}

// v0.7: one target-scoped workspace, shared by graph, discovery, evidence and concepts.
type Target={id:string,name:string,description:string,ownerId:string,shared:boolean,reference?:boolean};
type Directory={mine:Target[],shared:Target[]};
type NavTab='graph'|'directory'|'problems'|'research'|'discovery'|'concepts'|'matching'|'evaluation'|'manage'|'admin';
type Scope={streamId:string,stream:string,categoryId:string|null,category:string|null,count:number};
type SeedCategory={name:string,problems:string[]};
type StreamSuggestion={name:string,description:string,selected:boolean};
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
 return <IntegratedWorkspace account={account} onLogout={async()=>{await post('/auth/logout');setAccount(null)}}/>;
}

function IntegratedWorkspace({account,onLogout}:{account:Account,onLogout:()=>Promise<void>}){
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
 useEffect(()=>{
   if(!problemModalOpen)return;
   const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setProblemModalOpen(false)};
   document.addEventListener('keydown',close);
   return()=>document.removeEventListener('keydown',close);
 },[problemModalOpen]);
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
 const [stats,setStats]=useState<any>({streams:0,categories:0,problems:0,solutions:0});
 const [streams,setStreams]=useState<{id:string,name:string,description:string}[]>([]);
 const [hierarchy,setHierarchy]=useState<Scope[]>([]);
 const [problems,setProblems]=useState<Problem[]>([]);
 const [sols,setSols]=useState<Sol[]>([]);
 const [discoveries,setDiscoveries]=useState<any[]>([]);
 const [selected,setSelected]=useState<Problem|null>(null);
 const [drafts,setDrafts]=useState<Draft[]>([]); const [draftEdits,setDraftEdits]=useState<Record<string,{name:string,description:string}>>({});
 const [solution,setSolution]=useState<Sol|null>(null);
 const [evaluation,setEvaluation]=useState<Eval|null>(null);
 const [searchText,setSearchText]=useState('');const [searchMode,setSearchMode]=useState('exact');const [searchResults,setSearchResults]=useState<any[]|null>(null);
 const [focus,setFocus]=useState('prevalence, affected populations, existing responses, limitations and gaps');
 const [designDirection,setDesignDirection]=useState(''); const [conceptCount,setConceptCount]=useState(4);
 const [conceptName,setConceptName]=useState('');const [conceptDescription,setConceptDescription]=useState('');
 const [discoveryTopic,setDiscoveryTopic]=useState(''); const [discoveryEdits,setDiscoveryEdits]=useState<Record<string,string>>({});
 const [selectedStream,setSelectedStream]=useState('');const [selectedCategory,setSelectedCategory]=useState('');
 const [newStream,setNewStream]=useState('');const [newCategory,setNewCategory]=useState('');const [newProblem,setNewProblem]=useState('');
 const [seedDetail,setSeedDetail]=useState('standard');const [seedPreview,setSeedPreview]=useState<SeedCategory[]|null>(null);
 const [wizardName,setWizardName]=useState('');const [wizardScope,setWizardScope]=useState('');const [wizardDetail,setWizardDetail]=useState('standard');const [wizardShared,setWizardShared]=useState(false);
 const [suggestions,setSuggestions]=useState<StreamSuggestion[]>([]);const [manualSuggestion,setManualSuggestion]=useState('');
 const [editTarget,setEditTarget]=useState(false);const [editingName,setEditingName]=useState('');const [editingDesc,setEditingDesc]=useState('');const [editingShared,setEditingShared]=useState(false);
 const readOnly=!!current && current.ownerId!==account.id;
 const path=current?targetUrl(current.id):'';
 const run=async(label:string,fn:()=>Promise<void>)=>{
   setBusy(label);setError('');setNotice('');
   try{await fn()}catch(e:any){setError(e.message||'Unexpected error')}finally{setBusy('')}
 };
 const reloadDirectory=async()=>{const d=await api<Directory>('/targets');setDirectory(d);return d};
 const loadData=async(tid:string)=>{
   const p=targetUrl(tid);
   const [s,h,pr,sol,disc,metrics]=await Promise.all([
     api<typeof streams>(p+'/streams'),api<Scope[]>(p+'/hierarchy'),api<Problem[]>(p+'/problems?limit=1000'),
     api<Sol[]>(p+'/solutions'),api<any[]>(p+'/discoveries'),api<any>(p+'/stats')]);
   setStreams(s);setHierarchy(h);setProblems(pr);setSols(sol);setDiscoveries(disc);setStats(metrics);
   setSelectedStream(v=>s.some(x=>x.id===v)?v:s[0]?.id||'');
   setSelectedCategory(v=>h.some(x=>x.categoryId===v)?v:h.find(x=>x.categoryId)?.categoryId||'');
 };
 const selectTarget=async(t:Target)=>{
   setCurrent(t);setSelected(null);setProblemModalOpen(false);setDrafts([]);setSolution(null);setEvaluation(null);setSearchResults(null);setSeedPreview(null);changeTab('graph');setWizard(false);
   await loadData(t.id);setVersion(v=>v+1);
 };
 const refreshTarget=async()=>{if(current){await loadData(current.id);setVersion(v=>v+1)}};
 useEffect(()=>{
   reloadDirectory().then(d=>{
     if(d.mine.length)selectTarget(d.mine[0]).catch((e:any)=>setError(e.message));
     else setWizard(true);
   }).catch((e:any)=>setError(e.message));
 },[]);
 const onProblemNodeSelect=(recordId:number)=>run('problem',async()=>{
   await loadProblem(recordId,false);
   setProblemModalOpen(true);
 });
 const loadProblem=async(id:number,go=true)=>{
   if(!current)return;
   const [p,d]=await Promise.all([api<Problem>(path+'/problems/'+id),api<Draft[]>(path+'/problems/'+id+'/concepts')]);
   setSelected(p);setDrafts(d);if(go)changeTab('research');
 };
 const loadSolution=async(id:string,go=true)=>{
   if(!current)return;
   const s=await api<Sol>(path+'/solutions/'+id);
   setSolution(s);
   try{setEvaluation(s.evaluations?.[0]?.payload?JSON.parse(s.evaluations[0].payload):null)}catch{setEvaluation(null)}
   if(go)changeTab('matching');
 };
 const newTarget=()=>{setWizardName('');setWizardScope('');setWizardDetail('standard');setWizardShared(false);setSuggestions([]);setWizard(true)};
 const createTarget=()=>run('saveTarget',async()=>{
   const selectedStreams=suggestions.filter(x=>x.selected&&x.name.trim().length>=3).map(x=>({name:x.name.trim(),description:x.description.trim()}));
   if(!selectedStreams.length)throw new Error('Select or add at least one research stream to populate the new graph.');
   const created=await post<Target>('/targets/with-streams',{name:wizardName,description:wizardScope,shared:wizardShared,streams:selectedStreams});
   await reloadDirectory();await selectTarget(created);setNotice('Target created with '+selectedStreams.length+' initial streams.');
 });
 const copyTarget=(t:Target)=>run('copyTarget',async()=>{
   const copy=await post<Target & {streamCount:number,problemCount:number}>(targetUrl(t.id)+'/copy');
   await reloadDirectory();await selectTarget(copy);setNotice('Editable copy created: '+copy.streamCount+' streams and '+copy.problemCount+' problems.');
 });
 const changeTab=(value:NavTab)=>{setTab(value);openPanel(value==='graph'?'overview':value);setError('');setNotice('')};
 const nav:{id:NavTab,label:string,icon:React.ReactNode}[]=[
   {id:'graph',label:'Explore graph',icon:<Network size={16}/>},
   {id:'problems',label:'Problem library',icon:<Search size={16}/>},
   {id:'research',label:'Research & findings',icon:<BookOpen size={16}/>},
   {id:'discovery',label:'Problem discovery',icon:<Sparkles size={16}/>},
   {id:'concepts',label:'Concepts',icon:<Lightbulb size={16}/>},
   {id:'matching',label:'Problem matching',icon:<Network size={16}/>},
   {id:'evaluation',label:'Concept analysis',icon:<BarChart3 size={16}/>},
   {id:'manage',label:'Manage hierarchy',icon:<Settings2 size={16}/>},
   {id:'directory',label:'Shared target directory',icon:<BookOpen size={16}/>}
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
 const renderProblemList=(items:Problem[])=>items.length?<div className="problem-list-v07">{items.map(p=><button className="problem-item" key={p.id} onClick={()=>run('problem',()=>loadProblem(p.id))}><span className="num">#{p.id}</span><span>{p.description}<small>{p.stream} · {p.category}</small></span><ChevronRight size={14}/></button>)}</div>:<p className="empty">No problems in this target yet. Generate a taxonomy, or add problems under Manage hierarchy.</p>;

 return <div className={`app workspace-v08 theme-${theme}`}>
  <NetworkCanvas targetId={current?.id||null} refreshKey={version} theme={theme} onProblemNodeSelect={onProblemNodeSelect}/>
  <div className="workspace-toolbar">
    <div className="toolbar-brand"><Network size={19}/><strong>PROBLEM EXPLORER</strong><span className="toolbar-separator"/>
      <span className="toolbar-target" title={current?.description||'No target selected'}>{current?.name||'No active target'}</span>
      {readOnly&&<span className="toolbar-badge">READ ONLY</span>}</div>
    <div className="toolbar-actions">
      <button type="button" onClick={()=>openPanel('navigation')} title="Open navigation"><PanelsTopLeft size={16}/> <span>Workspaces</span></button>
      <button type="button" onClick={()=>openPanel('overview')} title="Open target overview"><BookOpen size={16}/> <span>Overview</span></button>
      <button type="button" onClick={()=>setPanels(viewportLayouts())} title="Restore panel positions"><RotateCcw size={15}/></button>
      <button type="button" onClick={switchTheme} title={theme==='dark'?'Switch to light mode':'Switch to dark mode'}
        aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>
    </div>
  </div>
  {(error||notice)&&<div className={'workspace-toast '+(error?'is-error':'')} role={error?'alert':'status'}>
    <span>{error||notice}</span><button type="button" onClick={()=>{setError('');setNotice('')}} aria-label="Dismiss notification">×</button>
  </div>}
  <div className="windows-layer">
   <FloatingPanel id="navigation" title="Navigation" state={panels.navigation} update={updatePanel} focus={focusPanel}>
  <aside className="sidebar target-sidebar-v07">
   <div className="brand"><div className="brandmark"><Network size={21}/></div><div><strong>PROBLEM <b>EXPLORER</b></strong><small>RESEARCH WORKSPACE · v0.8</small></div></div>
   <div className="side-heading">ACTIVE TARGET</div>
   <select className="target-switch" value={current?.id||''} onChange={e=>choose(e.target.value)} aria-label="Select active research target">
    <option value="" disabled>Select a target</option>
    {directory.mine.length>0&&<optgroup label="My targets">{directory.mine.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>}
    {directory.shared.length>0&&<optgroup label="Shared targets">{directory.shared.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>}
   </select>
   <button className="nav" onClick={newTarget}><Plus size={16}/> Create target</button>
   <div className="side-heading" style={{marginTop:20}}>WORKSPACE</div>
   {nav.map(item=><button className={'nav '+(tab===item.id?'on':'')} key={item.id} onClick={()=>changeTab(item.id)}>{item.icon}{item.label}</button>)}
   {account.role==='admin'&&<><div className="side-heading" style={{marginTop:18}}>PLATFORM</div><button className={'nav '+(tab==='admin'?'on':'')} onClick={()=>changeTab('admin')}><Settings2 size={16}/> Administration</button></>}
   <div className="side-bottom"><div>{account.name}</div><div>{account.email}</div><button className="text-link" onClick={onLogout}>Sign out</button></div>
  </aside>
   </FloatingPanel>
   <FloatingPanel id="overview" title="Target overview" state={panels.overview} update={updatePanel} focus={focusPanel}>
    <main className="main target-main-v07">
   <header className="topbar"><div><div className="eyebrow">{current?(readOnly?'SHARED · READ ONLY':'PRIVATE WORKSPACE'):'YOUR WORKSPACE'}</div><h1>{tab==='admin'?'Administration':current?.name||'Explore a new research target'}</h1><p>{current?.description||'Create a target to begin research, or open the shared target library.'}</p></div><div className="top-actions">{current&&readOnly&&<button className="primary" disabled={!!busy} onClick={()=>copyTarget(current)}><Plus size={15}/> Copy to workspace</button>}{current&&!readOnly&&<button className="ghost small" onClick={startEdit}>Edit target</button>}<span className="status"><span className="dot"/> {busy?'Working…':'Workspace ready'}</span></div></header>
   {error&&<div className="alert bad" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
   {notice&&<div className="alert good" role="status">{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}
   {current&&<div className="metrics"><div><strong>{stats.streams}</strong><small>Research streams</small></div><div><strong>{stats.categories}</strong><small>Categories</small></div><div><strong>{stats.problems}</strong><small>Problems</small></div><div><strong>{stats.solutions}</strong><small>Saved concepts</small></div></div>}

<section className="list-panel overview-list"><div className="pane-title"><span><BookOpen size={16}/> Target problems</span><span className="mini">{problems.length} records</span></div><label className="searchbox"><Search size={16}/><input value={searchText} placeholder="Filter problems…" onChange={e=>setSearchText(e.target.value)}/></label>{renderProblemList(problems.filter(p=>p.description.toLowerCase().includes(searchText.toLowerCase())).slice(0,250))}</section>
    </main>
   </FloatingPanel>
   {panels.directory.isOpen&&<FloatingPanel id="directory" title="Target directory" state={panels.directory} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><BookOpen size={18}/> Target directory</span><button className="primary" onClick={newTarget}><Plus size={14}/> Create target</button></div><p className="muted">Shared targets open in read-only mode. Make a private editable copy to conduct research and generate concepts independently.</p><h3>My targets</h3>{directory.mine.length?directory.mine.map(t=><div className="target-row" key={t.id}><div><strong>{t.name}</strong><p>{t.description||'No description'}</p></div><button className="secondary" onClick={()=>run('open',()=>selectTarget(t))}>Open</button></div>):<p className="empty">You have not created a target yet.</p>}
   <h3>Shared targets</h3>{directory.shared.map(t=><div className="target-row" key={t.id}><div><strong>{t.name}</strong><p>{t.description||'Shared research'}</p></div><div className="button-row"><button className="secondary" onClick={()=>run('open',()=>selectTarget(t))}>Explore</button><button className="primary" onClick={()=>copyTarget(t)} disabled={!!busy}>Copy to workspace</button></div></div>)}</section></div></FloatingPanel>}

   {panels.admin.isOpen && account.role==='admin'&&<FloatingPanel id="admin" title="Administration" state={panels.admin} update={updatePanel} focus={focusPanel}><AdminConsole/></FloatingPanel>}

   {panels.problems.isOpen&&<FloatingPanel id="problems" title="Problem library" state={panels.problems} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><Search size={17}/> Problem library and matching</span></div><p className="muted">Search only within the selected target. Semantic matches require embeddings; lexical search remains available without AI calls.</p><div className="search-row"><input value={searchText} onChange={e=>setSearchText(e.target.value)} placeholder="Describe a problem or enter keywords"/><select value={searchMode} onChange={e=>setSearchMode(e.target.value)}><option value="exact">Lexical</option><option value="hybrid">Hybrid</option><option value="semantic">Semantic</option></select><button className="primary" disabled={!current||!!busy||searchText.length<3} onClick={()=>run('search',async()=>{const r=await post<{results:any[],mode:string}>(path+'/search',{text:searchText,mode:searchMode});setSearchResults(r.results);setNotice(r.results.length+' '+r.mode+' results.')})}>Search</button></div><div className="button-row">{!readOnly&&current&&<button className="secondary" onClick={()=>run('index',async()=>{await post(path+'/index/queue');setNotice('Background semantic indexing queued for this target.')})}>Queue target indexing</button>}<button className="ghost" onClick={()=>{setSearchResults(null);setSearchText('')}}>Clear</button></div><h3>{searchResults?'Search results':'All problems'}</h3>{renderProblemList((searchResults||problems) as Problem[])}</section></div></FloatingPanel>}

   {panels.research.isOpen&&<FloatingPanel id="research" title="Research & evidence" state={panels.research} update={updatePanel} focus={focusPanel}><div className="content"><section className="panel"><div className="pane-title"><span><BookOpen size={17}/> Problem research</span>{selected&&<span className="mini">Problem #{selected.id}</span>}</div>{selected?<><h2>{selected.description}</h2><p className="muted">{selected.stream} · {selected.category}</p><h3>Evidence and source review</h3><p className="muted">AI-assisted research is an evidence-gathering draft. Verify every source and claim before using it in a design proposal.</p><label className="field">Research focus<textarea rows={3} value={focus} onChange={e=>setFocus(e.target.value)}/></label><button className="primary" disabled={readOnly||!!busy} onClick={()=>run('research',async()=>{const r=await post<{saved:number}>(path+'/problems/'+selected.id+'/research',{focus});await loadProblem(selected.id,false);setNotice(r.saved+' sourced findings saved for review.')})}><FlaskConical size={16}/> {busy==='research'?'Researching…':'Research with OpenAI'}</button>{readOnly&&<p className="mini">Copy this shared target to conduct your own research.</p>}<div className="divider"/><h3>Findings · {selected.findings?.length||0}</h3>{selected.findings?.length?selected.findings.map(f=><div className="finding" key={f.id}><span className="pill">{f.reviewStatus||'needs_review'}</span><p>{f.claim}</p>{f.statistic&&<p><strong>{f.statistic}</strong></p>}{f.limitations&&<small>Limitations: {f.limitations}</small>}{f.url&&<a href={f.url} rel="noreferrer" target="_blank">{f.title||f.url}<ExternalLink size={12}/></a>}{!readOnly&&<div className="button-row"><button className="secondary" disabled={!!busy||f.reviewStatus==='reviewed'} onClick={()=>run('reviewFinding',async()=>{await patch(path+'/findings/'+f.id,{status:'reviewed'});await loadProblem(selected.id,false)})}>Mark source reviewed</button><button className="ghost" disabled={!!busy||f.reviewStatus==='rejected'} onClick={()=>run('rejectFinding',async()=>{await patch(path+'/findings/'+f.id,{status:'rejected'});await loadProblem(selected.id,false)})}>Reject finding</button></div>}</div>):<p className="empty">No sourced findings yet.</p>}<div className="divider"/><h3>Generate concepts from this problem</h3><label className="field">Design direction<textarea rows={2} value={designDirection} onChange={e=>setDesignDirection(e.target.value)} placeholder="Optional: affordability, low-tech options, dignity, maintenance…"/></label><div className="button-row"><select value={conceptCount} onChange={e=>setConceptCount(Number(e.target.value))}>{[2,3,4,5,6].map(n=><option value={n} key={n}>{n} concepts</option>)}</select><button className="primary" disabled={readOnly||!!busy} onClick={()=>run('generate',async()=>{const r=await post<{concepts:any[]}>(path+'/problems/'+selected.id+'/concepts/generate',{count:conceptCount,direction:designDirection});await loadProblem(selected.id,false);setNotice(r.concepts.length+' drafts generated.')})}><Sparkles size={15}/> Generate draft concepts</button></div><h3>Generated concepts · {drafts.length}</h3>{drafts.map(d=><div className="finding" key={d.id}><span className="pill">{d.status}</span><label className="field">Concept name<input disabled={d.status==='saved'||readOnly} value={draftEdits[d.id]?.name??d.name} onChange={e=>setDraftEdits(prev=>({...prev,[d.id]:{name:e.target.value,description:prev[d.id]?.description??d.description}}))}/></label><label className="field">Description<textarea rows={3} disabled={d.status==='saved'||readOnly} value={draftEdits[d.id]?.description??d.description} onChange={e=>setDraftEdits(prev=>({...prev,[d.id]:{name:prev[d.id]?.name??d.name,description:e.target.value}}))}/></label><details><summary>Mechanism, risks, and assumptions</summary><p>{d.details?.mechanism}</p><ul>{(d.details?.assumptions||[]).map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></details>{d.status==='saved'&&d.solutionId?<button className="secondary" onClick={()=>run('concept',()=>loadSolution(d.solutionId!))}>Open saved concept</button>:<button disabled={readOnly||!!busy} className="secondary" onClick={()=>run('saveDraft',async()=>{await post(path+'/concept-drafts/'+d.id+'/save',{name:draftEdits[d.id]?.name??d.name,description:draftEdits[d.id]?.description??d.description});await loadProblem(selected.id,false);await refreshTarget();setNotice('Saved as a concept.')})}>Save to concepts</button>}</div>)}</>:<div className="empty">Select a problem in the graph or Problem library to research it.</div>}</section></div></FloatingPanel>}

   {panels.discovery.isOpen&&<FloatingPanel id="discovery" title="Problem discovery" state={panels.discovery} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><Sparkles size={17}/> AI problem discovery</span></div><p className="muted">Discover evidence-linked unmet problems within the selected target. Candidates are provisional until you review and approve them.</p><label className="field">Research topic<textarea rows={3} value={discoveryTopic} onChange={e=>setDiscoveryTopic(e.target.value)} placeholder="Who is affected, where, and which unmet needs should be explored?"/></label><button className="primary" disabled={!current||readOnly||!!busy||discoveryTopic.length<10} onClick={()=>run('discover',async()=>{const result=await post<{count:number}>(path+'/discoveries/search',{topic:discoveryTopic});await refreshTarget();setNotice(result.count+' candidates discovered for review.')})}><Sparkles size={15}/> Research unmet problems</button><h3>Review queue · {discoveries.length}</h3>{discoveries.length?discoveries.map(d=><div className="finding" key={d.id}><div className="row"><strong>Discovery candidate</strong><span className="pill">{d.status}</span></div>{d.status==='pending_review'&&!readOnly?<label className="field">Edit problem statement<textarea rows={3} value={discoveryEdits[d.id]??d.statement} onChange={e=>setDiscoveryEdits(prev=>({...prev,[d.id]:e.target.value}))}/></label>:<p>{d.statement}</p>}<p className="muted">{d.rationale}</p>{d.evidenceUrls?.map((url:string,i:number)=><a key={i} target="_blank" rel="noreferrer" href={url}>{url}<ExternalLink size={12}/></a>)}{d.status==='pending_review'&&!readOnly&&<div className="button-row"><button className="primary" disabled={!!busy} onClick={()=>run('approve',async()=>{await post(path+'/discoveries/'+d.id+'/approve',{statement:discoveryEdits[d.id]||undefined});await refreshTarget();setNotice('Discovery approved and added to the graph.')})}>Approve problem</button><button className="secondary" disabled={!!busy} onClick={()=>run('reject',async()=>{await post(path+'/discoveries/'+d.id+'/reject');await refreshTarget()})}>Reject</button></div>}</div>):<p className="empty">No discoveries yet. Create categories under Manage hierarchy before searching.</p>}</section></div></FloatingPanel>}

   {panels.concepts.isOpen&&<FloatingPanel id="concepts" title="Concept studio" state={panels.concepts} update={updatePanel} focus={focusPanel}><div className="solution-layout"><section className="panel"><div className="pane-title"><span><Plus size={16}/> Create a concept</span></div><label className="field">Name<input value={conceptName} onChange={e=>setConceptName(e.target.value)}/></label><label className="field">Description<textarea rows={6} value={conceptDescription} onChange={e=>setConceptDescription(e.target.value)} placeholder="Intended users, mechanisms, benefits, risks and uncertainties…"/></label><button className="primary" disabled={readOnly||!!busy||conceptName.trim().length<3||conceptDescription.trim().length<40} onClick={()=>run('newConcept',async()=>{const created=await post<Sol>(path+'/solutions',{name:conceptName,description:conceptDescription});setConceptName('');setConceptDescription('');await refreshTarget();await loadSolution(created.id);setNotice('Concept saved.')})}><Plus size={14}/> Save concept</button><h3>Saved concepts</h3>{sols.map(s=><button className="saved-item" key={s.id} onClick={()=>run('concept',()=>loadSolution(s.id))}>{s.name}<ChevronRight size={15}/></button>)}{!sols.length&&<p className="empty">No saved concepts yet. Create one, or generate drafts from a problem record.</p>}</section><section className="panel"><div className="pane-title"><span><Lightbulb size={17}/> Concept workspace</span></div>{solution?<><h2>{solution.name}</h2><p className="muted">{solution.description}</p><div className="button-row"><button className="primary" onClick={()=>changeTab('matching')}>Problem matching</button><button className="secondary" onClick={()=>changeTab('evaluation')}>Concept analysis</button></div></>:<p className="empty">Select a saved concept to work on its matching and evaluation.</p>}</section></div></FloatingPanel>}

   {panels.matching.isOpen&&<FloatingPanel id="matching" title="Concept matching" state={panels.matching} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><Network size={17}/> Problem matching</span></div><label className="field">Selected concept<select value={solution?.id||''} onChange={e=>{if(e.target.value)run('concept',()=>loadSolution(e.target.value,false))}}><option value="">Choose a concept</option>{sols.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>{solution?<><h2>{solution.name}</h2><p className="muted">{solution.description}</p><button className="primary" disabled={readOnly||!!busy} onClick={()=>run('match',async()=>{const result=await post<{matches:any[]}>(path+'/solutions/'+solution.id+'/match');await loadSolution(solution.id,false);setNotice(result.matches.length+' potential matches generated.')})}><Network size={15}/> Match to target problems</button><h3>Potential problem matches</h3>{solution.matches?.length?solution.matches.map(m=><div className="match" key={m.problemId}><div className="row"><strong>#{m.problemId}: {m.description}</strong><span className="score">{m.relevance}% relevance</span></div><p>{m.rationale}</p><small>{m.relationship} · {m.confidence} confidence · not proven impact</small><button className="text-link" onClick={()=>run('problem',()=>loadProblem(m.problemId))}>Inspect problem →</button></div>):<p className="empty">Run matching to identify possible relationships. Matching is not proof of effectiveness.</p>}</>:<p className="empty">Create or choose a concept in the Concepts workspace.</p>}</section></div></FloatingPanel>}

   {panels.evaluation.isOpen&&<FloatingPanel id="evaluation" title="Concept evaluation" state={panels.evaluation} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><BarChart3 size={17}/> Concept analysis</span></div><label className="field">Selected concept<select value={solution?.id||''} onChange={e=>{if(e.target.value)run('concept',()=>loadSolution(e.target.value,false))}}><option value="">Choose a concept</option>{sols.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>{solution?<><h2>{solution.name}</h2><p className="muted">{solution.matches?.length||0} saved problem matches in this target</p><button className="primary" disabled={readOnly||!!busy} onClick={()=>run('evaluate',async()=>{const result=await post<{data:Eval}>(path+'/solutions/'+solution.id+'/evaluate');setEvaluation(result.data);await loadSolution(solution.id,false);setNotice('Provisional evaluation saved.')})}>Generate structured evaluation</button>{evaluation?<><div className="evalchart"><ResponsiveContainer width="100%" height={280}><RadarChart data={evaluation.factors.map(f=>({factor:f.factor,score:f.score||0}))}><PolarGrid/><PolarAngleAxis dataKey="factor" tick={{fill:'#a2b1bb',fontSize:12}}/><Tooltip/><Radar dataKey="score" stroke="#8fc4ae" fill="#8fc4ae" fillOpacity={0.25}/></RadarChart></ResponsiveContainer></div><p className="muted">{evaluation.summary}</p><div className="factor-grid">{evaluation.factors.map(f=><div className="factor" key={f.factor}><div className="row"><strong>{f.factor}</strong><span className="score">{f.score===null?'Unrated':f.score+'/5'}</span></div><p>{f.rationale}</p><small>{f.confidence} confidence</small><details><summary>Open questions</summary>{f.unanswered_questions.map((x,i)=><p key={i}>{x}</p>)}</details></div>)}</div><h3>Risks</h3><ul>{evaluation.risks.map((x,i)=><li key={i}>{x}</li>)}</ul><h3>Next research</h3><ul>{evaluation.next_research.map((x,i)=><li key={i}>{x}</li>)}</ul></>:<p className="empty">No evaluation yet. Missing evidence should produce unrated factors rather than invented precision.</p>}</>:<p className="empty">Choose a saved concept to analyze.</p>}</section></div></FloatingPanel>}

   {panels.manage.isOpen&&<FloatingPanel id="manage" title="Research structure" state={panels.manage} update={updatePanel} focus={focusPanel}><div className="content wide-content"><section className="panel"><div className="pane-title"><span><Settings2 size={17}/> Target hierarchy</span><span className="pill">{readOnly?'Read-only':'Editable'}</span></div><p className="muted">The graph is Target → Stream → Category → Problem. Choose a stream to generate an editable taxonomy or add records manually.</p><div className="hierarchy-columns"><div><h3>Research streams</h3>{streams.map(s=><button className={'saved-item '+(selectedStream===s.id?'active':'')} key={s.id} onClick={()=>{setSelectedStream(s.id);setSeedPreview(null);setSelectedCategory('')}}>{s.name}<ChevronRight size={14}/></button>)}{!readOnly&&<div className="quick-add"><input value={newStream} placeholder="New stream" onChange={e=>setNewStream(e.target.value)}/><button className="secondary" disabled={!current||!!busy||newStream.length<3} onClick={()=>run('addStream',async()=>{await post(path+'/streams',{name:newStream,description:''});setNewStream('');await refreshTarget()})}>Add</button></div>}</div><div><h3>Categories</h3>{hierarchy.filter(h=>h.streamId===selectedStream&&h.categoryId).map(h=><button key={h.categoryId} className={'saved-item '+(selectedCategory===h.categoryId?'active':'')} onClick={()=>setSelectedCategory(h.categoryId!)}>{h.category} <span className="mini">{h.count}</span></button>)}{!readOnly&&selectedStream&&<div className="quick-add"><input value={newCategory} placeholder="New category" onChange={e=>setNewCategory(e.target.value)}/><button className="secondary" disabled={!!busy||newCategory.length<3} onClick={()=>run('addCategory',async()=>{await post(path+'/streams/'+selectedStream+'/categories',{name:newCategory});setNewCategory('');await refreshTarget()})}>Add</button></div>}</div></div>{selectedCategory&&<><h3>Problems in selected category</h3>{problems.filter(p=>p.categoryId===selectedCategory).map(p=><div className="target-row" key={p.id}><div><strong>#{p.id}</strong><p>{p.description}</p></div><div className="button-row"><button className="secondary" onClick={()=>run('problem',()=>loadProblem(p.id))}>Open</button>{!readOnly&&<><button className="ghost small" onClick={()=>{const statement=window.prompt('Edit problem statement',p.description);if(!statement||statement.trim().length<20)return;run('editProblem',async()=>{await patch(path+'/problems/'+p.id,{statement});await refreshTarget()})}}>Edit</button><button className="ghost small danger" onClick={()=>{if(!window.confirm('Delete this problem?'))return;run('deleteProblem',async()=>{await del(path+'/problems/'+p.id);await refreshTarget()})}}>Delete</button></>}</div></div>)}{!readOnly&&<div className="quick-add"><textarea value={newProblem} rows={3} placeholder="Add an observable problem statement (20+ characters)" onChange={e=>setNewProblem(e.target.value)}/><button className="primary" disabled={!!busy||newProblem.length<20} onClick={()=>run('addProblem',async()=>{await post(path+'/categories/'+encodeURIComponent(selectedCategory)+'/problems',{statement:newProblem});setNewProblem('');await refreshTarget()})}>Add problem</button></div>}</>}
   {!readOnly&&selectedStream&&<div className="button-row"><button className="ghost small" onClick={()=>{const found=streams.find(s=>s.id===selectedStream);if(!found)return;const name=window.prompt('Rename stream',found.name);if(!name||name.trim().length<3)return;run('renameStream',async()=>{await patch(path+'/streams/'+selectedStream,{name,description:found.description||''});await refreshTarget()})}}>Rename stream</button><button className="ghost small danger" onClick={()=>{if(!window.confirm('Delete stream and its categories and problems?'))return;run('deleteStream',async()=>{await del(path+'/streams/'+selectedStream);setSelectedStream('');setSelectedCategory('');await refreshTarget()})}}>Delete stream</button></div>}
   {!readOnly&&selectedCategory&&<div className="button-row"><button className="ghost small" onClick={()=>{const category=hierarchy.find(h=>h.categoryId===selectedCategory);const name=window.prompt('Rename category',category?.category||'');if(!name||name.trim().length<3)return;run('renameCategory',async()=>{await patch(path+'/categories/'+encodeURIComponent(selectedCategory),{name});await refreshTarget()})}}>Rename category</button><button className="ghost small danger" onClick={()=>{if(!window.confirm('Delete this category and all problems within it?'))return;run('deleteCategory',async()=>{await del(path+'/categories/'+encodeURIComponent(selectedCategory));setSelectedCategory('');await refreshTarget()})}}>Delete category</button></div>}
   {!readOnly&&selectedStream&&<div className="divider"/>}{!readOnly&&selectedStream&&<><h3>AI-generated taxonomy</h3><p className="muted">Create editable draft categories and problem hypotheses for this stream. These are not verified evidence.</p><div className="button-row"><select value={seedDetail} onChange={e=>setSeedDetail(e.target.value)}><option value="outline">Outline · 3 categories</option><option value="standard">Standard · 5 categories / 3 problems each</option><option value="detailed">Detailed · 7 categories / 6 problems each</option></select><button className="secondary" disabled={!!busy} onClick={()=>run('previewSeed',async()=>{const r=await post<{categories:SeedCategory[]}>(path+'/streams/'+selectedStream+'/seed-preview',{detail:seedDetail});setSeedPreview(r.categories)})}><Sparkles size={15}/> Generate draft</button></div>{seedPreview&&<div className="seed-preview"><h3>Review before saving</h3>{seedPreview.map((c,i)=><div className="finding" key={i}><label className="field">Category<input value={c.name} onChange={e=>setSeedPreview(old=>old?.map((x,j)=>i===j?{...x,name:e.target.value}:x)||null)}/></label>{c.problems.map((p,j)=><label className="field" key={j}>Problem hypothesis<textarea rows={2} value={p} onChange={e=>setSeedPreview(old=>old?.map((x,k)=>k===i?{...x,problems:x.problems.map((v,n)=>n===j?e.target.value:v)}:x)||null)}/></label>)}</div>)}<div className="button-row"><button className="primary" disabled={!!busy} onClick={()=>run('saveSeed',async()=>{const r=await post<{categories:any[]}>(path+'/streams/'+selectedStream+'/taxonomy',{categories:seedPreview});setSeedPreview(null);await refreshTarget();setNotice(r.categories.length+' draft categories saved.')})}>Save reviewed taxonomy</button><button className="ghost" onClick={()=>setSeedPreview(null)}>Discard draft</button></div></div>}</>}</section></div></FloatingPanel>}
  </div>
  {problemModalOpen&&selected&&<div className="context-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setProblemModalOpen(false)}}>
    <section className="context-modal" role="dialog" aria-modal="true" aria-label="Problem detail">
      <div className="context-modal-heading"><div className="eyebrow">PROBLEM #{selected.id} · {selected.stream} / {selected.category}</div>
        <button className="ghost small" onClick={()=>setProblemModalOpen(false)} aria-label="Close problem details">Close</button></div>
      <h2>{selected.description}</h2>
      <p className="muted">{selected.findings?.length||0} sourced findings · {selected.solutions?.length||0} linked saved concepts · {drafts.length} concept drafts</p>
      <div className="context-modal-actions">
        <button className="primary" onClick={()=>{setProblemModalOpen(false);changeTab('research')}}><BookOpen size={15}/> Research & evidence</button>
        <button className="secondary" onClick={()=>{setProblemModalOpen(false);changeTab('concepts')}}><Lightbulb size={15}/> Concepts</button>
        <button className="ghost" onClick={()=>{setProblemModalOpen(false);changeTab('problems')}}>Problem library</button>
      </div>
      {!!selected.findings?.length&&<div className="modal-findings"><h3>Recent evidence</h3>{selected.findings.slice(0,4).map(item=><div className="finding" key={item.id}><small>{item.reviewStatus||'needs_review'}</small><p>{item.claim}</p>{item.url&&<a href={item.url} target="_blank" rel="noreferrer">{item.title||'View source'} <ExternalLink size={13}/></a>}</div>)}</div>}
      {readOnly&&<p className="mini">Shared targets are read-only. Copy the target into your workspace to edit or run AI research.</p>}
    </section>
  </div>}
  {wizard&&<div className="wizard-backdrop" role="dialog" aria-modal="true" aria-label="Create research target"><div className="wizard-card"><div className="wizard-head"><div><div className="eyebrow">NEW RESEARCH WORKSPACE</div><h2>Create a target</h2><p className="muted">Define the central question. Suggest and select initial research streams. Your graph will start at the target and expand from there.</p></div><button className="ghost" onClick={()=>setWizard(false)}>Close</button></div><label className="field">Target name<input maxLength={120} value={wizardName} onChange={e=>setWizardName(e.target.value)} placeholder="e.g. Human-centered robotics for longevity"/></label><label className="field">Scope / intended users<textarea value={wizardScope} rows={3} maxLength={1500} onChange={e=>setWizardScope(e.target.value)} placeholder="Define boundaries, populations, setting and goals."/></label><div className="search-row"><label className="field">Research detail<select value={wizardDetail} onChange={e=>setWizardDetail(e.target.value)}><option value="outline">Outline · 3 streams</option><option value="standard">Standard · 5 streams</option><option value="detailed">Detailed · 7 streams</option></select></label><button className="secondary" disabled={!!busy||wizardName.trim().length<3} onClick={()=>run('suggest',async()=>{const r=await post<{streams:{name:string,description:string}[]}>('/targets/suggest-streams',{name:wizardName,description:wizardScope,detail:wizardDetail});setSuggestions(r.streams.map(x=>({...x,selected:true})))})}><Sparkles size={15}/> Suggest research streams</button></div><div className="wizard-streams">{suggestions.map((s,i)=><div className="wizard-stream" key={i}><input type="checkbox" checked={s.selected} onChange={e=>setSuggestions(old=>old.map((x,j)=>i===j?{...x,selected:e.target.checked}:x))}/><div><input value={s.name} aria-label="Stream name" onChange={e=>setSuggestions(old=>old.map((x,j)=>i===j?{...x,name:e.target.value}:x))}/><textarea rows={2} value={s.description} aria-label="Stream scope" onChange={e=>setSuggestions(old=>old.map((x,j)=>i===j?{...x,description:e.target.value}:x))}/></div></div>)}</div><div className="quick-add"><input value={manualSuggestion} placeholder="Add your own research stream" onChange={e=>setManualSuggestion(e.target.value)}/><button className="secondary" disabled={manualSuggestion.trim().length<3} onClick={()=>{setSuggestions(old=>[...old,{name:manualSuggestion.trim(),description:'',selected:true}]);setManualSuggestion('')}}><Plus size={15}/> Add</button></div><label className="field"><input type="checkbox" checked={wizardShared} onChange={e=>setWizardShared(e.target.checked)} style={{width:'auto',display:'inline-block',marginRight:10}}/>Share this target as read-only to other users</label><div className="wizard-actions"><button className="ghost" onClick={()=>{setWizard(false);changeTab('directory')}}>Browse shared targets</button><button className="primary" disabled={!!busy||wizardName.trim().length<3||!suggestions.some(x=>x.selected&&x.name.trim().length>=3)} onClick={createTarget}>Create target and graph</button></div></div></div>}

  {editTarget&&current&&<div className="wizard-backdrop" role="dialog" aria-modal="true" aria-label="Edit target"><div className="wizard-card"><h2>Edit target</h2><label className="field">Name<input value={editingName} onChange={e=>setEditingName(e.target.value)}/></label><label className="field">Scope<textarea rows={4} value={editingDesc} onChange={e=>setEditingDesc(e.target.value)}/></label><label className="field"><input type="checkbox" checked={editingShared} onChange={e=>setEditingShared(e.target.checked)} style={{display:'inline-block',width:'auto',marginRight:10}}/>Allow others to view or copy this target</label><div className="wizard-actions"><button className="ghost" onClick={()=>setEditTarget(false)}>Cancel</button><button className="primary" disabled={!!busy||editingName.length<3} onClick={saveSettings}>Save changes</button><button className="ghost danger" onClick={()=>{if(!window.confirm('Permanently delete this target and all its research, concepts and data?'))return;run('deleteTarget',async()=>{await del(path);setCurrent(null);setEditTarget(false);const d=await reloadDirectory();if(d.mine.length)await selectTarget(d.mine[0]);else{setWizard(true);changeTab('graph')}})}}><Trash2 size={14}/> Delete target</button></div></div></div>}
 </div>;
}

createRoot(document.getElementById('root')!).render(<Root/>);
