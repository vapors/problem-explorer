import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import cytoscape, {Core} from 'cytoscape';
import {Radar,RadarChart,PolarGrid,PolarAngleAxis,ResponsiveContainer,Tooltip} from 'recharts';
import {Network,Search,BookOpen,Lightbulb,BarChart3,ChevronRight,RefreshCw,ExternalLink,Plus,ArrowLeft,FlaskConical,Sparkles,FolderPlus,Trash2,Share2,Lock,Settings2} from 'lucide-react';
import './style.css';

type Problem={id:number,description:string,streamId?:string,stream?:string,category:string,findings?:Finding[],researchRuns?:any[],solutions?:any[]};
type Finding={id:string,claim:string,title:string,url:string,confidence:string,limitations:string,reviewStatus:string,statistic:string};
type ConceptDraft={id:string,name:string,description:string,status:string,solutionId?:string|null,details:any};
type Sol={id:string,name:string,description:string,matches?:Match[],evaluations?:{id:string,payload:string}[]};
type Match={problemId:number,description:string,relationship:string,relevance:number,rationale:string,confidence:string};
type Factor={factor:string,score:number|null,confidence:string,rationale:string,evidence_urls:string[],unanswered_questions:string[]};
type Eval={summary:string,factors:Factor[],key_assumptions:string[],risks:string[],next_research:string[]};
type Elements={nodes:any[],edges:any[]};
async function api<T=any>(url:string,init?:RequestInit):Promise<T>{
 const res=await fetch('/api'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...init});
 if(!res.ok){let error:any;try{error=await res.json()}catch{error={detail:res.statusText}};throw new Error(typeof error.detail==='string'?error.detail:(error.detail?.message||JSON.stringify(error.detail||res.statusText)))}
 return res.json();
}
const post=<T=any,>(url:string,body?:unknown):Promise<T>=>api<T>(url,{method:'POST',body:JSON.stringify(body??{})});
const graphLabel=(value:string,type:string)=>{
 const text=value.trim().replace(/\s+/g,' ');
 if(type!=='problem'&&type!=='finding')return text;
 // Two lines on the canvas; the full original statement remains available on hover.
 const maxTotal=82, lineWidth=41;
 const clipped=text.length>maxTotal?text.slice(0,maxTotal-1).trimEnd()+'…':text;
 if(clipped.length<=lineWidth)return clipped;
 const split=clipped.lastIndexOf(' ',lineWidth);
 const at=split>=24?split:lineWidth;
 return clipped.slice(0,at).trimEnd()+'\n'+clipped.slice(at).trimStart();
};
const colors:Record<string,string>={root:'#243d4c',stream:'#34697c',category:'#b18b59',problem:'#467b70',finding:'#946f96'};

