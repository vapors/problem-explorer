import {useEffect,useRef,type KeyboardEvent} from 'react';
import {BarChart3,Lightbulb,Network,X} from 'lucide-react';

type Concept = {
  id:string;
  name:string;
  description:string;
  matches?:{problemId:number;relevance:number}[];
  evaluations?:{id:string;payload:string}[];
};
type Props={
  concept:Concept;
  label:string;
  matchingLabel:string;
  analysisLabel:string;
  onClose:()=>void;
  onMatching:()=>void;
  onAnalysis:()=>void;
  onReject?:()=>void;
  rejectLabel?:string;
};
/** Modal is context-only. Matching and analysis remain the canonical windows. */
export default function ConceptWorkspaceModal({concept,label,matchingLabel,analysisLabel,onClose,onMatching,onAnalysis,onReject,rejectLabel}:Props){
  const closeButton=useRef<HTMLButtonElement>(null);
  const dialog=useRef<HTMLElement>(null);
  useEffect(()=>{closeButton.current?.focus()},[]);
  function trapTab(event:KeyboardEvent<HTMLElement>){
    if(event.key!=='Tab'||!dialog.current)return;
    const elements=Array.from(dialog.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if(!elements.length)return;
    if(event.shiftKey&&document.activeElement===elements[0]){event.preventDefault();elements[elements.length-1].focus()}
    else if(!event.shiftKey&&document.activeElement===elements[elements.length-1]){event.preventDefault();elements[0].focus()}
  }
  return <div className="context-backdrop" role="presentation"
    onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section ref={dialog} className="context-modal concept-workspace-modal" role="dialog" aria-modal="true"
      aria-labelledby="concept-workspace-title" onKeyDown={trapTab}>
      <div className="context-modal-heading">
        <div className="eyebrow"><Lightbulb size={15} aria-hidden="true"/> {label}</div>
        <button ref={closeButton} type="button" className="ghost small" onClick={onClose} aria-label="Close concept workspace"><X size={15}/> Close</button>
      </div>
      <ConceptWorkspaceDetails concept={concept} matchingLabel={matchingLabel} analysisLabel={analysisLabel}
        onMatching={onMatching} onAnalysis={onAnalysis} titleId="concept-workspace-title"
        onReject={onReject?()=>{if(window.confirm('Reject this concept? It can be restored later.'))onReject()}:undefined}
        rejectLabel={rejectLabel}/>
    </section>
  </div>;
}

/** The Concept Studio's right column uses the same data/actions as the context modal,
 * without the full-screen backdrop or focus trap. Source CSS remains authoritative. */
export function ConceptWorkspaceDetails({concept,matchingLabel,analysisLabel,onMatching,onAnalysis,onReject,rejectLabel,titleId}:{
  concept:Concept;matchingLabel:string;analysisLabel:string;onMatching:()=>void;onAnalysis:()=>void;
  onReject?:()=>void;rejectLabel?:string;titleId?:string;
}){
  return <div className="concept-workspace-details">
    <h2 id={titleId}>{concept.name}</h2>
    <p className="muted concept-workspace-description">{concept.description}</p>
    <div className="concept-workspace-metrics">
      <div><strong>{concept.matches?.length??0}</strong><small>Saved problem matches</small></div>
      <div><strong>{concept.evaluations?.length??0}</strong><small>Saved evaluations</small></div>
    </div>
    <p className="mini">Matching indicates estimated relevance, not established effectiveness. Evaluation distinguishes evidence-backed conclusions from exploratory estimates.</p>
    <div className="context-modal-actions">
      <button type="button" className="primary" onClick={onMatching}><Network size={16}/> {matchingLabel}</button>
      <button type="button" className="secondary" onClick={onAnalysis}><BarChart3 size={16}/> {analysisLabel}</button>
      {onReject&&<button type="button" className="ghost danger" onClick={onReject}>{rejectLabel||'Reject concept'}</button>}
    </div>
  </div>;
}
