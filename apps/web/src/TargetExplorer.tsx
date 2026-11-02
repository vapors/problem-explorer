import {useEffect, useMemo, useState} from 'react';
import {BookOpen, ChevronDown, ChevronRight, FolderOpen, Plus, Search, Share2, X} from 'lucide-react';
import {removeSeedCatalogPrefix} from './networkLabels';
import {useTerminology} from './contexts/TerminologyContext';

export type ExplorerTarget = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  shared: boolean;
  reference?: boolean;
  featured?: boolean;
};
export type ExplorerStream = {id: string; name: string; description: string};
export type ExplorerScope = {
  streamId: string;
  stream: string;
  categoryId: string | null;
  category: string | null;
  count: number;
};
export type ExplorerProblem = {
  id: number;
  description: string;
  streamId?: string;
  categoryId?: string;
  category: string;
};

type Props = {
  target: ExplorerTarget | null;
  mine: ExplorerTarget[];
  shared: ExplorerTarget[];
  streams: ExplorerStream[];
  hierarchy: ExplorerScope[];
  problems: ExplorerProblem[];
  readOnly: boolean;
  busy: boolean;
  onTargetChange: (id: string) => void;
  onNewTarget: () => void;
  onBrowseTargets: () => void;
  onOpenProblem: (id: number) => void;
};

/**
 * A lightweight, target-scoped navigation tree. This is a view over the existing
 * /streams, /hierarchy and /problems endpoints, not a parallel graph data store.
 * Parent branches toggle locally; selecting a problem opens the established modal.
 */
