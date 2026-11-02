import {useEffect,useState} from 'react';
import {type Appearance,type GraphRole,type ThemeColors} from './NetworkCanvas';
const defaults:Appearance={
  dark:{target:'#40546c',stream:'#35465c',category:'#29394e',problem:'#1e293b',concept:'#374151',
    badgeClosed:'#cbd5e1',badgeOpen:'#75a6c9',badgeHover:'#ffffff',badgeReviewedHover:'#70b59a',badgeUnreviewedHover:'#d7ad6a',badgeProblemsHover:'#a4aec5',badgeReviewed:'#47866f',badgeUnreviewed:'#b08a52',badgeProblems:'#7b8296',
    badgeReviewedOpen:'#3a6957',badgeUnreviewedOpen:'#876938',badgeProblemsOpen:'#596175',
    showConceptOpen:true,showConceptClosed:true,showReviewedOpen:false,showReviewedClosed:true,
    showUnreviewedOpen:false,showUnreviewedClosed:true,showProblemsOpen:false,showProblemsClosed:true,
    showBadgeTooltips:true,showConceptBadges:true,showReviewedBadges:true,showUnreviewedBadges:true,showProblemBadges:true},
  light:{target:'#d9e3ee',stream:'#e3eaf2',category:'#edf2f7',problem:'#ffffff',concept:'#e1e7ef',
    badgeClosed:'#475569',badgeOpen:'#296b91',badgeHover:'#1b597e',badgeReviewedHover:'#53a57c',badgeUnreviewedHover:'#bc8b42',badgeProblemsHover:'#8393ae',badgeReviewed:'#36735a',badgeUnreviewed:'#996e35',badgeProblems:'#667085',
    badgeReviewedOpen:'#b5d7c6',badgeUnreviewedOpen:'#dfcda9',badgeProblemsOpen:'#c6cfda',
    showConceptOpen:true,showConceptClosed:true,showReviewedOpen:false,showReviewedClosed:true,
    showUnreviewedOpen:false,showUnreviewedClosed:true,showProblemsOpen:false,showProblemsClosed:true,
    showBadgeTooltips:true,showConceptBadges:true,showReviewedBadges:true,showUnreviewedBadges:true,showProblemBadges:true},
};
const roles:GraphRole[]=['target','stream','category','problem','concept'];
const badgeRows:{label:string;master:keyof ThemeColors;closedColor:keyof ThemeColors;openColor:keyof ThemeColors;
  closedVisible:keyof ThemeColors;openVisible:keyof ThemeColors;hoverColor:keyof ThemeColors}[]=[
  {label:'Concepts',master:'showConceptBadges',closedColor:'badgeClosed',openColor:'badgeOpen',closedVisible:'showConceptClosed',openVisible:'showConceptOpen',hoverColor:'badgeHover'},
  {label:'Reviewed findings',master:'showReviewedBadges',closedColor:'badgeReviewed',openColor:'badgeReviewedOpen',closedVisible:'showReviewedClosed',openVisible:'showReviewedOpen',hoverColor:'badgeReviewedHover'},
  {label:'Unreviewed findings',master:'showUnreviewedBadges',closedColor:'badgeUnreviewed',openColor:'badgeUnreviewedOpen',closedVisible:'showUnreviewedClosed',openVisible:'showUnreviewedOpen',hoverColor:'badgeUnreviewedHover'},
  {label:'Problems',master:'showProblemBadges',closedColor:'badgeProblems',openColor:'badgeProblemsOpen',closedVisible:'showProblemsClosed',openVisible:'showProblemsOpen',hoverColor:'badgeProblemsHover'},
];
export default function GraphAppearance({onSaved}:{onSaved:()=>void}){
  const [palette,setPalette]=useState<Appearance>(defaults);
  const [theme,setTheme]=useState<'light'|'dark'>('dark');
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  useEffect(()=>{let live=true;fetch('/api/graph/appearance',{credentials:'same-origin'})
    .then(r=>{if(!r.ok)throw Error('Could not load appearance');return r.json()})
    .then((value:Appearance)=>{if(live)setPalette({
      light:{...defaults.light,...value.light},dark:{...defaults.dark,...value.dark},
    })})
    .catch(e=>{if(live)setMessage(e.message)});
    return()=>{live=false};
  },[]);
  const save=async()=>{setBusy(true);setMessage('');try{
    const response=await fetch('/api/graph/appearance',{method:'PUT',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({theme,palette:palette[theme]})});
    if(!response.ok)throw Error((await response.json().catch(()=>({}))).detail||'Save failed');
    onSaved();setMessage('Appearance saved. Graph colors updated in place.');
  }catch(e:any){setMessage(e.message)}finally{setBusy(false)}};
  return <div className="content"><section className="panel">
    <h3>Graph appearance</h3>
    <p className="muted">Administrator palette for structural depth. Does not change stored research or restart the graph. Concept nodes use their own appearance.</p>
    <label className="field">Theme<select value={theme} onChange={e=>setTheme(e.target.value as 'dark'|'light')}>
      <option value="dark">Dark</option><option value="light">Light</option></select></label>
    <div className="graph-palette-grid">{roles.map(role=><label key={role} className="graph-palette-row">
      <span>{role.charAt(0).toUpperCase()+role.slice(1)}</span>
      <input type="color" value={palette[theme][role]} onChange={e=>setPalette(old=>({...old,[theme]:{...old[theme],[role]:e.target.value}} as Appearance))}/>
      <code>{palette[theme][role]}</code>
    </label>)}</div>
    <h4>Hierarchy badge appearance</h4>
    <p className="muted mini">Badges follow the perimeter of their node toward the child branches. Closed nodes show summary counts; expanded nodes can hide or soften their own badges. Concept toggles remain faintly available when expanded so branches can still be collapsed.</p>
    <div className="graph-badge-appearance-table" role="group" aria-label="Badge visibility and colors by state">
      <div className="graph-badge-appearance-head"><span>Badge</span><span>Closed · show / color</span><span>Open · show / color</span><span>Hover color</span></div>
      {badgeRows.map(row=><div className="graph-badge-appearance-row" key={row.label}>
        <label className="graph-badge-kind"><input type="checkbox" checked={Boolean(palette[theme][row.master])}
          onChange={e=>setPalette(old=>({...old,[theme]:{...old[theme],[row.master]:e.target.checked}}))}/>{row.label}</label>
        {([['closedVisible','closedColor'],['openVisible','openColor']] as const).map(([visible,color])=><div className="graph-badge-state" key={visible}>
          <label title={`Show ${row.label} on ${visible==='closedVisible'?'collapsed':'expanded'} nodes`}>
            <input type="checkbox" checked={Boolean(palette[theme][row[visible]])}
              onChange={e=>setPalette(old=>({...old,[theme]:{...old[theme],[row[visible]]:e.target.checked}}))}/>
            <span className="sr-only">{visible==='closedVisible'?'Closed':'Expanded'} {row.label} visibility</span>
          </label>
          <input type="color" aria-label={`${row.label} ${visible==='closedVisible'?'closed':'open'} color`}
            value={String(palette[theme][row[color]])}
            onChange={e=>setPalette(old=>({...old,[theme]:{...old[theme],[row[color]]:e.target.value}}))}/>
        </div>)}
        <div className="graph-badge-state">
          <input type="color" aria-label={`${row.label} hover color`}
            value={String(palette[theme][row.hoverColor])}
            onChange={e=>setPalette(old=>({...old,[theme]:{...old[theme],[row.hoverColor]:e.target.value}}))}/>
        </div>
      </div>)}
    </div>
    <div className="graph-badge-options">
      <label className="graph-badge-switch"><input type="checkbox" checked={palette[theme].showBadgeTooltips}
        onChange={e=>setPalette(old=>({...old,[theme]:{...old[theme],showBadgeTooltips:e.target.checked}}))}/>
        Show badge tooltips</label>

    </div>
    <div className="button-row"><button type="button" className="primary" disabled={busy} onClick={save}>Save palette</button>
      <button type="button" className="secondary" onClick={()=>setPalette(prev=>({...prev,[theme]:defaults[theme]}))}>Restore suggested colors</button></div>
    {message&&<p role="status" className="mini">{message}</p>}
  </section></div>;
}
