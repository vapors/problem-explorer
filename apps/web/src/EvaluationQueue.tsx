import {useEffect,useState,useRef} from 'react';
import {RefreshCw,GitCompareArrows} from 'lucide-react';

type Job={jobId:string;state:string;stage:string;evaluationId:string|null;attempts:number;error:string|null;createdAt:string};
type Snapshot={id:string;mode:string;method:string;summary:string;scoreMax:number;scores:Record<string,number|null>;sources:string[]};
const factors=['desirability','feasibility','viability','impact','coverage'];
async function api<T>(url:string,body?:object):Promise<T>{
 const r=await fetch('/api'+url,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!r.ok){const error=await r.json().catch(()=>({}));throw new Error(error.detail||r.statusText)}return r.json();
}
export default function EvaluationQueue({targetId,solutionId,mode,onSaved,readOnly}:{targetId:string,solutionId:string,
 mode:'evidence'|'exploratory',onSaved:()=>Promise<void>,readOnly:boolean}){
 const base=`/targets/${encodeURIComponent(targetId)}`;const path=`${base}/solutions/${encodeURIComponent(solutionId)}`;
 const [jobs,setJobs]=useState<Job[]>([]);const [current,setCurrent]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [snapshots,setSnapshots]=useState<Snapshot[]>([]);
 const [before,setBefore]=useState('');const [after,setAfter]=useState('');
 const onSavedRef=useRef(onSaved);onSavedRef.current=onSaved;
 const reload=async()=>{
   const [list,hist]=await Promise.all([api<Job[]>(`${path}/evaluations/jobs`),api<{evaluations:Snapshot[]}>(`${path}/evaluations/compare`)]);
   setJobs(list);setSnapshots(hist.evaluations);
   setBefore(v=>v||hist.evaluations[1]?.id||'');setAfter(v=>v||hist.evaluations[0]?.id||'');
   return list;
 };
 useEffect(()=>{let mounted=true;
   Promise.all([api<Job[]>(`${path}/evaluations/jobs`),api<{evaluations:Snapshot[]}>(`${path}/evaluations/compare`)]).then(([list,hist])=>{
    if(!mounted)return;setJobs(list);setSnapshots(hist.evaluations);
    setBefore(hist.evaluations[1]?.id||'');setAfter(hist.evaluations[0]?.id||'');
    const active=list.find(j=>['queued','running','deferred'].includes(j.state));if(active)setCurrent(active.jobId);
   }).catch(e=>{if(mounted)setError(e.message)});
   return()=>{mounted=false};
 },[path]);
 useEffect(()=>{if(!current)return;let mounted=true;
   const poll=async()=>{
    try{const j=await api<Job>(`${base}/evaluations/jobs/${encodeURIComponent(current)}`);
     if(!mounted)return;setJobs(prev=>[j,...prev.filter(x=>x.jobId!==j.jobId)]);
     if(j.state==='done'){
       setCurrent(null);await onSavedRef.current();await reload();
     }else if(j.state==='failed')setCurrent(null);
    }catch(e:any){if(mounted)setError(e.message)}
   };
   void poll();const timer=window.setInterval(poll,4000);
   return()=>{mounted=false;window.clearInterval(timer)};
 },[current,base,path]);
 const start=async()=>{
   setBusy(true);setError('');try{const queued=await api<{jobId:string}>(`${path}/evaluations/queue`,{mode});
    setCurrent(queued.jobId);await reload();
   }catch(e:any){setError(e.message)}finally{setBusy(false)}
 };
 const first=snapshots.find(x=>x.id===before);const second=snapshots.find(x=>x.id===after);
 const active=jobs.find(j=>j.jobId===current);
 return <div className="evaluation-queue">
   <button className="primary" disabled={readOnly||busy||!!current} onClick={start}>
    {busy?'Queuing…':current?'Evaluation in progress…':`Start ${mode==='exploratory'?'exploratory':'evidence-based'} multi-agent evaluation`}</button>
   <p className="mini">Two AI requests are normally charged per completed evaluation (one numerical and one narrative agent). Jobs run separately from the graph and resume across server restarts.</p>
   {active&&<div role="status" className="eval-integrity-note"><RefreshCw size={14}/> Job {active.state} · {active.stage} · {active.attempts} attempt(s)
     {active.state==='deferred'&&<p>Daily allowance reached. The worker will resume on the next UTC day.</p>}</div>}
   {error&&<div role="alert" className="alert bad">{error}</div>}
   {(jobs.length>0||snapshots.length>0)&&<details className="eval-history"><summary>Evaluation job history · {jobs.length}</summary>
    {jobs.slice(0,12).map(j=><div className="onboarding-stream-row" key={j.jobId}><span>{j.createdAt} · {j.stage}</span><span>{j.state}</span>{j.error&&<small>{j.error}</small>}</div>)}
    {snapshots.length>0&&<section className="eval-compare"><h3><GitCompareArrows size={15}/> Historical evaluation comparisons</h3>
     <p className="mini">Read-only saved snapshots. Unrated stays unrated; legacy scales are normalized for comparison only.</p>
     <div className="eval-compare-selects"><label>Earlier<select value={before} onChange={e=>setBefore(e.target.value)}><option value="">Choose snapshot</option>{snapshots.map((s,i)=><option key={s.id} value={s.id}>{i+1}. {s.mode} · {s.method} · {s.id.slice(0,8)}</option>)}</select></label><label>Later<select value={after} onChange={e=>setAfter(e.target.value)}><option value="">Choose snapshot</option>{snapshots.map((s,i)=><option key={s.id} value={s.id}>{i+1}. {s.mode} · {s.method} · {s.id.slice(0,8)}</option>)}</select></label></div>
     {first&&second&&<table className="eval-comparison-table"><thead><tr><th>Factor</th><th>Earlier</th><th>Later</th><th>Change</th></tr></thead><tbody>{factors.map(f=>{
       const a=first.scores[f],b=second.scores[f];const valid=a!=null&&b!=null;
       return <tr key={f}><td>{f}</td><td>{a==null?'Unrated':`${a}/10`}</td><td>{b==null?'Unrated':`${b}/10`}</td><td>{valid?(b-a>0?'+':'')+(b-a).toFixed(1):'—'}</td></tr>;
     })}</tbody></table>}
   </section>}
   </details>}
 </div>;
}