function Graph({onProblem,targetId}:{onProblem:(id:number)=>void,targetId?:string}){
 const ref=useRef<HTMLDivElement>(null);
 const cy=useRef<Core|null>(null);
 const [hint,setHint]=useState('Click a stream to expand its categories. Click again to collapse.');
 const [expanded,setExpanded]=useState<Set<string>>(new Set());
 const expandedRef=useRef(new Set<string>());
 const focusRef=useRef<string|null>(null);
 const compactChildren=(core:Core,id:string)=>{
   const parent=core.getElementById(id);
   if(!parent.length)return;
   const children=parent.outgoers('node');
   const count=children.length;
   if(!count)return;
   // Place the immediate expansion around its parent, independently of other
   // expanded branches. Keep enough arc length for typical two-line labels.
   const radius=Math.max(160,Math.min(650,(count*155)/(2*Math.PI)));
   const center=parent.position();
   core.batch(()=>children.forEach((child:any,i:number)=>{
     const angle=-Math.PI/2+2*Math.PI*i/count;
     child.position({x:center.x+radius*Math.cos(angle),y:center.y+radius*Math.sin(angle)});
   }));
 };
 const focusBranch=(core:Core,id:string,duration=480)=>{
   const parent=core.getElementById(id);
   if(!parent.length)return;
   // Fit the expanded branch, not the clicked parent alone. Cytoscape accounts for
   // both the nodes and their labels when calculating the viewport bounding box.
   // Focus on the immediate children of the selected node, not every descendant
   // of the expanded branch. Deep descendants can make the view unreadably small.
   const branch=parent.union(parent.outgoers('node'));
   // Dim ancestors and unrelated branches, while leaving the active branch readable.
   core.elements().removeClass('graph-muted');
   core.nodes().not(branch).addClass('graph-muted');
   core.edges().not(branch.connectedEdges()).addClass('graph-muted');
   const padding=Math.max(24,Math.min(52,Math.min(core.width(),core.height())*0.055));
   core.animate({fit:{eles:branch,padding},duration} as any);
 };
 const focusSingleNode=(core:Core,id:string,duration=320)=>{
   const node=core.getElementById(id);
   if(!node.length)return;
   core.animate({center:{eles:node},duration} as any);
 };
 const showAll=(core:Core,padding=55)=>{
   core.elements().removeClass('graph-muted');
   core.animate({fit:{eles:core.elements(),padding},duration:400} as any);
 };
 const layoutGraph=(core:Core,focusId?:string)=>{
   // Compact circular rings reduce distance between siblings so labels stay legible.
   // Focusing only on immediate children avoids zooming out for deep descendants.
   const layout=core.layout({name:'breadthfirst',directed:true,roots:'#root',spacingFactor:1.12,
    nodeDimensionsIncludeLabels:true,padding:45,fit:false,animate:true,animationDuration:430,
    circle:true} as any);
   layout.one('layoutstop',()=>{
     if(core.destroyed())return;
     const id=focusId||focusRef.current;
     if(id && core.getElementById(id).length){
       compactChildren(core,id);
       focusBranch(core,id);
     }else showAll(core,75);
   });
   layout.run();
 };
 useEffect(()=>{
   if(!ref.current)return;
   const core=cytoscape({container:ref.current,elements:[],style:[
    {selector:'node',style:{'background-color':(e:any)=>colors[e.data('type')]||'#888',
      'label':(e:any)=>graphLabel(String(e.data('label')||''),String(e.data('type'))),
      'font-size':'11px','color':'#dce8e8','text-outline-width':2,'text-outline-color':'#101d25',
      'text-valign':'bottom','text-margin-y':10,'text-wrap':'wrap','text-max-width':'270px',
      'text-justification':'center',
      'width':(e:any)=>e.data('type')==='root'?56:e.data('type')==='stream'?46:22,
      'height':(e:any)=>e.data('type')==='root'?56:e.data('type')==='stream'?46:22,
      'border-width':1.6,'border-color':'#c6d7d1'}},
    {selector:'edge',style:{'line-color':'#42626b','width':1.3,'opacity':0.7,'curve-style':'bezier'}},
    {selector:'node:selected',style:{'border-color':'#f0c779','border-width':4}},
    {selector:'.graph-muted',style:{'opacity':0.20}}
   ],layout:{name:'preset'},wheelSensitivity:0.18});
   cy.current=core;
   (targetId==='__empty__'?Promise.resolve({nodes:[{data:{id:'root',label:'Create or select a target',type:'root'}}],edges:[]}):api<Elements>(targetId?'/targets/'+encodeURIComponent(targetId)+'/graph':'/graph/root')).then(data=>{core.add([...data.nodes,...data.edges]);layoutGraph(core)}).catch(e=>setHint(e.message));
   core.on('mouseover','node',evt=>{
     const full=String(evt.target.data('label')||'');
     if(evt.target.data('type')==='problem')setHint(full+' · Click to open full record');
   });
   core.on('tap','node',async evt=>{
     const node=evt.target;const id=String(node.id());const type=node.data('type');
     if(type==='problem'){focusSingleNode(core,id,300);onProblem(Number(id.slice(1)));return}
     if(type==='finding'){focusSingleNode(core,id);return;}
     if(type==='root'){focusRef.current=null;showAll(core);return}
     // Wait for the new layout before zooming to the revealed branch.

     if(expandedRef.current.has(id)){
       const children=node.outgoers('node');children.forEach((child:any)=>{child.successors().remove();child.remove()});
       expandedRef.current.delete(id);setExpanded(new Set(expandedRef.current));
       focusRef.current=id;layoutGraph(core,id);return;
     }
     try{
       const data=await api<Elements>(targetId?'/targets/'+encodeURIComponent(targetId)+'/expand/'+encodeURIComponent(id):'/graph/expand/'+encodeURIComponent(id));
       const elements=[...data.nodes,...data.edges].filter((e:any)=>!(e.data?.id && core.getElementById(e.data.id).length));
       core.add(elements);
       expandedRef.current.add(id);setExpanded(new Set(expandedRef.current));
       focusRef.current=id;layoutGraph(core,id);
       setHint(`${data.nodes.length} connected nodes · hover over a problem to read its full statement`);
     }catch(e:any){setHint(e.message)}
   });
   return()=>{core.destroy();cy.current=null};
 },[targetId]);
 return <section className="graph-panel"><div className="pane-title"><span><Network size={17}/> Knowledge graph</span><div className="actions"><button className="ghost small" onClick={()=>cy.current&&showAll(cy.current,45)}>Fit graph</button><button className="ghost small" onClick={()=>{cy.current?.nodes().unselect();if(cy.current)showAll(cy.current,55)}}>Reset zoom</button></div></div><div className="graph-canvas" ref={ref}/><div className="graph-footer">{hint} <span>{expanded.size} expanded</span></div></section>;
}

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
function WorkspaceCreator({onCreated}:{onCreated:()=>void}){
 const [name,setName]=useState('');const [description,setDescription]=useState('');const [streamId,setStreamId]=useState('');const [detail,setDetail]=useState('standard');
 const [preview,setPreview]=useState<any>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 return <section className="content"><div className="panel"><div className="pane-title"><span><Plus size={17}/> New research stream</span><span className="mini">Private to your account</span></div>
 <p className="muted">Choose any research subject. Preview an AI-proposed structure, edit it, and decide what to save. Seeded problems are unverified hypotheses requiring subsequent research.</p>
 {error&&<div className="alert bad">{error}</div>}{message&&<div className="alert good">{message}</div>}
 {!streamId?<><label className="field">Stream name<input maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Urban heat resilience"/></label><label className="field">Research scope<textarea maxLength={1000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Who, what context, and which boundaries should this research cover?"/></label><button className="primary" disabled={busy||name.trim().length<3} onClick={()=>run(async()=>{const r=await post('/streams',{name,description});setStreamId(r.id);onCreated()})}>Create private stream</button></>:<><p><strong>{name}</strong> · New private stream created</p><label className="field">Initial level of detail<select value={detail} onChange={e=>setDetail(e.target.value)}><option value="outline">Outline · 3 categories, no problems</option><option value="standard">Standard · 5 categories, 3 problems each</option><option value="detailed">Detailed · 7 categories, 6 problems each</option></select></label><button disabled={busy} className="primary" onClick={()=>run(async()=>{setPreview(await post(`/streams/${streamId}/seed`,{detail}))})}>{busy?'Generating…':'Generate editable draft taxonomy'}</button>
 {preview&&<><h3>Review generated structure</h3><p className="muted">Edit any category or problem before saving. Nothing below is verified evidence.</p>{preview.categories.map((c:any,i:number)=><div key={i} className="finding"><label className="field">Category<input value={c.name} onChange={e=>setPreview((v:any)=>({...v,categories:v.categories.map((x:any,j:number)=>j===i?{...x,name:e.target.value}:x)}))}/></label>{c.problems.map((p:string,j:number)=><label className="field" key={j}>Problem hypothesis<textarea rows={2} value={p} onChange={e=>setPreview((v:any)=>({...v,categories:v.categories.map((x:any,k:number)=>k===i?{...x,problems:x.problems.map((t:string,n:number)=>n===j?e.target.value:t)}:x)}))}/></label>)}</div>)}<button className="primary" disabled={busy} onClick={()=>run(async()=>{const r=await post(`/streams/${streamId}/taxonomy`,{categories:preview.categories});setPreview(null);setMessage(`Saved ${r.categories.length} categories and ${r.categories.reduce((a:number,c:any)=>a+c.problems.length,0)} draft problems. Embeddings queued in the background.`);onCreated()})}>Save reviewed structure</button></>}</>}
 </div></section>;
}