export default function TargetExplorer({target, mine, shared, streams, hierarchy, problems,
  readOnly, busy, onTargetChange, onNewTarget, onBrowseTargets, onOpenProblem}: Props) {
  const {t}=useTerminology();
  const [query, setQuery] = useState('');
  const [openStreams, setOpenStreams] = useState<Set<string>>(() => new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());

  // Reset target-local filter and open branches when the active workspace changes.
  useEffect(() => {
    setQuery('');
    setOpenStreams(new Set());
    setOpenCategories(new Set());
  }, [target?.id]);
  // Branches remain collapsed on initial load, including after async stream loading.
  const tree = useMemo(() => streams.map(stream => {
    const categories = hierarchy.filter(c => c.streamId === stream.id && c.categoryId).map(c => ({
      id: c.categoryId as string,
      name: c.category || t('explorer.untitled'),
      problems: problems.filter(p => p.categoryId === c.categoryId && p.streamId === stream.id),
      count: c.count,
    }));
    return {id: stream.id, name: stream.name, categories,
      count: categories.reduce((total, category) => total + category.count, 0)};
  }), [streams, hierarchy, problems]);

  const normalizedQuery = query.toLocaleLowerCase().trim();
  const visibleTree = useMemo(() => tree.map(stream => {
    const streamMatches = stream.name.toLocaleLowerCase().includes(normalizedQuery);
    const categories = stream.categories.map(category => {
      const categoryMatches = category.name.toLocaleLowerCase().includes(normalizedQuery);
      const visibleProblems = !normalizedQuery || streamMatches || categoryMatches
        ? category.problems
        : category.problems.filter(problem => problem.description.toLocaleLowerCase().includes(normalizedQuery));
      return {...category, problems: visibleProblems, visible: !normalizedQuery || streamMatches || categoryMatches || visibleProblems.length > 0};
    }).filter(category => category.visible);
    return {...stream, categories, visible: !normalizedQuery || streamMatches || categories.length > 0};
  }).filter(stream => stream.visible), [tree, normalizedQuery]);

  const toggle = (id: string, setter: (value: Set<string>) => void, current: Set<string>) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };
  const expandAll = () => {
    setOpenStreams(new Set(tree.map(stream => stream.id)));
    setOpenCategories(new Set(tree.flatMap(stream => stream.categories.map(category => category.id))));
  };
  const collapseAll = () => {
    setOpenStreams(new Set());
    setOpenCategories(new Set());
  };

  return <section className="target-explorer" aria-label={t('app.explorer')}>
    <div className="explorer-context">
      <div className="explorer-eyebrow">{t('explorer.active').toUpperCase()}</div>
      <select value={target?.id || ''} onChange={e => onTargetChange(e.target.value)}
        disabled={busy} aria-label={t('explorer.select')}>
        <option value="" disabled>{t('explorer.select')}</option>
        {!!mine.length && <optgroup label={t('explorer.myTargets')}>{mine.map(item =>
          <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
        {!!shared.length && <optgroup label={t('explorer.shared')}>{shared.map(item =>
          <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
      </select>
      <div className="explorer-scope" title={target?.description || ''}>
        {target?.description || t('explorer.choose')}
      </div>
      <div className="explorer-actions">
        <button className="secondary small" type="button" onClick={onNewTarget}><Plus size={14}/> {t('app.newTarget')}</button>
        <button className="ghost small" type="button" onClick={onBrowseTargets}><Share2 size={14}/> {t('explorer.directory')}</button>
        {target && <span className="explorer-access">{readOnly ? t('app.readOnly') : t('app.editable')}</span>}
      </div>
    </div>
    <div className="explorer-tree-tools">
      <label className="explorer-search"><Search size={15}/>
        <input aria-label={t('explorer.filter')} placeholder={t('explorer.search')}
          value={query} onChange={e => setQuery(e.target.value)}/>
        {query && <button title="Clear filter" aria-label="Clear filter" type="button" onClick={() => setQuery('')}><X size={14}/></button>}
      </label>
      <div className="explorer-tools-row">
        <span>{t('explorer.counts',{streamCount:streams.length,categoryCount:hierarchy.filter(item=>item.categoryId).length,problemCount:problems.length})}</span>
        <button type="button" onClick={expandAll}>Expand</button>
        <button type="button" onClick={collapseAll}>Collapse</button>
      </div>
    </div>
    <div className="explorer-tree" role="tree" aria-label={t('explorer.structure')}>
      {!target && <p className="empty">{t('explorer.noTarget')}</p>}
      {target && <>
        <div className="explorer-root" title={target.name}><BookOpen size={16}/><span>{target.name}</span></div>
        {visibleTree.map(stream => {
          const streamExpanded = !!normalizedQuery || openStreams.has(stream.id);
          return <div className="explorer-stream" key={stream.id} role="treeitem" aria-expanded={streamExpanded}>
            <div className="explorer-branch-row explorer-stream-row">
              <button type="button" aria-label={`${streamExpanded ? 'Collapse' : 'Expand'} ${stream.name}`}
                title={stream.name} onClick={() => toggle(stream.id, setOpenStreams, openStreams)}>
                {streamExpanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                <span>{removeSeedCatalogPrefix(stream.name, 'stream')}</span>
              </button>
              <span className="explorer-count">{stream.count}</span>
            </div>
            {streamExpanded && <div className="explorer-categories" role="group">{stream.categories.map(category => {
              const categoryExpanded = !!normalizedQuery || openCategories.has(category.id);
              return <div className="explorer-category" key={category.id} role="treeitem" aria-expanded={categoryExpanded}>
                <div className="explorer-branch-row explorer-category-row">
                  <button type="button" title={category.name}
                    aria-label={`${categoryExpanded ? 'Collapse' : 'Expand'} ${category.name}`}
                    onClick={() => toggle(category.id, setOpenCategories, openCategories)}>
                    {categoryExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                    <span>{removeSeedCatalogPrefix(category.name, 'category')}</span>
                  </button>
                  <span className="explorer-count">{category.count}</span>
                </div>
                {categoryExpanded && <div className="explorer-problems" role="group">
                  {category.problems.map(problem => <button type="button" className="explorer-problem"
                    key={problem.id} role="treeitem" title={problem.description} onClick={() => onOpenProblem(problem.id)}>
                    <span className="explorer-problem-dot" aria-hidden="true"/>
                    <span>{removeSeedCatalogPrefix(problem.description, 'problem')}</span>
                    <ChevronRight size={13}/>
                  </button>)}
                  {!category.problems.length && <span className="explorer-empty">{t('explorer.emptyCategory')}</span>}
                </div>}
              </div>;
            })}</div>}
          </div>;
        })}
        {!visibleTree.length && <div className="explorer-empty-result"><FolderOpen size={18}/> {t('explorer.noMatches')}</div>}
      </>}
    </div>
  </section>;
}
