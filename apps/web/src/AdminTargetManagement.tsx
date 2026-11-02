import {useEffect, useState} from 'react';
import {Trash2, RefreshCw, Star, Eye, EyeOff, Globe2, LockKeyhole} from 'lucide-react';
import {useTerminology} from './contexts/TerminologyContext';
import {TERMINOLOGY_LENSES} from './types/terminology';

type TargetEntry = {
  id:string; name:string; ownerId:string; ownerEmail:string;
  shared:boolean; listed:boolean; featured:boolean; featuredLenses:string[]; reference:boolean; deletable:boolean;
  streams:number;categories:number;problems:number;
};
type Publication = {shared?:boolean;listed?:boolean;featured?:boolean;featuredLenses?:string[]};

/** Administrator inventory; publishing, discovery and protected status are independent. */
export default function AdminTargetManagement({onChanged,adminUserId}: {onChanged:()=>Promise<void>;adminUserId:string}) {
  const {getLabel}=useTerminology();
  const [targets,setTargets] = useState<TargetEntry[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busyId,setBusyId] = useState<string|null>(null);
  const refresh = async () => {
    setLoading(true);setError('');
    try {
      const response = await fetch('/api/admin/targets',{credentials:'same-origin'});
      if (!response.ok) throw new Error(`Target inventory unavailable (${response.status})`);
      const result = await response.json() as {targets:TargetEntry[]};
      setTargets(result.targets);
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to load targets')}
    finally {setLoading(false)}
  };
  useEffect(()=>{void refresh()},[]);
  const update = async (target:TargetEntry, changes:Publication) => {
    if (busyId) return;
    if (changes.shared===false && !window.confirm(`Make "${target.name}" private? Other users will lose access, including through saved URLs. No research will be deleted.`)) return;
    setBusyId(target.id);setError('');setNotice('');
    try {
      const response=await fetch(`/api/admin/targets/${encodeURIComponent(target.id)}/publication`,{
        method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(changes),
      });
      if (!response.ok) {
        const result=await response.json().catch(()=>({detail:response.statusText})) as {detail?:string};
        throw new Error(result.detail||`Update failed (${response.status})`);
      }
      await onChanged();await refresh();
      setNotice('Directory publication settings saved. No research records were changed.');
    } catch(e) {setError(e instanceof Error?e.message:'Update failed')}
    finally {setBusyId(null)}
  };
  const remove = async (target:TargetEntry) => {
    if (busyId || !target.deletable) return;
    const name = window.prompt(`Permanently delete all research, concepts and problems for this Target?\n\n${target.name}\n\nType the FULL target name to confirm:`);
    if (name === null) return;
    if (name !== target.name) {setError('Target name does not match. No records changed.');return;}
    const id = window.prompt(`Final confirmation: type the exact target ID to delete:\n${target.id}`);
    if (id === null) return;
    if (id !== target.id) {setError('Target ID does not match. No records changed.');return;}
    setBusyId(target.id);setError('');setNotice('');
    try {
      const response = await fetch(`/api/admin/targets/${encodeURIComponent(target.id)}`,{
        method:'DELETE', credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({target_name:name,target_id:id}),
      });
      if (!response.ok) {
        const result = await response.json().catch(()=>({detail:response.statusText})) as {detail?:string};
        throw new Error(result.detail || `Delete failed (${response.status})`);
      }
      await onChanged();await refresh();
      setNotice(`Deleted ${target.name}. Related application records were removed; shared Sources were preserved.`);
    } catch(e) {setError(e instanceof Error ? e.message : 'Delete failed')}
    finally {setBusyId(null)}
  };
  return <section className="admin-targets">
    <div className="pane-title"><h3>{getLabel('target','plural')}</h3><button className="secondary small" onClick={()=>void refresh()} disabled={loading||!!busyId}><RefreshCw size={14}/> Refresh targets</button></div>
    <p className="muted">Choose a general featured Target and optional lens-specific recommendations. Only shared, listed Targets can be featured. A hidden Target remains accessible through a direct link; making it private removes other users' access. Reference protection is independent and does not prevent hiding or unsharing.</p>
    {error&&<div className="alert bad" role="alert">{error}</div>}
    {notice&&<div className="alert good" role="status">{notice}</div>}
    <div className="admin-table"><table><thead><tr><th>{getLabel('target')}</th><th>Owner</th><th>Structure</th><th>Public access</th><th>Directory</th><th>Featured</th><th>Lens recommendations</th><th>Delete</th></tr></thead><tbody>
      {targets.map(target=><tr key={target.id}>
        <td><strong>{target.name}</strong><small>{target.reference?'Protected reference':target.shared?'Shared':'Private'} · {target.id}</small></td>
        <td>{target.ownerEmail}</td>
        <td>{target.streams} {getLabel('stream','plural').toLowerCase()} · {target.categories} {getLabel('category','plural').toLowerCase()} · {target.problems} {getLabel('problem','plural').toLowerCase()}</td>
        <td><button className="secondary small" disabled={!!busyId||(!target.shared && target.ownerId!=='__system__' && target.ownerId!==adminUserId)}
          title={target.shared?'Make private: revoke access for other accounts':target.ownerId==='__system__'||target.ownerId===adminUserId?'Make this Target publicly accessible':'Only the owner can initially share this private Target'}
          onClick={()=>void update(target,{shared:!target.shared})}>
          {target.shared?<><Globe2 size={13}/> Public</>:<><LockKeyhole size={13}/> Private</>}</button></td>
        <td><button className="secondary small" disabled={!!busyId||!target.shared}
          aria-pressed={target.shared&&target.listed}
          title={target.shared?(target.listed?'Hide from shared directory (direct access remains permitted)':'Show in shared directory'):'Private Targets cannot be listed'}
          onClick={()=>void update(target,{listed:!target.listed})}>
          {target.shared&&target.listed?<><Eye size={13}/> Listed</>:<><EyeOff size={13}/> Hidden</>}</button></td>
        <td><button className={target.featured?'primary small':'secondary small'} disabled={!!busyId||!target.shared||!target.listed}
          aria-pressed={target.featured}
          title={target.featured?'Remove featured designation':'Feature this shared Target for users'}
          onClick={()=>void update(target,{featured:!target.featured})}>
          <Star size={13}/>{target.featured?' Featured':' Set default'}</button></td>
        <td><details className="lens-feature-settings"><summary>{target.featuredLenses?.length||0} lenses</summary>
          {Object.values(TERMINOLOGY_LENSES).map(lens=><label className="lens-feature-option" key={lens.id} title={lens.description}>
            <input type="checkbox" checked={(target.featuredLenses||[]).includes(lens.id)}
              disabled={!!busyId||!target.shared||!target.listed}
              onChange={event=>void update(target,{featuredLenses:event.target.checked
                ? [...(target.featuredLenses||[]),lens.id]
                : (target.featuredLenses||[]).filter(id=>id!==lens.id)})}/>
            <span>{lens.displayName}</span>
          </label>)}
        </details></td>
        <td>{target.deletable?<button className="ghost small danger" disabled={!!busyId} onClick={()=>void remove(target)}><Trash2 size={13}/> Delete</button>:<span className="mini">Protected</span>}</td>
      </tr>)}
    </tbody></table></div>
    {!loading&&!targets.length&&<p className="empty">No {getLabel('target','plural').toLowerCase()} found.</p>}
  </section>;
}