// v0.6.1: sidebar-first experience with an optional target wizard overlay.
type Target={id:string,name:string,description:string,shared:boolean,ownerId?:string,readOnly?:boolean};
type SuggestedStream={name:string,description:string,selected:boolean};
function TargetHome(){
 const [directory,setDirectory]=useState<{mine:Target[],shared:Target[],reference:Target}|null>(null);
 const [current,setCurrent]=useState<Target|null>(null);
 const [view,setView]=useState<'graph'|'directory'>('graph');
 const [wizard,setWizard]=useState(false);
 const [form,setForm]=useState({name:'',description:'',shared:false,detail:'standard'});
 const [suggestions,setSuggestions]=useState<SuggestedStream[]>([]);
 const [manualStream,setManualStream]=useState('');
 const [busy,setBusy]=useState(false);
 const [streams,setStreams]=useState<any[]>([]);
 const [selectedStream,setSelectedStream]=useState('');
 const [categories,setCategories]=useState<any[]>([]);
 const [selectedCategory,setSelectedCategory]=useState('');
 const [newCategory,setNewCategory]=useState('');const [newProblem,setNewProblem]=useState('');
 const [newStream,setNewStream]=useState('');const [newDescription,setNewDescription]=useState('');
 const [selectedProblem,setSelectedProblem]=useState<any>(null);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');const [version,setVersion]=useState(0);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const refresh=async()=>{const d=await api<any>('/targets');setDirectory(d);return d};
 const open=async(t:Target)=>{
   setCurrent(t);setView('graph');setWizard(false);setSelectedProblem(null);setSelectedStream('');setSelectedCategory('');setCategories([]);
   setStreams(t.id==='reference-longevity'?[]:await api<any[]>('/targets/'+t.id+'/streams'));
   setVersion(v=>v+1);
 };
 useEffect(()=>{refresh().then(d=>{if(!d.mine.length)setWizard(true)}).catch((e:any)=>setError(e.message))},[]);
 const refreshGraph=async()=>{if(current&&current.id!=='reference-longevity')setStreams(await api('/targets/'+current.id+'/streams'));setVersion(v=>v+1)};
 const fetchCategories=async(sid:string)=>{if(!current)return;const r=await api<Elements>('/targets/'+current.id+'/expand/'+encodeURIComponent(sid));setCategories(r.nodes.map(n=>n.data));setSelectedStream(sid);setSelectedCategory('')};
 const saveWizard=()=>run(async()=>{
   const streams=suggestions.filter(x=>x.selected&&x.name.trim().length>=3).map(({name,description})=>({name,description}));
   const created=await post<Target>('/targets/with-streams',{...form,streams});
   await refresh();await open(created);setNotice(`Target created with ${streams.length} research streams.`);setSuggestions([]);
 });
 const copyCurrent=()=>{if(!current)return;run(async()=>{
   const copied=await post<Target & {problemCount:number,streamCount:number}>('/targets/'+current.id+'/copy');
   await refresh();await open(copied);setNotice(`Private editable copy created: ${copied.streamCount} streams and ${copied.problemCount} problems.`);
 })};
 const owned=Boolean(current?.ownerId && directory?.mine.some(t=>t.id===current.id));
 return <div className="app target-app">
  <aside className="sidebar target-sidebar"><div className="brand"><span className="brandmark"><Network size={19}/></span><div><strong>PROBLEM <b>EXPLORER</b></strong><small>Research workspace</small></div></div>
   <div className="side-heading">WORKSPACE</div>
   <button className={'nav '+(view==='graph'?'on':'')} onClick={()=>setView('graph')}><Network size={16}/> Knowledge graph</button>
   <button className={'nav '+(view==='directory'?'on':'')} onClick={()=>setView('directory')}><BookOpen size={16}/> Target directory</button>
   <button className="nav" onClick={()=>{setWizard(true);setSuggestions([])}}><Plus size={16}/> Create target</button>
   <div className="side-heading">MY TARGETS</div>
   {directory?.mine.map(t=><button className={'stream '+(current?.id===t.id?'on':'')} key={t.id} onClick={()=>run(()=>open(t))}>{t.name}<ChevronRight size={13}/></button>)}
   {!directory?.mine.length&&<small className="target-sidebar-empty">No targets yet</small>}
   <div className="side-heading">SHARED RESEARCH</div>
   <button className={'stream '+(current?.id==='reference-longevity'?'on':'')} onClick={()=>directory?.reference&&run(()=>open(directory.reference))}>Longevity library <ChevronRight size={13}/></button>
   {directory?.shared.map(t=><button className={'stream '+(current?.id===t.id?'on':'')} key={t.id} onClick={()=>run(()=>open(t))}>{t.name}<ChevronRight size={13}/></button>)}
   <div className="side-bottom">Private workspaces · Shared targets are read-only until copied.</div>
  </aside>
  <main className="main target-main">
   <header className="topbar"><div><h1>{current?current.name:'Problem Explorer'}</h1><p>{current?(current.description||'Research target'):'Choose a target or create your own research environment'}</p></div><span className="status"><span className="dot"/>{current?(owned?'MY WORKSPACE':'SHARED / READ ONLY'):'NO TARGET SELECTED'}</span></header>
   {error&&<div className="alert bad">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
   {notice&&<div className="alert good">{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}
   {view==='directory'?<section className="panel target-directory-panel"><h2>Target directory</h2><p className="muted">Open a shared target to explore its hierarchy, or copy it to your personal workspace to edit.</p><h3>My targets</h3>{directory?.mine.map(t=><div className="target-entry" key={t.id}><button className="secondary" onClick={()=>run(()=>open(t))}>{t.name}<ChevronRight size={14}/></button><small>{t.description}</small></div>)}<h3>Shared targets</h3>{[...(directory?.shared||[]),...(directory?.reference?[directory.reference]:[])].map(t=><div className="target-entry" key={t.id}><button className="secondary" onClick={()=>run(()=>open(t))}>{t.name}<ChevronRight size={14}/></button><button className="ghost" disabled={busy} onClick={()=>run(async()=>{const copied=await post<Target>('/targets/'+t.id+'/copy');await refresh();await open(copied);setNotice('Created editable private copy.')})}>Copy to my workspace</button><small>{t.description}</small></div>)}</section>:
   <div className="target-canvas-layout"><div className="target-graph-wrap"><Graph key={(current?.id||'empty')+version} targetId={current?.id||'__empty__'} onProblem={id=>{if(!current)return;run(async()=>setSelectedProblem(await api('/targets/'+current.id+'/problems/'+id)))}}/>
    {!current&&<div className="target-empty-hint">Start by creating or selecting a research target.</div>}</div>
    <section className="panel target-context"><h3>{current?'Target workspace':'Getting started'}</h3>
     {!current?<><p className="muted">A target is the central node. Research streams branch outward into categories and problems.</p><button className="primary" onClick={()=>setWizard(true)}>Create target</button><button className="secondary" onClick={()=>setView('directory')}>Browse shared targets</button></>:
     <><p className="muted">{owned?'This is your editable research workspace.':'This is a read-only shared target.'}</p>
      {!owned&&<button className="primary" disabled={busy} onClick={copyCurrent}><FolderPlus size={16}/> Copy into my workspace</button>}
      {owned&&<div className="button-row target-buttons"><button className="ghost small" onClick={()=>run(async()=>{if(!current)return;const name=prompt('Target name',current.name);if(!name)return;const description=prompt('Scope',current.description)||'';await api('/targets/'+current.id,{method:'PATCH',body:JSON.stringify({name,description,shared:current.shared})});setCurrent({...current,name,description});await refresh()})}>Edit target</button><button className="ghost small" onClick={()=>run(async()=>{await api('/targets/'+current!.id,{method:'PATCH',body:JSON.stringify({name:current!.name,description:current!.description,shared:!current!.shared})});setCurrent({...current!,shared:!current!.shared});await refresh()})}>{current.shared?'Make private':'Share target'}</button><button className="ghost small" onClick={()=>run(async()=>{if(!confirm('Delete this target and its research? This cannot be undone.'))return;await api('/targets/'+current!.id,{method:'DELETE'});setCurrent(null);await refresh()})}>Delete</button></div>}
      {selectedProblem?<><button className="ghost small" onClick={()=>setSelectedProblem(null)}>← Back</button><h3>Problem #{selectedProblem.id}</h3><p>{selectedProblem.description}</p>{owned&&<div className="button-row"><button className="ghost small" onClick={()=>run(async()=>{const statement=prompt('Problem statement',selectedProblem.description);if(!statement)return;await api('/targets/'+current!.id+'/problems/'+selectedProblem.id,{method:'PATCH',body:JSON.stringify({statement})});setSelectedProblem({...selectedProblem,description:statement});await refreshGraph()})}>Edit</button><button className="ghost small" onClick={()=>run(async()=>{if(!confirm('Delete problem?'))return;await api('/targets/'+current!.id+'/problems/'+selectedProblem.id,{method:'DELETE'});setSelectedProblem(null);await refreshGraph()})}>Delete</button></div>}</>:
      <><h3>Research streams</h3>{streams.map(t=><button className={'stream '+(selectedStream===t.id?'on':'')} key={t.id} onClick={()=>run(()=>fetchCategories(t.id))}>{t.name}<ChevronRight size={13}/></button>)}
      {owned&&<><label className="field">Add stream<input value={newStream} onChange={e=>setNewStream(e.target.value)} placeholder="Research stream name"/></label><label className="field">Scope<textarea rows={2} value={newDescription} onChange={e=>setNewDescription(e.target.value)}/></label><button className="secondary" disabled={busy||newStream.trim().length<3} onClick={()=>run(async()=>{await post('/targets/'+current!.id+'/streams',{name:newStream,description:newDescription});setNewStream('');setNewDescription('');await refreshGraph()})}>Add stream</button></>}
      {selectedStream&&owned&&<><h3>Categories</h3>{categories.map(c=><button className={'stream '+(selectedCategory===c.id?'on':'')} key={c.id} onClick={()=>setSelectedCategory(c.id)}>{c.label}</button>)}<label className="field">New category<input value={newCategory} onChange={e=>setNewCategory(e.target.value)}/></label><button className="secondary" disabled={busy||newCategory.trim().length<3} onClick={()=>run(async()=>{await post('/targets/'+current!.id+'/streams/'+selectedStream+'/categories',{name:newCategory});setNewCategory('');await fetchCategories(selectedStream);await refreshGraph()})}>Add category</button></>}
      {selectedCategory&&owned&&<><h3>Add problem</h3><textarea rows={3} value={newProblem} onChange={e=>setNewProblem(e.target.value)} placeholder="Describe an unmet need"/><button className="secondary" disabled={busy||newProblem.trim().length<20} onClick={()=>run(async()=>{await post('/targets/'+current!.id+'/categories/'+encodeURIComponent(selectedCategory)+'/problems',{statement:newProblem});setNewProblem('');await refreshGraph()})}>Save problem</button></>}
      </>}
     </>}
    </section></div>}
   {wizard&&<div className="wizard-backdrop" role="presentation"><section className="wizard-card" role="dialog" aria-modal="true" aria-label="Create research target"><div className="wizard-head"><div><h2>Create research target</h2><p className="muted">Define the center node, then select or customize its research streams.</p></div><button className="ghost" onClick={()=>setWizard(false)}>Close</button></div>
     <label className="field">Target name<input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Human-centered robotics for longevity"/></label>
     <label className="field">Research scope<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What issue, population or context will this target explore?"/></label>
     <label className="field">Initial research depth<select value={form.detail} onChange={e=>setForm({...form,detail:e.target.value})}><option value="outline">Outline · 3 streams</option><option value="standard">Standard · 5 streams</option><option value="detailed">Detailed · 7 streams</option></select></label>
     <button className="secondary" disabled={busy||form.name.trim().length<3} onClick={()=>run(async()=>{const data=await post<{streams:{name:string,description:string}[]}>('/targets/suggest-streams',form);setSuggestions(data.streams.map(x=>({...x,selected:true})))})}><Sparkles size={15}/>{busy?'Working…':'AI suggest research streams'}</button>
     {suggestions.length>0&&<><h3>Review suggested research streams</h3><p className="muted">Unverified AI draft. Select, rename, or remove streams before creating the graph.</p><div className="wizard-streams">{suggestions.map((s,i)=><div className="wizard-stream" key={i}><input type="checkbox" checked={s.selected} onChange={e=>setSuggestions(v=>v.map((x,j)=>j===i?{...x,selected:e.target.checked}:x))} aria-label={'Select '+s.name}/><div><input value={s.name} onChange={e=>setSuggestions(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/><textarea rows={2} value={s.description} onChange={e=>setSuggestions(v=>v.map((x,j)=>j===i?{...x,description:e.target.value}:x))}/></div></div>)}</div></>}
     <div className="button-row"><input placeholder="Add your own research stream" value={manualStream} onChange={e=>setManualStream(e.target.value)}/><button className="secondary" disabled={manualStream.trim().length<3} onClick={()=>{setSuggestions(v=>[...v,{name:manualStream.trim(),description:'',selected:true}]);setManualStream('')}}>Add</button></div>
     <label className="field"><input type="checkbox" checked={form.shared} onChange={e=>setForm({...form,shared:e.target.checked})}/> Share read-only in target directory</label>
     <div className="wizard-actions"><button className="ghost" onClick={()=>setWizard(false)}>Cancel</button><button className="primary" disabled={busy||form.name.trim().length<3||!suggestions.some(x=>x.selected&&x.name.trim().length>=3)} onClick={saveWizard}>Create target and graph →</button></div>
    </section></div>}
  </main>
 </div>;
}

function Root(){
 const [account,setAccount]=useState<Account|null>(null);const [ready,setReady]=useState(false);const [adminView,setAdminView]=useState(false);const [workspaceMode,setWorkspaceMode]=useState<'targets'|'legacy'>('targets');
 useEffect(()=>{api<{user:Account|null}>('/auth/me').then(r=>setAccount(r.user)).finally(()=>setReady(true))},[]);
 if(!ready)return <div className="auth-screen"><span>Loading Problem Explorer…</span></div>;
 if(!account)return <AuthGate onAuthenticated={setAccount}/>;
 return <><div className="account-strip"><span>{account.name} · Private workspace</span><button onClick={()=>{setAdminView(false);setWorkspaceMode(m=>m==='targets'?'legacy':'targets')}}>{workspaceMode==='targets'?'Research, concepts & matching':'Target workspace'}</button>{account.role==='admin'&&<button onClick={()=>setAdminView(v=>!v)}>{adminView?'Back to workspace':'Administration'}</button>}<button onClick={async()=>{await post('/auth/logout');setAccount(null)}}>Sign out</button></div>{adminView&&account.role==='admin'?<AdminConsole/>:<><div style={{display:workspaceMode==='targets'?'block':'none'}}><TargetHome/></div><div style={{display:workspaceMode==='legacy'?'block':'none'}}><div className="alert" style={{margin:'12px 20px'}}><strong>Legacy research tools</strong> — Research, AI discovery, problem matching, concepts and evaluation are restored here. These endpoints still use the original/shared research context and are <strong>not yet scoped to the selected target</strong>. Do not use them for confidential target-specific research until integration is complete.</div><App/></div></>}</>;
}
function App(){
 const [tab,setTab]=useState<'explore'|'research'|'solutions'|'evaluation'|'discover'|'streams'>('explore');
 const [stats,setStats]=useState<any>(null);const [q,setQ]=useState('');const [stream,setStream]=useState('');const [problems,setProblems]=useState<Problem[]>([]);const [selected,setSelected]=useState<Problem|null>(null);
 const [searchMode,setSearchMode]=useState('hybrid'); const [searchStatus,setSearchStatus]=useState(''); const [topic,setTopic]=useState('Barriers to aging independently not captured in the current library'); const [discovered,setDiscovered]=useState<any[]>([]); const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [manualStatement,setManualStatement]=useState(''); const [manualCategory,setManualCategory]=useState('');const [hierarchy,setHierarchy]=useState<any[]>([]);
 const [busy,setBusy]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');const [focus,setFocus]=useState('prevalence, severity, populations affected, existing alternatives, evidence gaps');
 const [concepts,setConcepts]=useState<ConceptDraft[]>([]);const [conceptDirection,setConceptDirection]=useState('');const [conceptCount,setConceptCount]=useState(4);const [conceptEdits,setConceptEdits]=useState<Record<string,{name:string,description:string}>>({});
 const [sols,setSols]=useState<Sol[]>([]);const [solution,setSolution]=useState<Sol|null>(null);const [name,setName]=useState('');const [desc,setDesc]=useState(''); const [evalData,setEvalData]=useState<Eval|null>(null);
 const run=async(k:string,fn:()=>Promise<void>)=>{setBusy(k);setError('');setNotice('');try{await fn()}catch(e:any){setError(e.message)}finally{setBusy('')}};
 const reloadStats=()=>api('/stats').then(setStats).catch(e=>setError(e.message));
 const loadProblems=()=>{if(q.trim().length>=3)return post('/search',{text:q,stream,mode:searchMode}).then((d:any)=>{setProblems(d.results);setSearchStatus(d.mode+(d.indexCount!==undefined?` · ${d.indexCount} embedded`:'') )}).catch((e:any)=>setError(e.message));return api<Problem[]>('/problems?'+new URLSearchParams({q:'',stream,limit:'2000'})).then(d=>{setProblems(d);setSearchStatus('');}).catch(e=>setError(e.message))};
 const loadDiscoveries=()=>api<any[]>('/discoveries').then(setDiscovered).catch((e:any)=>setError(e.message));
 const loadSols=()=>api<Sol[]>('/solutions').then(setSols).catch(e=>setError(e.message));
 const selectProblem=(id:number)=>run('problem',async()=>{const p=await api<Problem>('/problems/'+id);setSelected(p);setConcepts(await api<ConceptDraft[]>('/problems/'+id+'/concepts'));setTab('research')});
 const selectSol=(id:string)=>run('solution',async()=>{const s=await api<Sol>('/solutions/'+id);setSolution(s);setEvalData(s.evaluations?.length?JSON.parse(s.evaluations[0].payload):null);setTab('solutions')});
 useEffect(()=>{reloadStats();loadSols();loadDiscoveries();api<any[]>('/hierarchy').then(setHierarchy).catch(e=>setError(e.message))},[]);
 useEffect(()=>{const t=setTimeout(loadProblems,200);return()=>clearTimeout(t)},[q,stream,searchMode]);
 return <div className="app"><aside className="sidebar"><div className="brand"><div className="brandmark"><Network size={23}/></div><div><strong>PROBLEM <b>EXPLORER</b></strong><small>Research & opportunity intelligence</small></div></div><div className="side-heading">WORKSPACES</div>
  {([{k:'explore',label:'Explore graph',ico:Network},{k:'research',label:'Problem research',ico:BookOpen},{k:'solutions',label:'Solutions & matching',ico:Lightbulb},{k:'evaluation',label:'Evaluation',ico:BarChart3},{k:'discover',label:'Discover problems',ico:Sparkles},{k:'streams',label:'Create research stream',ico:Plus}] as const).map(x=><button className={'nav '+(tab===x.k?'on':'')} key={x.k} onClick={()=>setTab(x.k)}><x.ico size={17}/>{x.label}</button>)}
  <div className="side-heading" style={{marginTop:28}}>PROBLEM STREAMS</div>
  <button className={'stream '+(!stream?'on':'')} onClick={()=>{setStream('');setTab('explore')}}>All streams <span>{stats?.problems||498}</span></button>
  {stats?.streams?.map((x:any)=><button key={x.id} className={'stream '+(stream===x.id?'on':'')} onClick={()=>{setStream(x.id);setTab('explore')}}>{x.name.split('—').slice(-1)[0]?.trim()} <span>{x.count}</span></button>)}
  <div className="side-bottom">v0.3.3 · research platform<br/>AI-generated findings require review</div>
 </aside><main className="main"><header className="topbar"><div><h1>{tab==='explore'?'Problem explorer':tab==='research'?'Research workspace':tab==='solutions'?'Solution matching':tab==='evaluation'?'Concept evaluation':'Problem discovery'}</h1><p>{tab==='explore'?'Navigate the problem landscape':tab==='research'?'Evidence-led research with traceable sources':tab==='solutions'?'Discover possible problem–solution relationships':tab==='evaluation'?'Five-factor, evidence-aware scoring':'Evidence-led discovery and duplicate review'}</p></div><div className="status"><span className="dot"/> LOCAL INSTANCE</div></header>
  {error&&<div className="alert bad"><strong>Error:</strong> {error} <button onClick={()=>setError('')}>Dismiss</button></div>}
  {notice&&<div className="alert good">{notice} <button onClick={()=>setNotice('')}>Dismiss</button></div>}
  <div className="metrics"><div><strong>{stats?.problems??'—'}</strong><small>Problem statements</small></div><div><strong>{stats?.streams?.length??'—'}</strong><small>Research streams</small></div><div><strong>{stats?.discovered??0}</strong><small>Approved discoveries</small></div><div><strong>{stats?.solutions??0}</strong><small>Saved concepts</small></div></div>
  {tab==='explore'&&<div className="split"><Graph onProblem={selectProblem}/><section className="list-panel"><div className="pane-title"><span><Search size={17}/> Problem library</span><span className="mini">{problems.length} results</span></div><div className="searchbox"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by meaning, activity, barrier or phrase…"/></div><div className="button-row" style={{padding:'8px 12px',alignItems:'center'}}><select value={searchMode} onChange={e=>setSearchMode(e.target.value)}><option value="hybrid">Hybrid search</option><option value="semantic">Semantic search</option><option value="exact">Exact phrase</option></select><span className="mini">{searchStatus}</span></div><div className="problem-list">{problems.map(p=><button className="problem-item" key={p.id} onClick={()=>selectProblem(p.id)}><span className="num">#{String(p.id).padStart(3,'0')}</span><span>{p.description}<small>{p.category}</small></span><ChevronRight size={15}/></button>)}</div></section></div>}
  {tab==='streams'&&<WorkspaceCreator onCreated={()=>{reloadStats();api<any[]>('/hierarchy').then(setHierarchy)}}/>}
  {tab==='discover'&&<div className="content"><div className="panel"><div className="pane-title"><span><Sparkles size={17}/> AI-assisted problem discovery</span><span className="mini">Review before adding</span></div><h2>Add a distinct problem</h2><p className="muted">Submit a clearly framed problem that is not already covered. Existing problems are checked for duplicates. Semantic indexing improves matching but is not required to add a problem.</p><label className="field">Problem statement<textarea rows={3} value={manualStatement} onChange={e=>setManualStatement(e.target.value)} placeholder="Describe a specific unmet need or barrier…"/></label><label className="field">Category<select value={manualCategory} onChange={e=>setManualCategory(e.target.value)}><option value="">Choose a category</option>{hierarchy.map(h=><option key={h.categoryId} value={h.categoryId}>{h.streamId} · {h.category}</option>)}</select></label><button className="secondary" disabled={!!busy||manualStatement.trim().length<20||!manualCategory} onClick={()=>run('manual',async()=>{const o=await post('/problems',{statement:manualStatement,categoryId:manualCategory});setNotice(`Added distinct problem #${o.id}`);setManualStatement('');await reloadStats();await loadProblems()})}>{busy==='manual'?'Checking uniqueness…':'Add distinct problem'}</button><div className="divider"/><h2>Discover gaps in the problem library</h2><p className="muted">Research a topic, review candidates and similar problems, and only approve genuinely distinct problems. Proposed discoveries are saved in Neo4j even when rejected or merged, but only approved problems enter searches and concept matching.</p><label className="field">Research topic<textarea rows={3} value={topic} onChange={e=>setTopic(e.target.value)}/></label><div className="button-row"><span className="mini">Semantic embeddings are generated automatically in the background, subject to your usage allowance.</span><button className="primary" disabled={!!busy||topic.trim().length<10} onClick={()=>run('discover',async()=>{const o=await post('/discoveries/search',{topic});await loadDiscoveries();setNotice(`Saved ${o.count} review candidates; excluded ${o.excludedSimilar??0} similar/duplicate statements. Research gaps: ${(o.gaps||[]).join('; ')}`)})}><Sparkles size={16}/>{busy==='discover'?'Researching…':'Find new problems'}</button></div><div className="divider"/><h3>Discovery review queue <span className="pill">{discovered.filter(d=>d.status==='pending_review'||d.status==='duplicate_candidate').length} pending</span></h3>{discovered.length===0?<p className="empty">No discoveries yet. Research a topic to find candidate problems.</p>:discovered.map(d=><div className="finding" key={d.id}><div className="row"><span className="pill">{d.status}</span><span className="mini">{d.streamId} · {d.categoryId}</span></div><label className="field">Problem statement<textarea rows={2} disabled={!['pending_review','duplicate_candidate'].includes(d.status)} value={drafts[d.id]??d.statement} onChange={e=>setDrafts(v=>({...v,[d.id]:e.target.value}))}/></label><p className="muted">{d.rationale}</p>{d.evidenceUrls?.map((u:string)=><a key={u} href={u} target="_blank" rel="noreferrer">{u} <ExternalLink size={12}/></a>)}{(()=>{let m:any[]=[];try{m=JSON.parse(d.neighborsJson||'{}').matches||[]}catch{}return <details><summary>Most similar existing problems</summary>{m.slice(0,5).map(x=><p key={x.id}>#{x.id}: {x.description} · semantic {x.semanticSimilarity??'—'}</p>)}</details>})()}{['pending_review','duplicate_candidate'].includes(d.status)&&<div className="button-row"><button className="primary" disabled={!!busy} onClick={()=>run('approve',async()=>{const o=await post(`/discoveries/${d.id}/approve`,{statement:drafts[d.id]??d.statement});setNotice(`Approved new problem #${o.id}`);await loadDiscoveries();await reloadStats();await loadProblems()})}>Approve distinct problem</button><button className="secondary" disabled={!!busy} onClick={()=>run('reject',async()=>{await post(`/discoveries/${d.id}/reject`);await loadDiscoveries()})}>Reject / duplicate</button></div>}</div>)}</div></div>}
  {tab==='research'&&<div className="content"><div className="panel"><div className="pane-title"><span><BookOpen size={17}/> Problem record</span>{selected&&<span className="mini">#{String(selected.id).padStart(3,'0')}</span>}</div>{selected?<><h2>{selected.description}</h2><p className="muted">{selected.stream} · {selected.category}</p><div className="divider"/><h3>Research this problem</h3><p className="muted">An OpenAI web-search pass followed by validated structured extraction. Findings are stored as <em>needs review</em>.</p><label className="field">Research focus<textarea value={focus} rows={2} onChange={e=>setFocus(e.target.value)}/></label><button disabled={!!busy} className="primary" onClick={()=>run('research',async()=>{const r=await post(`/problems/${selected.id}/research`,{focus});setNotice(`Saved ${r.saved} sourced findings. Please review sources.`);setSelected(await api('/problems/'+selected.id))})}><FlaskConical size={16}/>{busy==='research'?'Researching (may take a minute)…':'Research with OpenAI'}</button><div className="divider"/><h3>Generate concepts for this problem</h3><p className="muted">Create distinct concept hypotheses from this problem and available evidence. Drafts are saved locally but are not automatically added to Solutions.</p><label className="field">Optional design direction<textarea rows={2} value={conceptDirection} onChange={e=>setConceptDirection(e.target.value)} placeholder="e.g. affordable mechanical solutions, low maintenance, dignified user control"/></label><div className="button-row"><select value={conceptCount} onChange={e=>setConceptCount(Number(e.target.value))}>{[2,3,4,5,6].map(n=><option value={n} key={n}>{n} concepts</option>)}</select><button className="primary" disabled={!!busy} onClick={()=>run('generate',async()=>{const out=await post(`/problems/${selected.id}/concepts/generate`,{count:conceptCount,direction:conceptDirection});setConcepts(await api(`/problems/${selected.id}/concepts`));setNotice(`Generated ${out.concepts.length} concept drafts; review and save only the promising ones.`)})}><Sparkles size={16}/>{busy==='generate'?'Generating…':'Generate concepts'}</button></div><h3>Generated drafts <span className="pill">{concepts.length}</span></h3>{concepts.map(c=><div className="finding" key={c.id}><div className="row"><span className="pill">{c.status}</span><span className="mini">{c.details?.approach}</span></div><label className="field">Concept name<input disabled={c.status==='saved'} value={conceptEdits[c.id]?.name??c.name} onChange={e=>setConceptEdits(v=>({...v,[c.id]:{name:e.target.value,description:v[c.id]?.description??c.description}}))}/></label><label className="field">Concept description<textarea rows={3} disabled={c.status==='saved'} value={conceptEdits[c.id]?.description??c.description} onChange={e=>setConceptEdits(v=>({...v,[c.id]:{name:v[c.id]?.name??c.name,description:e.target.value}}))}/></label><details><summary>Assumptions, risks and research gaps</summary><p><strong>Mechanism:</strong> {c.details?.mechanism}</p><p><strong>Potential differentiation:</strong> {c.details?.differentiation_hypothesis}</p>{(['assumptions','potential_risks','feasibility_questions','evidence_gaps'] as const).map(k=><div key={k}><strong>{k.replaceAll('_',' ')}</strong><ul>{(c.details?.[k]||[]).map((a:string,i:number)=><li key={i}>{a}</li>)}</ul></div>)}</details>{c.status==='saved'&&c.solutionId?<button className="secondary" onClick={()=>selectSol(c.solutionId!)}>Open saved solution →</button>:<button className="primary" disabled={!!busy} onClick={()=>run('saveConcept',async()=>{const edit=conceptEdits[c.id]??{name:c.name,description:c.description};const s=await post(`/concept-drafts/${c.id}/save`,edit);setConcepts(await api(`/problems/${selected.id}/concepts`));await loadSols();await reloadStats();setNotice(`Saved ${s.name} to Solutions. Run Match to library, then Evaluate.`);await selectSol(s.id)})}><Plus size={16}/> Add to Solutions</button>}</div>)}<div className="divider"/><h3>Saved research findings <span className="pill">{selected.findings?.length||0}</span></h3>{selected.findings?.length?selected.findings.map(f=><div className="finding" key={f.id}><div className="row"><span className="pill">{f.reviewStatus||'needs_review'}</span><span className="mini">{f.confidence} confidence</span></div><p>{f.claim}</p>{f.statistic&&<strong>{f.statistic}</strong>}{f.limitations&&<small>Limitations: {f.limitations}</small>}{f.url&&<a href={f.url} target="_blank" rel="noreferrer">{f.title||f.url} <ExternalLink size={12}/></a>}</div>):<p className="empty">No research saved yet. Evidence should never be assumed from the problem text alone.</p>}</>:<div className="empty">Select a problem from Explore graph to view its record and commission research.</div>}</div></div>}
  {tab==='solutions'&&<div className="solution-layout"><div className="panel"><div className="pane-title"><span><Plus size={17}/> New concept</span></div><label className="field">Concept name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., Portable object carrier"/></label><label className="field">Description<textarea rows={6} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Describe intended user, environment, main capabilities, assumptions and limitations…"/></label><button className="primary" disabled={!!busy||name.trim().length<2||desc.trim().length<15} onClick={()=>run('create',async()=>{const s=await post('/solutions',{name,description:desc});setName('');setDesc('');await loadSols();await reloadStats();await selectSol(s.id)})}><Plus size={16}/> Save concept</button><div className="divider"/><h3>Saved concepts</h3>{sols.length?sols.map(s=><button key={s.id} className={'saved-item '+(solution?.id===s.id?'active':'')} onClick={()=>selectSol(s.id)}>{s.name}<ChevronRight size={15}/></button>):<p className="empty">No concepts yet</p>}</div><div className="panel"><div className="pane-title"><span><Lightbulb size={17}/> Problem matching</span></div>{solution?<><h2>{solution.name}</h2><p className="muted">{solution.description}</p><div className="button-row"><button className="primary" disabled={!!busy} onClick={()=>run('match',async()=>{const out=await post(`/solutions/${solution.id}/match`);setNotice(`Found ${out.matches.length} potential problem relationships.`);setSolution(await api(`/solutions/${solution.id}`))})}><Network size={16}/>{busy==='match'?'Matching…':'Match to library'}</button><button className="secondary" onClick={()=>setTab('evaluation')}><BarChart3 size={16}/> Evaluate</button></div><div className="divider"/><h3>Potential problem matches <span className="pill">{solution.matches?.length||0}</span></h3>{solution.matches?.length?solution.matches.map(m=><div className="match" key={m.problemId}><div className="row"><strong>#{m.problemId} · {m.description}</strong><span className="score">{m.relevance}% relevance</span></div><p>{m.rationale}</p><span className="mini">{m.relationship} · {m.confidence} confidence · not proven effectiveness</span><button className="text-link" onClick={()=>selectProblem(m.problemId)}>Inspect problem →</button></div>):<p className="empty">Run matching to rank potential relationships. Matches are hypotheses until evaluated.</p>}</>:<p className="empty">Create or select a solution to match it against the problem library.</p>}</div></div>}
  {tab==='evaluation'&&<div className="content"><div className="panel"><div className="pane-title"><span><BarChart3 size={17}/> Research-connected concept evaluation</span></div><label className="field">Select concept<select value={solution?.id||''} onChange={e=>{if(e.target.value)selectSol(e.target.value).then(()=>setTab('evaluation'))}}><option value="">Choose concept</option>{sols.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>{solution?<><h2>{solution.name}</h2><p className="muted">{solution.matches?.length||0} linked problem matches</p><button className="primary" disabled={!!busy} onClick={()=>run('evaluate',async()=>{const r=await post(`/solutions/${solution.id}/evaluate`);setEvalData(r.data);setNotice(`Saved evaluation; ${r.evidenceCount} research claims available.`);setSolution(await api(`/solutions/${solution.id}`))})}>{busy==='evaluate'?'Evaluating…':'Generate structured evaluation'}</button>{evalData?<><div className="evalchart"><ResponsiveContainer width="100%" height={280}><RadarChart data={evalData.factors.map(f=>({factor:f.factor[0].toUpperCase()+f.factor.slice(1),score:f.score||0}))}><PolarGrid/><PolarAngleAxis dataKey="factor" tick={{fill:'#a2b1bb',fontSize:12}}/><Tooltip/><Radar dataKey="score" stroke="#8fc4ae" fill="#8fc4ae" fillOpacity={0.25} /></RadarChart></ResponsiveContainer></div><p className="muted">{evalData.summary}</p><div className="factor-grid">{evalData.factors.map(f=><div className="factor" key={f.factor}><div className="row"><strong>{f.factor}</strong><span className="score">{f.score===null?'Unrated':f.score+'/5'}</span></div><small>{f.confidence} confidence</small><p>{f.rationale}</p>{f.unanswered_questions.length>0&&<details><summary>Open questions ({f.unanswered_questions.length})</summary>{f.unanswered_questions.map((q,i)=><p key={i}>{q}</p>)}</details>}</div>)}</div><h3>Key assumptions</h3><ul>{evalData.key_assumptions.map((x,i)=><li key={i}>{x}</li>)}</ul><h3>Risks</h3><ul>{evalData.risks.map((x,i)=><li key={i}>{x}</li>)}</ul><h3>Next research</h3><ul>{evalData.next_research.map((x,i)=><li key={i}>{x}</li>)}</ul></>:<p className="empty">No assessment yet. Missing evidence should produce unknown ratings, not invented precision.</p>}</>:<p className="empty">Create a concept in the Solutions workspace first.</p>}</div></div>}
  <footer>PROBLEM EXPLORER · Structured research is provisional until sources are manually reviewed. Do not use as medical guidance.</footer>
 </main></div>
}
createRoot(document.getElementById('root')!).render(<Root/>);
