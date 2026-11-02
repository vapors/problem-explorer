import {useEffect, useMemo, useState} from 'react';
import {RefreshCw, ShieldCheck} from 'lucide-react';
import {useTerminology} from './contexts/TerminologyContext';

export type SignalNode = {
  id:string; graphId:string; type:'target'|'stream'|'problem'; name:string;
  enabled:'inherit'|'on'|'off'; sourceMode:'inherit'|'custom'; sourceUrls:string[];
  effectiveEnabled:boolean; effectiveSourceUrls:string[];
  automatedSentiment:number|null; userOverriddenSentiment:number|null;
  isOverrideActive:boolean; effectiveScore:number|null; effectiveSource:string;
  observationCount:number;
};
type Candidate={id:string;sourceUrl:string;sourceTitle:string;excerpt:string;sourceFeed:string;collectedAt:string};
export type Observation = {
  id:string; sourceUrl:string; sourceTitle:string; summary:string; context:string;
  metric:'unmet_need'|'polarity'; factor:string; score:number;
  sampleSize:number|null; reviewStatus:'needs_review'|'reviewed'; createdAt:string;
};
type Api = <T=unknown>(url:string,init?:RequestInit)=>Promise<T>;
const FACTORS=['overall','desirability','feasibility','viability','impact','coverage'];

export default function SignalConfiguration({targetId, api, changed}: {
  targetId:string|null; api:Api; changed:()=>void;
}) {
  const {getLabel}=useTerminology();
  const [nodes,setNodes]=useState<SignalNode[]>([]);
  const [selected,setSelected]=useState('');
  const [observations,setObservations]=useState<Observation[]>([]);
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [feedUrl,setFeedUrl]=useState('');
  const [rights,setRights]=useState(false);
  const [enabled,setEnabled]=useState<'on'|'off'|'inherit'>('inherit');
  const [sourceMode,setSourceMode]=useState<'inherit'|'custom'>('inherit');
  const [urlText,setUrlText]=useState('');
  const [overrideActive,setOverrideActive]=useState(false);
  const [overrideValue,setOverrideValue]=useState(5);
  const [reason,setReason]=useState('');
  const [url,setUrl]=useState('');
  const [title,setTitle]=useState('');
  const [summary,setSummary]=useState('');
  const [context,setContext]=useState('');
  const [metric,setMetric]=useState<'unmet_need'|'polarity'>('unmet_need');
  const [factor,setFactor]=useState('overall');
  const [score,setScore]=useState(5);
  const [sampleSize,setSampleSize]=useState('');
  const [reviewStatus,setReviewStatus]=useState<'needs_review'|'reviewed'>('needs_review');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const node=useMemo(()=>nodes.find(n=>`${n.type}:${n.id}`===selected),[nodes,selected]);
  const path=targetId?`/targets/${encodeURIComponent(targetId)}/signals`:'';
  const nodePath=node?`${path}/nodes/${node.type}/${encodeURIComponent(node.id)}`:'';
  const refresh=async()=>{
    if(!path)return;
    const response=await api<{nodes:SignalNode[]}>(path+'/nodes');
    setNodes(response.nodes);
    setSelected(prev=>response.nodes.some(n=>`${n.type}:${n.id}`===prev)?prev:
      response.nodes.length?`${response.nodes[0].type}:${response.nodes[0].id}`:'');
  };
  useEffect(()=>{setNodes([]);setSelected('');setObservations([]);if(path)refresh().catch(e=>setError(String(e.message)));},[targetId]);
  useEffect(()=>{
    if(!node)return;
    setEnabled(node.enabled);setSourceMode(node.sourceMode);
    setUrlText(node.sourceUrls.join('\n'));setOverrideActive(node.isOverrideActive);
    setOverrideValue(node.userOverriddenSentiment??node.effectiveScore??5);
  },[node?.graphId, nodes]);
  useEffect(()=>{
    let active=true;
    if(!nodePath){setObservations([]);setCandidates([]);return;}
    setFeedUrl('');setRights(false);
    api<Candidate[]>(nodePath+'/candidates').then(o=>{if(active)setCandidates(o)}).catch(()=>{if(active)setCandidates([])});
    api<Observation[]>(nodePath+'/observations').then(o=>{if(active)setObservations(o)}).catch(e=>{if(active)setError(e.message)});
    return()=>{active=false};
  },[nodePath]);
  const act=async(task:()=>Promise<unknown>,message:string)=>{
    setError('');setNotice('');setBusy(true);
    try{await task();await refresh();if(nodePath)setObservations(await api<Observation[]>(nodePath+'/observations'));
      changed();setNotice(message)}catch(e:any){setError(e.message||String(e))}finally{setBusy(false)}
  };
  if(!targetId)return <p className="empty">Select a {getLabel('target').toLowerCase()} to manage social discussion signals.</p>;
  return <section className="signal-config">
    <h2>Social discussion signals</h2>
    <p className="eval-integrity-note">A separate, admin-curated perspective on community discussion. Not sampled prevalence, empirical research, or validated concept performance. Scores: 1–10; no data remains unrated.</p>
    <div className="button-row"><button className="secondary" disabled={busy} onClick={()=>refresh().catch(e=>setError(e.message))}><RefreshCw size={14}/> Refresh</button><span className="mini">No external scraping or automatic collection in v0.9.0</span></div>
    {error&&<div className="alert bad" role="alert">{error}</div>}{notice&&<div className="alert good" role="status">{notice}</div>}
    <label className="field">Configure {getLabel('target')}, {getLabel('stream')} or {getLabel('problem')}
      <select value={selected} onChange={e=>setSelected(e.target.value)}>
        {nodes.map(n=><option value={`${n.type}:${n.id}`} key={n.graphId}>
          {getLabel(n.type)} · {n.name.slice(0,115)}
        </option>)}
      </select>
    </label>
    {node&&<>
      <div className="signal-state"><strong>Effective state: {node.effectiveEnabled?'On':'Off'}</strong><span>{node.effectiveScore==null?'No scored observations':`${node.effectiveScore.toFixed(1)}/10 · ${node.effectiveSource.replaceAll('_',' ')}`}</span><span>{node.observationCount} reviewed observations</span></div>
      <h3>Source configuration and inheritance</h3>
      <label className="field">Social signal monitoring
        <select value={enabled} onChange={e=>setEnabled(e.target.value as typeof enabled)}>
          {node.type!=='target'&&<option value="inherit">Inherit parent setting</option>}
          <option value="on">Enabled</option><option value="off">Disabled</option>
        </select>
      </label>
      <label className="field">Source policy
        <select value={sourceMode} onChange={e=>setSourceMode(e.target.value as typeof sourceMode)}>
          {node.type!=='target'&&<option value="inherit">Inherit parent source list</option>}
          <option value="custom">Specify this node's source list</option>
        </select>
      </label>
      <label className="field">Tracked source URLs · one HTTPS link per line
        <textarea rows={3} value={sourceMode==='inherit'?node.effectiveSourceUrls.join('\n'):urlText}
          disabled={sourceMode==='inherit'} onChange={e=>setUrlText(e.target.value)}/>
      </label>
      <button disabled={busy} className="secondary" onClick={()=>act(()=>api(nodePath+'/config',{method:'PATCH',body:JSON.stringify({enabled,sourceMode,sourceUrls:sourceMode==='custom'?urlText.split('\n').map(s=>s.trim()).filter(Boolean):[]})}), 'Source configuration saved')}>Save configuration</button>
      <h3>Administrator override</h3>
      <p className="mini">While locked, automatic recalculation will not overwrite the node score. Unlocking recomputes from reviewed direct observations.</p>
      <label className="field"><input type="checkbox" checked={overrideActive} onChange={e=>setOverrideActive(e.target.checked)} style={{width:'auto',marginRight:8}}/>Override effective social signal</label>
      <label className="field">Manual score, 1–10
        <input type="number" min="1" max="10" step="0.1" disabled={!overrideActive} value={overrideValue} onChange={e=>setOverrideValue(Number(e.target.value))}/>
      </label>
      <label className="field">Reason for change
        <input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/>
      </label>
      <button className="secondary" disabled={busy||overrideActive&&(!Number.isFinite(overrideValue)||overrideValue<1||overrideValue>10)} onClick={()=>act(()=>api(nodePath+'/override',{method:'PATCH',body:JSON.stringify({active:overrideActive,score:overrideActive?overrideValue:null,reason})}), 'Override state updated and audited')}><ShieldCheck size={14}/> Apply override</button>
      <h3>Authorized feed collection (optional)</h3>
      <p className="mini">RSS/Atom only. The server must explicitly allowlist the source hostname in SOCIAL_FEED_ALLOWED_HOSTS and you must have permission to use this feed. Import creates review candidates, never automatically computed sentiment or empirical findings.</p>
      <label className="field">Configured source feed URL
        <select value={feedUrl} onChange={e=>setFeedUrl(e.target.value)}><option value="">Choose an inherited or configured feed</option>{node.effectiveSourceUrls.map(src=><option key={src} value={src}>{src}</option>)}</select>
      </label>
      <label className="field"><input type="checkbox" style={{width:'auto',marginRight:8}} checked={rights} onChange={e=>setRights(e.target.checked)}/>I have authorization to collect from this feed and will review imported material.</label>
      <button className="secondary" disabled={busy||!node.effectiveEnabled||!feedUrl||!rights} onClick={()=>act(async()=>{
        await api(nodePath+'/collect',{method:'POST',body:JSON.stringify({sourceUrl:feedUrl,attestedRights:rights,maxItems:10})});
        setCandidates(await api<Candidate[]>(nodePath+'/candidates'));
      },'Feed candidates saved for review; no sentiment scores assigned')}>Collect feed candidates</button>
      {candidates.length>0&&<details className="eval-history"><summary>{candidates.length} imported discussion excerpts · review before scoring</summary>{candidates.slice(0,30).map(c=><div className="finding" key={c.id}><strong>{c.sourceTitle}</strong><p>{c.excerpt}</p><a href={c.sourceUrl} rel="noreferrer" target="_blank">Open original source ↗</a><button className="secondary" onClick={()=>{
        setUrl(c.sourceUrl);setTitle(c.sourceTitle.slice(0,220));setSummary(c.excerpt.slice(0,1500));
        setContext(`Admin-imported from approved RSS/Atom feed ${c.sourceFeed}; selection bias and context must be reviewed.`);
        setReviewStatus('needs_review');
      }}>Use as draft observation</button></div>)}</details>}
      <h3>Curated social observation</h3>
      <p className="mini">Add a traceable discussion summary with explicit scope and review state. Source configuration does not itself generate observations.</p>
      <label className="field">Public HTTPS source URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label>
      <label className="field">Source title<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label className="field">What did the sampled discussion report?<textarea rows={3} value={summary} onChange={e=>setSummary(e.target.value)} /></label>
      <label className="field">Sampling context / limitations<textarea rows={2} value={context} onChange={e=>setContext(e.target.value)}/></label>
      <div className="signal-columns"><label className="field">Metric<select value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="unmet_need">Unmet-need intensity</option><option value="polarity">Sentiment polarity</option></select></label>
        <label className="field">Factor<select value={factor} onChange={e=>setFactor(e.target.value)}>{FACTORS.map(f=><option value={f} key={f}>{f}</option>)}</select></label></div>
      <div className="signal-columns"><label className="field">Rating 1–10<input type="number" min="1" max="10" step="0.1" value={score} onChange={e=>setScore(Number(e.target.value))}/></label>
        <label className="field">Reported sample size (optional)<input type="number" min="1" value={sampleSize} onChange={e=>setSampleSize(e.target.value)}/></label></div>
      <label className="field">Review status<select value={reviewStatus} onChange={e=>setReviewStatus(e.target.value as typeof reviewStatus)}><option value="needs_review">Draft – do not aggregate</option><option value="reviewed">Reviewed by administrator</option></select></label>
      <button className="primary" disabled={busy||!url||title.trim().length<3||summary.trim().length<15||!(score>=1&&score<=10)} onClick={()=>act(async()=>{
        await api(nodePath+'/observations',{method:'POST',body:JSON.stringify({sourceUrl:url,sourceTitle:title,summary,context,metric,factor:factor==='overall'?null:factor,score,sampleSize:sampleSize?Number(sampleSize):null,reviewStatus})});
        setUrl('');setTitle('');setSummary('');setContext('');setSampleSize('');setReviewStatus('needs_review');
      },'Social observation saved with source and review status')}>Save observation</button>
      <h3>Observation history</h3>
      {observations.length?observations.map(o=><div className="finding" key={o.id}>
        <div className="row"><strong>{o.score}/10 · {o.metric.replaceAll('_',' ')} · {o.factor==='overall'?'Node-level':o.factor}</strong><span className="pill">{o.reviewStatus}</span></div>
        <p>{o.summary}</p><p className="mini">{o.context||'Sampling context not provided'} {o.sampleSize?`· Sample size: ${o.sampleSize}`:''}</p>
        <a href={o.sourceUrl} target="_blank" rel="noreferrer">{o.sourceTitle} ↗</a>
        <button className="ghost small" disabled={busy} onClick={()=>act(()=>api(nodePath+'/observations/'+encodeURIComponent(o.id),{method:'PATCH',body:JSON.stringify({status:o.reviewStatus==='reviewed'?'needs_review':'reviewed'})}),'Observation review state changed and score recalculated')}>{o.reviewStatus==='reviewed'?'Revoke review':'Mark reviewed'}</button>
      </div>):<p className="empty">No observations recorded for this node.</p>}
    </>}
  </section>;
}
