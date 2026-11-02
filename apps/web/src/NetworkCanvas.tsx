import {useEffect, useRef, useState, type MutableRefObject} from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5hierarchy from '@amcharts/amcharts5/hierarchy';
<<<<<<< HEAD
import {Maximize2, ZoomIn, ZoomOut, RotateCcw} from 'lucide-react';
import {layoutGraphLabel} from './networkLabels';
import {wrapGraphTooltip} from './graphTooltip';
import {badgeDirections,perimeterBadges,alignOverlayBadge,type Point} from './graphBadgeLayout';
import {useTerminology} from './contexts/TerminologyContext';
import {resolveEntity} from './types/terminology';
=======
import {Maximize2, ZoomIn, ZoomOut} from 'lucide-react';
import {layoutGraphLabel} from './networkLabels';
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8

export type GraphRole = 'target'|'stream'|'category'|'problem'|'concept';
export type TreeNode = {
<<<<<<< HEAD
  id:string; stableKey?:string; name:string; type:GraphRole;
  children?:TreeNode[]; value?:number; recordId?:number; solutionId?:string; conceptCount?:number; reviewedCount?:number; unreviewedCount?:number; problemCount?:number;
  crossLinks?:string[]; displayName?:string; labelRadius?:number;
  labelFontSize?:number; labelWidth?:number;
=======
  id: string;
  name: string;
  type: 'target' | 'stream' | 'category' | 'problem';
  children?: TreeNode[];
  value?: number;
  recordId?: number;
  crossLinks?: string[];
  displayName?: string;
  labelRadius?: number;
  labelFontSize?: number;
  labelWidth?: number;
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
};
export type ProblemReveal = {problemId:number; sequence:number};
export type ConceptAdded = {id:string; name:string; originProblemId:number; sequence:number};
export type GraphColors = Record<GraphRole,string>;
export type GraphBadgeColors = {
  badgeClosed:string; badgeOpen:string; badgeHover:string;
  badgeReviewedHover:string; badgeUnreviewedHover:string; badgeProblemsHover:string;
  badgeReviewed:string; badgeUnreviewed:string; badgeProblems:string;
  badgeReviewedOpen:string;badgeUnreviewedOpen:string;badgeProblemsOpen:string;
  showConceptOpen:boolean;showConceptClosed:boolean;
  showReviewedOpen:boolean;showReviewedClosed:boolean;
  showUnreviewedOpen:boolean;showUnreviewedClosed:boolean;
  showProblemsOpen:boolean;showProblemsClosed:boolean;
  showBadgeTooltips:boolean;
  showConceptBadges:boolean; showReviewedBadges:boolean;
  showUnreviewedBadges:boolean; showProblemBadges:boolean;
};
export type ThemeColors = GraphColors & GraphBadgeColors;
export type Appearance = {light:ThemeColors; dark:ThemeColors};
type Theme = 'light'|'dark';
type Signal = {score:number|null;enabled:boolean;count:number;overridden:boolean};
type GraphView = {version:1; expanded:string[]; focused:string|null;
  zoom:number; panX:number; panY:number; signalVisible:boolean};
type Props = {
  targetId:string|null; refreshKey:number; theme:Theme;
  onProblemNodeSelect:(id:number)=>void; onConceptNodeSelect:(id:string)=>void;
  conceptAdded:ConceptAdded|null; revealProblem:ProblemReveal|null; signalVisible:boolean; signalVersion:number;
  onRestoreSignal:(visible:boolean)=>void; appearanceVersion:number; activityVersion:number;
};
const DEFAULT_APPEARANCE:Appearance = {
  dark:{target:'#40546c',stream:'#35465c',category:'#29394e',problem:'#1e293b',concept:'#374151',
    badgeClosed:'#cbd5e1',badgeOpen:'#75a6c9',badgeHover:'#ffffff',badgeReviewedHover:'#70b59a',badgeUnreviewedHover:'#d7ad6a',badgeProblemsHover:'#a4aec5',badgeReviewed:'#47866f',badgeUnreviewed:'#b08a52',badgeProblems:'#7b8296',badgeReviewedOpen:'#3a6957',badgeUnreviewedOpen:'#876938',badgeProblemsOpen:'#596175',showConceptOpen:true,showConceptClosed:true,showReviewedOpen:false,showReviewedClosed:true,showUnreviewedOpen:false,showUnreviewedClosed:true,showProblemsOpen:false,showProblemsClosed:true,showBadgeTooltips:true,showConceptBadges:true,showReviewedBadges:true,showUnreviewedBadges:true,showProblemBadges:true},
  light:{target:'#d9e3ee',stream:'#e3eaf2',category:'#edf2f7',problem:'#ffffff',concept:'#e1e7ef',
    badgeClosed:'#475569',badgeOpen:'#296b91',badgeHover:'#1b597e',badgeReviewedHover:'#53a57c',badgeUnreviewedHover:'#bc8b42',badgeProblemsHover:'#8393ae',badgeReviewed:'#36735a',badgeUnreviewed:'#996e35',badgeProblems:'#667085',badgeReviewedOpen:'#b5d7c6',badgeUnreviewedOpen:'#dfcda9',badgeProblemsOpen:'#c6cfda',showConceptOpen:true,showConceptClosed:true,showReviewedOpen:false,showReviewedClosed:true,showUnreviewedOpen:false,showUnreviewedClosed:true,showProblemsOpen:false,showProblemsClosed:true,showBadgeTooltips:true,showConceptBadges:true,showReviewedBadges:true,showUnreviewedBadges:true,showProblemBadges:true},
};
const EMPTY_VIEW:GraphView={version:1,expanded:[],focused:null,zoom:1,panX:0,panY:0,signalVisible:false};
const toColor=(hex:string)=>am5.color(Number.parseInt(hex.slice(1),16));
// Keep the count readable against administrator-defined badge colors.
const contrastingText=(hex:string)=>{
  const rgb=[1,3,5].map(i=>Number.parseInt(hex.slice(i,i+2),16)/255);
  const luminance=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return toColor(luminance[0]*.2126+luminance[1]*.7152+luminance[2]*.0722>.35?'#0f172a':'#ffffff');
};
const normalizeAppearance=(value:Partial<{light:Partial<ThemeColors>;dark:Partial<ThemeColors>}>):Appearance=>({
  light:{...DEFAULT_APPEARANCE.light,...value.light},
  dark:{...DEFAULT_APPEARANCE.dark,...value.dark},
});
const validView=(value:Partial<GraphView>):GraphView=>({
  ...EMPTY_VIEW, ...value, version:1,
  expanded:Array.isArray(value.expanded)?value.expanded.filter(x=>typeof x==='string').slice(0,2000):[],
  zoom:typeof value.zoom==='number' && Number.isFinite(value.zoom)?Math.max(.25,Math.min(12,value.zoom)):1,
  panX:typeof value.panX==='number' && Number.isFinite(value.panX)?value.panX:0,
  panY:typeof value.panY==='number' && Number.isFinite(value.panY)?value.panY:0,
});

/** The chart root is created only for structural target changes. Lens, color,
 * social signal, and concept inserts update existing sprites/data items in place.
 */
export default function NetworkCanvas({targetId,refreshKey,theme,onProblemNodeSelect,
  onConceptNodeSelect,conceptAdded,revealProblem,signalVisible,signalVersion,onRestoreSignal,appearanceVersion,activityVersion}:Props){
  const {t,currentLens}=useTerminology();
  const lensRef=useRef(currentLens);lensRef.current=currentLens;
  const themeRef=useRef(theme);themeRef.current=theme;
  const selectProblemRef=useRef(onProblemNodeSelect);selectProblemRef.current=onProblemNodeSelect;
  const selectConceptRef=useRef(onConceptNodeSelect);selectConceptRef.current=onConceptNodeSelect;
  const restoreSignalRef=useRef(onRestoreSignal);restoreSignalRef.current=onRestoreSignal;
  const visibleRef=useRef(signalVisible);visibleRef.current=signalVisible;
  const chartHost=useRef<HTMLDivElement>(null);
  const zoomRef=useRef<am5.ZoomableContainer|null>(null);
  const repaintRef=useRef<(()=>void)|null>(null);
  const addConceptRef=useRef<((added:ConceptAdded)=>void)|null>(null);
  const syncCountsRef=useRef<(()=>Promise<void>)|null>(null);
  const resetRef=useRef<(()=>void)|null>(null);
  const revealRef=useRef<((problemId:number)=>void)|null>(null);
  const flushRef=useRef<(()=>void)|null>(null);
  const scheduleRef=useRef<(()=>void)|null>(null);
  const appearanceRef=useRef<Appearance>(DEFAULT_APPEARANCE);
  const signalRef=useRef(new Map<string,Signal>());
  const [message,setMessage]=useState('');
  const [problemCount,setProblemCount]=useState<number|null>(null);
  const [resetSequence,setResetSequence]=useState(0);

<<<<<<< HEAD
  useEffect(()=>{
    if(!targetId || !chartHost.current){setMessage('');setProblemCount(null);return;}
    let disposed=false;const abort=new AbortController();let root:am5.Root|null=null;
    let saveTimer:ReturnType<typeof setTimeout>|undefined;
    let cleanupListeners:()=>void=()=>{};
    let saved=EMPTY_VIEW;
    let expanded=new Set<string>();let focused:string|null=null;
    // A badge click must never also trigger the parent Problem detail handler.
    let suppressedProblemClick:string|null=null;
    type ConceptBadge={countLabel:am5.Label;
      badge:am5.Container; background:am5.Circle; hovered:boolean};
    type BadgeKind='concept'|'reviewed'|'unreviewed'|'problems';
    const metricBadges=new Map<string,{kind:BadgeKind,badge:am5.Container,
      label:am5.Label,fill:am5.Circle,hovered:boolean}[]>();
    const badgesByProblem=new Map<string,ConceptBadge>();
    let hoveredBadgeKey:string|null=null;
    const lastBearing=new Map<string,number>();
    // A badge must be positioned before it can become visible, even on the first frame.
    const requestedBadges=new Map<am5.Container,boolean>();
    let suppressNodeTooltip=false;
    let restoring=true;let resetting=false;
    setMessage('loading');setProblemCount(null);
    const viewUrl=`/api/targets/${encodeURIComponent(targetId)}/graph-view`;
    const snapshot=():GraphView=>{
      const zoom=zoomRef.current;
      const contents=zoom?.contents;
      const scale=contents?.get('scale');
      const x=contents?.get('x');const y=contents?.get('y');
      return {version:1,expanded:[...expanded],focused,
        zoom:typeof scale==='number'&&Number.isFinite(scale)?Math.max(.25,Math.min(12,scale)):1,
        panX:typeof x==='number'&&Number.isFinite(x)?x:0,
        panY:typeof y==='number'&&Number.isFinite(y)?y:0,
        signalVisible:visibleRef.current};
=======
  useEffect(() => {
    if (!targetId || !chartHost.current) {
      setMessage('Create a target or open the shared research library.');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    let root: am5.Root | null = null;
    setMessage('Loading research network…');

    const load = async () => {
      const response = await fetch(`/api/targets/${encodeURIComponent(targetId)}/amcharts-tree`, {
        credentials: 'same-origin', signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as {detail?: string};
        throw new Error(payload.detail || `Graph request failed (${response.status})`);
      }
      const tree = await response.json() as TreeNode;
      if (cancelled || !chartHost.current) return;

      root = am5.Root.new(chartHost.current);
      const color = palette[theme];
      const zoom = root.container.children.push(am5.ZoomableContainer.new(root, {
        width: am5.p100, height: am5.p100, wheelable: true, pinchZoom: true,
      }));
      zoomRef.current = zoom;
      const series = zoom.contents.children.push(am5hierarchy.ForceDirected.new(root, {
        valueField: 'value', categoryField: 'displayName', childDataField: 'children',
        idField: 'id', linkWithField: 'crossLinks',
        centerStrength: 0.5, manyBodyStrength: -20, nodePadding: 15,
        minRadius: 34, maxRadius: 83,
        singleBranchOnly: false, initialDepth: 1, downDepth: 1, topDepth: 0,
      }));
      series.nodes.template.setAll({
        tooltipText: '{category}', cursorOverStyle: 'pointer',
      });
      // Full catalog text is preserved in hover tooltips, not abbreviated previews.
      series.nodes.template.adapters.add('tooltipText', (value, node) => {
        const data = node.dataItem?.dataContext as TreeNode | undefined;
        return data?.name || value;
      });
      series.nodes.template.adapters.add('toggleKey', (key, target) => {
        const data = target.dataItem?.dataContext as TreeNode | undefined;
        return data?.type === 'problem' ? 'none' : key;
      });
      series.circles.template.setAll({
        fill: am5.color(color.node), stroke: am5.color(color.stroke),
        strokeWidth: 1.5, fillOpacity: 0.98,
      });
      // Bubble and font size grow modestly with title length; never alter data.
      series.circles.template.adapters.add('radius', (radius, target) => {
        const data = target.dataItem?.dataContext as TreeNode | undefined;
        return data?.labelRadius ?? radius;
      });
      series.outerCircles.template.setAll({
        stroke: am5.color(color.stroke), strokeWidth: 1.5, strokeOpacity: 0.9,
      });
      series.labels.template.setAll({
        fill: am5.color(color.text), fontSize: 11, textAlign: 'center',
        oversizedBehavior: 'wrap', maxWidth: 105,
      });
      series.labels.template.adapters.add('fontSize', (value, label) => {
        const data = label.dataItem?.dataContext as TreeNode | undefined;
        return data?.labelFontSize ?? value;
      });
      series.labels.template.adapters.add('maxWidth', (value, label) => {
        const data = label.dataItem?.dataContext as TreeNode | undefined;
        return data?.labelWidth ?? value;
      });
      series.links.template.setAll({
        stroke: am5.color(color.stroke), strokeOpacity: 0.26, strokeWidth: 1,
      });
      // Structural nodes retain the library's native drill-down behavior.
      // Problem nodes have no descendants and instead open the application modal.
      series.nodes.template.events.on('click', event => {
        const data = event.target.dataItem?.dataContext as TreeNode | undefined;
        if (data?.type !== 'problem' || typeof data.recordId !== 'number') return;
        (event.originalEvent as Event | undefined)?.stopPropagation?.();
        onSelectRef.current(data.recordId);
      });
      // Empty Targets/Streams/Categories have no Problem value to sum. Give
      // only those otherwise valueless branches a minimal display value.
      const withEmptyBranchValues = (node: TreeNode): TreeNode => {
        const children = node.children?.map(withEmptyBranchValues);
        const label = layoutGraphLabel(node.name, node.type);
        const presentation = {displayName: label.text, labelRadius: label.radius,
          labelFontSize: label.fontSize, labelWidth: label.maxWidth};
        if (children?.length) return {...node, ...presentation, children};
        return node.type === 'problem' ? {...node, ...presentation} :
          {...node, ...presentation, children: [], value: 100};
      };
      series.data.setAll([withEmptyBranchValues(tree)]);
      if (series.dataItems.length) series.set('selectedDataItem', series.dataItems[0]);
      series.appear(600, 80);
      const count = (node: TreeNode): number => (node.type === 'problem' ? 1 : (node.children || []).reduce((sum, item) => sum + count(item), 0));
      setMessage(`${count(tree)} problems · click branches to explore · click a problem to open details`);
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
    };
    const save=()=>{
      if(restoring || disposed || resetting)return;
      const body=snapshot();
      void fetch(viewUrl,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),keepalive:true}).catch(()=>{});
    };
    const schedule=()=>{if(restoring||disposed)return;clearTimeout(saveTimer);saveTimer=setTimeout(save,850);};
    scheduleRef.current=schedule;
    flushRef.current=()=>{clearTimeout(saveTimer);save();};
    const load=async()=>{
      const [response,viewResponse]=await Promise.all([
        fetch(`/api/targets/${encodeURIComponent(targetId)}/amcharts-tree`,{credentials:'same-origin',signal:abort.signal}),
        fetch(viewUrl,{credentials:'same-origin',signal:abort.signal}),
      ]);
      if(!response.ok)throw new Error((await response.json().catch(()=>({})))?.detail||`Graph request failed (${response.status})`);
      const tree=await response.json() as TreeNode;
      saved=viewResponse.ok?validView(await viewResponse.json() as Partial<GraphView>):EMPTY_VIEW;
      if(disposed||!chartHost.current)return;
      expanded=new Set(saved.expanded);focused=saved.focused;
      restoreSignalRef.current(saved.signalVisible);
      root=am5.Root.new(chartHost.current);
      const zoom=root.container.children.push(am5.ZoomableContainer.new(root,{
        width:am5.p100,height:am5.p100,wheelable:true,pinchZoom:true,
      }));
      zoomRef.current=zoom;
      const series=zoom.contents.children.push(am5hierarchy.ForceDirected.new(root,{
        valueField:'value',categoryField:'displayName',childDataField:'children',
        idField:'id',linkWithField:'crossLinks',centerStrength:.5,manyBodyStrength:-20,
        nodePadding:15,minRadius:34,maxRadius:83,singleBranchOnly:false,
        initialDepth:1,downDepth:1,topDepth:0,
      }));
      // A sibling overlay, NOT nested inside the hierarchy nodes. This isolates
      // badge pointer hits and tooltips from the parent node event handlers.
      const badgeLayer=zoom.contents.children.push(am5.Container.new(root,{
        width:am5.p100,height:am5.p100,isMeasured:false,
      }));
      const isOpen=(node:TreeNode)=>node.type==='target'||!!(node.stableKey&&expanded.has(node.stableKey));
      const badgeState=(kind:BadgeKind,open:boolean,palette:ThemeColors)=>{
        // Type the mapping before indexing it. Otherwise TS widens each key
        // to `string`, which fails under `keyof GraphBadgeColors` checking.
        const toggles:Record<BadgeKind,{open:keyof GraphBadgeColors;closed:keyof GraphBadgeColors}>={
          concept:{open:'showConceptOpen',closed:'showConceptClosed'},
          reviewed:{open:'showReviewedOpen',closed:'showReviewedClosed'},
          unreviewed:{open:'showUnreviewedOpen',closed:'showUnreviewedClosed'},
          problems:{open:'showProblemsOpen',closed:'showProblemsClosed'},
        };
        const stateKeys=toggles[kind];
        return palette[open?stateKeys.open:stateKeys.closed]===true;
      };
      const colored=(type:GraphRole)=>toColor(appearanceRef.current[themeRef.current][type]);
      const defaultStroke=()=>toColor(themeRef.current==='dark'?'#334155':'#cbd5e1');
      const textColor=()=>toColor(themeRef.current==='dark'?'#f8fafc':'#1e293b');
      // Give hierarchy nodes and the independent count badges different tooltips.
      // An explicit width plus semantic line breaks keeps long research statements legible.
      const nodeTooltip=am5.Tooltip.new(root,{getFillFromSprite:false});
      nodeTooltip.label.setAll({maxWidth:345,oversizedBehavior:'wrap',fontSize:13});
      const badgeTooltip=am5.Tooltip.new(root,{getFillFromSprite:false});
      badgeTooltip.label.setAll({maxWidth:220,oversizedBehavior:'wrap',fontSize:12});
      series.nodes.template.setAll({tooltipText:'{category}',tooltip:nodeTooltip,cursorOverStyle:'pointer'});
      const badgeAction=(key:string,count:number)=>
        `${expanded.has(key)?'Collapse':'Expand'} ${count} saved ${count===1?resolveEntity(lensRef.current,'concept').singular:resolveEntity(lensRef.current,'concept').plural}`;
      // Aggregate badges are informational. Only the Problem concept control
      // expands/collapses concept children; never advertise that action on ancestors.
      const badgeCopy=(kind:BadgeKind,count:number,node:TreeNode)=>{
        const scope=resolveEntity(lensRef.current,node.type).singular.toLowerCase();
        if(kind==='concept')return `${count} saved ${resolveEntity(lensRef.current,'concept').plural} in this ${scope}`;
        if(kind==='problems')return `${count} descendant ${resolveEntity(lensRef.current,'problem').plural} in this ${scope}`;
        const state=kind==='reviewed'?'reviewed':'unreviewed';
        return `${count} ${state} ${resolveEntity(lensRef.current,'finding').plural} in this ${scope}`;
      };
      const badgeHoverColor=(kind:BadgeKind,palette:ThemeColors)=>
        kind==='reviewed'?palette.badgeReviewedHover:
        kind==='unreviewed'?palette.badgeUnreviewedHover:
        kind==='problems'?palette.badgeProblemsHover:palette.badgeHover;
      const requestBadge=(badge:am5.Container,needed:boolean)=>{
        requestedBadges.set(badge,needed);
        if(!needed){badge.setAll({visible:false,forceHidden:true});badge.hideTooltip();}
        // placeBadges is the sole authority for making a badge visible after its
        // world-to-overlay position has been validated in the current frame.
      };
      const paintBadge=(key:string)=>{
        const control=badgesByProblem.get(key);
        const node=nodesByStable.get(key);
        if(!control||!node)return;
        const open=isOpen(node),palette=appearanceRef.current[themeRef.current];
        const count=node.conceptCount??0;
        const selected=palette[control.hovered?'badgeHover':open?'badgeOpen':'badgeClosed'];
        const enabled=palette.showConceptBadges && count>0;
        // Never make the collapse action unreachable when an administrator
        // hides expanded counters: keep the control softly visible.
        const shown=badgeState('concept',open,palette);
        const description=badgeAction(key,count);
        requestBadge(control.badge,enabled);
        control.badge.setAll({opacity:shown?(open?.7:1):.24,
          tooltipText:palette.showBadgeTooltips?description:'',ariaLabel:description});
        if(!palette.showBadgeTooltips)control.badge.hideTooltip();
        control.background.setAll({fill:toColor(selected),stroke:toColor(palette.problem),strokeWidth:2});
        control.countLabel.setAll({fill:contrastingText(selected),text:String(count)});
      };
      const metricFields:Record<BadgeKind,{field:keyof TreeNode;visible:keyof GraphBadgeColors;
        closed:keyof GraphBadgeColors;open:keyof GraphBadgeColors}>={
        concept:{field:'conceptCount',visible:'showConceptBadges',closed:'badgeClosed',open:'badgeOpen'},
        reviewed:{field:'reviewedCount',visible:'showReviewedBadges',closed:'badgeReviewed',open:'badgeReviewedOpen'},
        unreviewed:{field:'unreviewedCount',visible:'showUnreviewedBadges',closed:'badgeUnreviewed',open:'badgeUnreviewedOpen'},
        problems:{field:'problemCount',visible:'showProblemBadges',closed:'badgeProblems',open:'badgeProblemsOpen'},
      };
      const paintMetricBadges=(key:string)=>{
        const node=nodesByStable.get(key);if(!node)return;
        const palette=appearanceRef.current[themeRef.current];
        const open=isOpen(node);
        for(const entry of metricBadges.get(key)??[]){
          const config=metricFields[entry.kind];const count=Number(node[config.field]??0);
          const shown=count>0&&palette[config.visible]===true&&badgeState(entry.kind,open,palette);
          const hex=String(palette[open?config.open:config.closed]);
          const description=badgeCopy(entry.kind,count,node);
          requestBadge(entry.badge,shown);
          entry.badge.setAll({opacity:open?.72:1,
            tooltipText:palette.showBadgeTooltips?description:'',ariaLabel:description});
          if(!palette.showBadgeTooltips)entry.badge.hideTooltip();
          const activeColor=entry.hovered?badgeHoverColor(entry.kind,palette):hex;
          entry.label.setAll({text:String(count),fill:contrastingText(activeColor)});
          entry.fill.setAll({fill:toColor(activeColor),stroke:toColor(palette[node.type]),strokeWidth:2});
        }
      };
      // Problem text/circle opens details; ONLY this independent badge toggles concepts.
      const toggleConcepts=(node:TreeNode)=>{
        if(node.type!=='problem'||!node.stableKey||!node.conceptCount)return;
        const item=series.getDataItemById(node.id);
        if(!item)return;
        focused=node.stableKey;
        if(expanded.has(node.stableKey)){
          series.disableDataItem(item);
          expanded.delete(node.stableKey);
        }else{
          series.enableDataItem(item,1);
          expanded.add(node.stableKey);
        }
        paintBadge(node.stableKey);
        paintMetricBadges(node.stableKey);
        schedule();
      };
      series.nodes.template.setup=(node)=>{
        node.events.on('dataitemchanged',event=>{
          const item=event.newDataItem?.dataContext as TreeNode|undefined;
          if(!item?.stableKey || item.type==='concept' || metricBadges.has(item.stableKey))return;
          // All four counters are based on target-authorized server aggregates.
          // Only the concept badge on a Problem is interactive.
          const kindMetrics:[BadgeKind,keyof TreeNode,string][]=[
            ['concept','conceptCount','showConceptBadges'],
            ['reviewed','reviewedCount','showReviewedBadges'],
            ['unreviewed','unreviewedCount','showUnreviewedBadges'],
            ['problems','problemCount','showProblemBadges'],
          ];
          const extras=kindMetrics.filter(([kind])=>!(kind==='concept'&&item.type==='problem') &&
            !(kind==='problems'&&item.type==='problem'));
          const items:NonNullable<ReturnType<typeof metricBadges.get>>=[];
          for(const [kind,field] of extras){
            const count=Number(item[field]??0);
            const badge=badgeLayer.children.push(am5.Container.new(root!,{
              x:0,y:0,width:30,height:30,centerX:am5.p50,centerY:am5.p50,
              interactive:true,cursorOverStyle:'help',tooltip:badgeTooltip,forceHidden:true,visible:false,
              isMeasured:false,role:'img',
            }));
            const fill=badge.children.push(am5.Circle.new(root!,{
              x:15,y:15,radius:14,interactive:false,strokeWidth:1.5,
            }));
            const label=badge.children.push(am5.Label.new(root!,{
              x:15,y:15,centerX:am5.p50,centerY:am5.p50,
              fontSize:11,fontWeight:'600',text:String(count),interactive:false,
            }));
            const entry={kind,badge,label,fill,hovered:false};items.push(entry);
              // paintMetricBadges owns tooltip content and visibility.
            badge.events.on('pointerover',()=>{entry.hovered=true;hoveredBadgeKey=item.stableKey!;suppressNodeTooltip=true;node.hideTooltip();nodeTooltip.hide();nodeTooltip.set('forceHidden',true);paintMetricBadges(item.stableKey!);if(appearanceRef.current[themeRef.current].showBadgeTooltips)badge.showTooltip();});
            badge.events.on('pointerout',()=>{entry.hovered=false;badge.hideTooltip();if(hoveredBadgeKey===item.stableKey)hoveredBadgeKey=null;suppressNodeTooltip=false;nodeTooltip.set('forceHidden',false);paintMetricBadges(item.stableKey!);});
            badge.events.on('click',e=>{const native=e.originalEvent;
              if(native&&'stopPropagation' in native&&typeof native.stopPropagation==='function')native.stopPropagation();
            });
          }
          metricBadges.set(item.stableKey,items);
          paintMetricBadges(item.stableKey);
          if(item.type!=='problem'||typeof item.recordId!=='number')return;
          const key=item.stableKey;
          if(badgesByProblem.has(key))return;
          const badge=badgeLayer.children.push(am5.Container.new(root!,{
            x:0,y:0,width:36,height:36,
            centerX:am5.p50,centerY:am5.p50,isMeasured:false,
            interactive:true,cursorOverStyle:'pointer',
            role:'button',focusable:true,
            tooltip:badgeTooltip,
            forceHidden:true,visible:false,
          }));
          const background=badge.children.push(am5.Circle.new(root!,{
            x:17,y:17,radius:16,fill:toColor(DEFAULT_APPEARANCE.dark.badgeClosed),
            stroke:colored('problem'),strokeWidth:2,interactive:false,
          }));
          const countLabel=badge.children.push(am5.Label.new(root!,{
            x:17,y:17,centerX:am5.p50,centerY:am5.p50,
            text:String(item.conceptCount??0),fontSize:12,fontWeight:'600',
            fill:textColor(),textAlign:'center',interactive:false,
          }));
          badgesByProblem.set(key,{badge,countLabel,background,hovered:false});
          paintBadge(key);
          badge.events.on('pointerover',()=>{
            const control=badgesByProblem.get(key);
            if(!control)return;
            hoveredBadgeKey=key;
            control.hovered=true;
            suppressNodeTooltip=true;node.hideTooltip();nodeTooltip.hide();nodeTooltip.set('forceHidden',true);
            paintBadge(key);
            if(appearanceRef.current[themeRef.current].showBadgeTooltips)badge.showTooltip();
          });
          badge.events.on('pointerout',()=>{
            const control=badgesByProblem.get(key);
            if(control){control.hovered=false;paintBadge(key);}
            if(hoveredBadgeKey===key)hoveredBadgeKey=null;
            suppressNodeTooltip=false;nodeTooltip.set('forceHidden',false);badge.hideTooltip();
          });
          badge.events.on('click',badgeEvent=>{
            suppressedProblemClick=key;
            const nativeEvent=badgeEvent.originalEvent;
            if(nativeEvent && 'stopPropagation' in nativeEvent &&
                typeof nativeEvent.stopPropagation==='function'){
              nativeEvent.stopPropagation();
            }
            toggleConcepts(item);
            if(appearanceRef.current[themeRef.current].showBadgeTooltips)badge.showTooltip();
            setTimeout(()=>{if(suppressedProblemClick===key)suppressedProblemClick=null;},0);
          });
        });
        // When moving between parent and badge, the parent can still receive hover.
        node.events.on('pointerover',()=>{
          const key=(node.dataItem?.dataContext as TreeNode|undefined)?.stableKey;
          if((key&&hoveredBadgeKey===key)||suppressNodeTooltip)node.hideTooltip();
        });
      };
      series.nodes.template.adapters.add('tooltipText',(value,node)=>{
        const item=node.dataItem?.dataContext as TreeNode|undefined;
        if(!item)return value;
        if(item.stableKey===hoveredBadgeKey||suppressNodeTooltip)return '';
        const label=item.type==='concept'?'Concept':resolveEntity(lensRef.current,item.type).singular;
        const hint=item.type==='problem'&&item.conceptCount?
          `\n${item.conceptCount} saved concepts · use the numbered badge to expand`:'';
        return `${label}\n${wrapGraphTooltip(item.name,50)}${hint}`;
      });
      series.nodes.template.adapters.add('toggleKey',(key,node)=>{
        const item=node.dataItem?.dataContext as TreeNode|undefined;
        return item?.type==='problem'||item?.type==='concept'?'none':key;
      });
      series.circles.template.setAll({strokeWidth:1.5,fillOpacity:.98});
      series.circles.template.adapters.add('radius',(value,sprite)=>{
        const item=sprite.dataItem?.dataContext as TreeNode|undefined;return item?.labelRadius??value;
      });
      series.circles.template.adapters.add('fill',(value,sprite)=>{
        const item=sprite.dataItem?.dataContext as TreeNode|undefined;
        return item?colored(item.type):value;
      });
      series.circles.template.adapters.add('stroke',()=>defaultStroke());
      series.outerCircles.template.setAll({strokeWidth:1.5,strokeOpacity:.75});
      series.labels.template.setAll({fontSize:11,textAlign:'center',oversizedBehavior:'wrap',maxWidth:105});
      series.labels.template.adapters.add('fontSize',(value,label)=>{
        const item=label.dataItem?.dataContext as TreeNode|undefined;return item?.labelFontSize??value;
      });
      series.labels.template.adapters.add('maxWidth',(value,label)=>{
        const item=label.dataItem?.dataContext as TreeNode|undefined;return item?.labelWidth??value;
      });
      series.labels.template.adapters.add('fill',()=>textColor());
      series.links.template.setAll({strokeOpacity:.26,strokeWidth:1});
      series.links.template.adapters.add('stroke',()=>defaultStroke());
      repaintRef.current=()=>{
        series.circles.each(circle=>{
          const item=circle.dataItem?.dataContext as TreeNode|undefined;
          if(item)circle.setAll({fill:colored(item.type),stroke:defaultStroke()});
        });
        series.labels.each(label=>label.set('fill',textColor()));
        series.links.each(link=>link.set('stroke',defaultStroke()));
        badgesByProblem.forEach((_,key)=>paintBadge(key));
        metricBadges.forEach((_,key)=>paintMetricBadges(key));
        nodeTooltip.label.set('fill',textColor());
        badgeTooltip.label.set('fill',textColor());
        // The tooltip backgrounds are independent of node fill colors.
        for(const tooltip of [nodeTooltip,badgeTooltip]){
          tooltip.get('background')?.setAll({
            fill:toColor(themeRef.current==='dark'?'#1e293b':'#ffffff'),
            fillOpacity:.98,stroke:defaultStroke(),strokeOpacity:1,strokeWidth:1,
          });
        }
        series.outerCircles.each(circle=>{
          const item=circle.dataItem?.dataContext as TreeNode|undefined;
          const signal=item?.id?signalRef.current.get(item.id):undefined;
          const active=visibleRef.current&&signal?.enabled&&signal.score!=null&&(signal.count>0||signal.overridden);
          circle.setAll({stroke:active?toColor(themeRef.current==='dark'?'#a5b4c8':'#64748b'):defaultStroke(),
            strokeWidth:active?1.5+2.8*(signal!.score!-1)/9:1.5,
            strokeOpacity:active ? 0.5+0.5*(signal!.score!-1)/9 : 0.75});
        });
        placeBadges();
      };
      series.nodes.template.events.on('click',event=>{
        const item=event.target.dataItem?.dataContext as TreeNode|undefined;
        if(!item)return;
        if(item.stableKey)focused=item.stableKey;
        if(item.type==='problem'){
          (event.originalEvent as Event|undefined)?.stopPropagation?.();
          if(item.stableKey===suppressedProblemClick)return;
          if(typeof item.recordId==='number')selectProblemRef.current(item.recordId);
        }else if(item.type==='concept'){
          (event.originalEvent as Event|undefined)?.stopPropagation?.();
          if(item.solutionId)selectConceptRef.current(item.solutionId);
        }else if(item.stableKey){
          if(expanded.has(item.stableKey))expanded.delete(item.stableKey);
          else expanded.add(item.stableKey);
        }
        if(item.stableKey)paintMetricBadges(item.stableKey);
        schedule();
      });
      const nodesByStable=new Map<string,TreeNode>();
      const prepare=(node:TreeNode):TreeNode=>{
        const item=layoutGraphLabel(node.name,node.type);
        const children=node.children?.map(prepare);
        const count=node.conceptCount??(node.type==='problem'?(children?.filter(c=>c.type==='concept').length??0):undefined);
        const copy:TreeNode={...node,conceptCount:count,displayName:item.text,labelRadius:item.radius,
          labelFontSize:item.fontSize,labelWidth:item.maxWidth};
        if(children?.length)copy.children=children;
        else if(node.type!=='problem'&&node.type!=='concept'){copy.children=[];copy.value=100;}
        nodesByStable.set(node.stableKey??node.id,copy);
        return copy;
      };
      const parentsByStable=new Map<string,TreeNode>();
      const rememberParents=(node:TreeNode)=>{
        node.children?.forEach(child=>{
          if(child.stableKey)parentsByStable.set(child.stableKey,node);
          rememberParents(child);
        });
      };
      const rootNode=prepare(tree);
      rememberParents(rootNode);
      series.data.setAll([rootNode]);
      // Badge coordinates follow the live physics layout; the separate overlay
      // prevents parent node tooltip/click hit areas from covering the badges.
      const placeBadges=()=>{
        // One lookup pass per frame rather than a full circle scan per badge.
        const circleSprites=new Map<string,am5.Circle>();
        series.circles.each(circle=>{
          const key=(circle.dataItem?.dataContext as TreeNode|undefined)?.stableKey;
          if(key)circleSprites.set(key,circle);
        });
        const groups=new Set([...metricBadges.keys(),...badgesByProblem.keys()]);
        for(const key of groups){
          const nodeData=nodesByStable.get(key);
          const item=nodeData?series.getDataItemById(nodeData.id):undefined;
          const sprite=(item as any)?.get('node') as am5.Container|undefined;
          const all:am5.Container[]=[];
          if(badgesByProblem.has(key))all.push(badgesByProblem.get(key)!.badge);
          for(const badge of metricBadges.get(key)??[])all.push(badge.badge);
          const hide=(badge:am5.Container)=>{
            if(badge.get('visible')!==false||badge.get('forceHidden')!==true){
              badge.setAll({visible:false,forceHidden:true});
              badge.hideTooltip();
            }
          };
          // Never show a placeholder overlay at (0,0), nor a detached badge
          // when its hierarchy sprite is collapsed, removed or unavailable.
          if(!sprite||sprite.isHidden()||sprite.get('forceHidden')){
            for(const badge of all)hide(badge);
            continue;
          }
          // The node's container origin is NOT guaranteed to coincide with the
          // ForceDirected circle center. Resolve the actual amCharts Circle,
          // and transform both its center and one radial point into the overlay
          // coordinate system. This accounts for zoom/scale and layout transforms.
          const circle=circleSprites.get(key);
          const sourceRadius=circle?.get('radius');
          const center=circle?badgeLayer.toLocal(circle.toGlobal({x:0,y:0})):undefined;
          const edge=circle&&sourceRadius?badgeLayer.toLocal(circle.toGlobal({x:sourceRadius,y:0})):undefined;
          const radius=center&&edge?Math.hypot(edge.x-center.x,edge.y-center.y):NaN;
          if(!center||!Number.isFinite(center.x)||!Number.isFinite(center.y)||
             !Number.isFinite(radius)||!(radius>0)){
            for(const badge of all)hide(badge);
            continue;
          }
          const active=all.filter(badge=>requestedBadges.get(badge)===true);
          for(const badge of all)if(!active.includes(badge))hide(badge);
          if(!active.length)continue;
          const childPositions:Point[]=[];
          for(const child of nodeData?.children??[]){
            const childItem=series.getDataItemById(child.id);
            const childSprite=(childItem as any)?.get('node') as am5.Container|undefined;
            if(childSprite&&!childSprite.isHidden()&&!childSprite.get('forceHidden')){
              const point=badgeLayer.toLocal(childSprite.toGlobal({x:0,y:0}));
              if(Number.isFinite(point.x)&&Number.isFinite(point.y))childPositions.push(point);
            }
          }
          // Prefer visible child-link bearings; for collapsed branches retain
          // the last bearing or aim away from the incoming parent connection.
          const parent=parentsByStable.get(key);
          const ancestorItem=parent?series.getDataItemById(parent.id):undefined;
          const ancestorSprite=(ancestorItem as any)?.get('node') as am5.Container|undefined;
          const ancestor=ancestorSprite?badgeLayer.toLocal(ancestorSprite.toGlobal({x:0,y:0})):undefined;
          const angle=badgeDirections(childPositions,center,ancestor,lastBearing.get(key));
          if(!Number.isFinite(angle)){
            for(const badge of all)hide(badge);
            continue;
          }
          if(childPositions.length)lastBearing.set(key,angle);
          const positions=perimeterBadges(center,radius,angle,active.length);
          active.forEach((badge,index)=>{
            const computed=positions[index];
            const zoomScale=zoom.contents.get('scale')??1;
            const local=computed?alignOverlayBadge(computed,4,-4,zoomScale):undefined;
            if(!local||!Number.isFinite(local.x)||!Number.isFinite(local.y)){
              hide(badge);return;
            }
            // Position first, reveal second. The overlay never flashes a badge
            // at its creation coordinates, including after palette updates.
            if(!Number.isFinite(badge.x())||!Number.isFinite(badge.y())||
               Math.abs(badge.x()-local.x)>.5||Math.abs(badge.y()-local.y)>.5||
               badge.get('forceHidden')!==false||badge.get('visible')!==true){
              badge.setAll({x:local.x,y:local.y,forceHidden:false,visible:true});
            }
          });
        }
      };
      // This listener only moves overlays; no ForceDirected data reset or Root creation.
      root.events.on('frameended',placeBadges);

      if(series.dataItems.length)series.set('selectedDataItem',series.dataItems[0]);
      // Restore only keys present in the current authorized tree; stale records are ignored.
      const depths:{key:string;depth:number}[]=[];
      const collect=(node:TreeNode,depth:number)=>{
        if(node.stableKey&&expanded.has(node.stableKey))depths.push({key:node.stableKey,depth});
        node.children?.forEach(child=>collect(child,depth+1));
      };
      collect(rootNode,0);
      depths.sort((a,b)=>a.depth-b.depth);
      root.events.once('frameended',()=>{
        if(disposed)return;
        for(const {key} of depths){
          const node=nodesByStable.get(key);
          const dataItem=node?series.getDataItemById(node.id):undefined;
          if(dataItem){series.selectDataItem(dataItem);series.enableDataItem(dataItem,1);}
        }
        // ZoomableContainer stores camera transformation on contents; never
        // persist transient physics positions of individual nodes.
        if(saved.zoom!==1||saved.panX!==0||saved.panY!==0){
          zoom.contents.setAll({scale:saved.zoom,x:saved.panX,y:saved.panY});
        }
        restoring=false;
        repaintRef.current?.();
      });
      const pointerSave=()=>schedule();
      const pageSave=()=>{clearTimeout(saveTimer);save();};
      chartHost.current.addEventListener('pointerup',pointerSave);
      chartHost.current.addEventListener('wheel',pointerSave,{passive:true});
      window.addEventListener('pagehide',pageSave);
      const element=chartHost.current;
      cleanupListeners=()=>{
        element.removeEventListener('pointerup',pointerSave);
        element.removeEventListener('wheel',pointerSave);
        window.removeEventListener('pagehide',pageSave);
      };
      revealRef.current=(problemId)=>{
        const parent=nodesByStable.get('problem:'+problemId);
        const item=parent?series.getDataItemById(parent.id):undefined;
        if(!item)return;
        if(!parent?.conceptCount)return;
        expanded.add('problem:'+problemId);
        series.enableDataItem(item,1);
        paintBadge('problem:'+problemId);
        paintMetricBadges('problem:'+problemId);
        schedule();
      };
      addConceptRef.current=(added)=>{
        const key='concept:'+added.id;
        if(nodesByStable.has(key))return;
        const parent=nodesByStable.get('problem:'+added.originProblemId);
        if(!parent)return;
        const parentItem=series.getDataItemById(parent.id);
        if(!parentItem)return;
        const entry=prepare({id:'solution:'+added.id,stableKey:key,solutionId:added.id,
          name:added.name,type:'concept',value:30});
        // amCharts' public incremental hierarchy API retains the Root/camera.
        series.addChildData(parentItem,[entry]);
        // Some amCharts versions mutate the original dataContext in addChildData.
        // Avoid creating a duplicate concept in the projection on those versions.
        if(!parent.children)parent.children=[];
        if(!parent.children.some(child=>child.stableKey===key))parent.children.push(entry);
        parentsByStable.set(key,parent);
        parent.conceptCount=(parent.conceptCount??0)+1;
        // In-memory hierarchy summaries also reflect the newly saved concept.
        const bump=(branch:TreeNode):boolean=>{
          if(branch===parent)return true;
          if(branch.children?.some(child=>bump(child))){
            branch.conceptCount=(branch.conceptCount??0)+1;
            if(branch.stableKey)paintMetricBadges(branch.stableKey);
            return true;
          }
          return false;
        };
        bump(rootNode);
        paintMetricBadges(parent.stableKey!);
        const badge=badgesByProblem.get('problem:'+added.originProblemId);
        if(badge){
          badge.countLabel.set('text',String(parent.conceptCount));
          paintBadge('problem:'+added.originProblemId);
        }
        revealRef.current?.(added.originProblemId);
        repaintRef.current?.();schedule();
      };
      syncCountsRef.current=async()=>{
        const response=await fetch(`/api/targets/${encodeURIComponent(targetId)}/amcharts-tree`,{credentials:'same-origin'});
        if(!response.ok||disposed)return;
        const latest=await response.json() as TreeNode;
        const activeConcepts=new Set<string>();
        const walk=(item:TreeNode)=>{
          if(item.type==='concept'&&item.stableKey)activeConcepts.add(item.stableKey);
          const previous=nodesByStable.get(item.stableKey??item.id);
          if(previous){
            previous.conceptCount=item.conceptCount;
            previous.reviewedCount=item.reviewedCount;
            previous.unreviewedCount=item.unreviewedCount;
            previous.problemCount=item.problemCount;
            if(previous.stableKey){paintMetricBadges(previous.stableKey);paintBadge(previous.stableKey);}
          }
          item.children?.forEach(walk);
        };
        walk(latest);
        const attachMissing=(item:TreeNode,parent?:TreeNode)=>{
          if(item.type==='concept' && item.stableKey){
            const prior=nodesByStable.get(item.stableKey);
            if(prior){
              const existing=series.getDataItemById(prior.id);
              (existing as any)?.get('node')?.set('forceHidden',false);
              if(parent?.stableKey&&expanded.has(parent.stableKey)&&existing)series.enableDataItem(existing,1);
            }else if(parent?.stableKey){
              const original=nodesByStable.get(parent.stableKey);
              const dataItem=original?series.getDataItemById(original.id):undefined;
              if(dataItem){
                const child=prepare(item);
                series.addChildData(dataItem,[child]);
                if(!original!.children)original!.children=[];
                if(!original!.children.some(entry=>entry.stableKey===child.stableKey))original!.children.push(child);
                if(child.stableKey)parentsByStable.set(child.stableKey,original!);
              }
            }
          }
          item.children?.forEach(child=>attachMissing(child,item));
        };
        attachMissing(latest);
        // Rejected concepts no longer appear as available graph nodes.
        for(const [key,entry] of nodesByStable){
          if(entry.type==='concept'&&!activeConcepts.has(key)){
            const dataItem=series.getDataItemById(entry.id);
            if(dataItem){series.disableDataItem(dataItem,0);(dataItem as any).get('node')?.set('forceHidden',true);}
          }
        }
        repaintRef.current?.();
      };
      resetRef.current=()=>{
        resetting=true;clearTimeout(saveTimer);
        // An explicit user reset is permitted to reconstruct the initial view.
        // Unlike normal interaction, this intentionally clears all expanded paths.
        void fetch(viewUrl,{method:'PUT',credentials:'same-origin',
          headers:{'Content-Type':'application/json'},body:JSON.stringify(EMPTY_VIEW)})
          .then(response=>{if(!response.ok)throw Error('Could not reset view');
            restoreSignalRef.current(false);setResetSequence(old=>old+1);})
          .catch(()=>{resetting=false;});
      };
      series.appear(600,80);
      setProblemCount([...nodesByStable.values()].filter(x=>x.type==='problem').length);
      setMessage('');
      if(visibleRef.current)void refreshSignals(targetId,signalRef,repaintRef);
    };
    void load().catch((error:Error)=>{if(!disposed&&error.name!=='AbortError')setMessage(error.message);});
    return ()=>{
      if(!restoring&&!resetting){clearTimeout(saveTimer);save();}
      disposed=true;abort.abort();cleanupListeners();
      repaintRef.current=null;addConceptRef.current=null;syncCountsRef.current=null;resetRef.current=null;revealRef.current=null;
      flushRef.current=null;scheduleRef.current=null;zoomRef.current=null;
      root?.dispose();
    };
  },[targetId,refreshKey,resetSequence]);

  useEffect(()=>{
    let active=true;
    void fetch('/api/graph/appearance',{credentials:'same-origin'}).then(r=>r.ok?r.json():null)
      .then((value:Appearance|null)=>{
        if(active&&value){appearanceRef.current=normalizeAppearance(value);repaintRef.current?.();}
      }).catch(()=>{});
    return()=>{active=false};
  },[appearanceVersion]);
  useEffect(()=>{repaintRef.current?.();},[theme]);
  useEffect(()=>{
    if(signalVisible&&targetId)void refreshSignals(targetId,signalRef,repaintRef);
    else repaintRef.current?.();
    scheduleRef.current?.();
  },[signalVisible,signalVersion,targetId]);
  useEffect(()=>{if(conceptAdded)addConceptRef.current?.(conceptAdded);},[conceptAdded]);
  useEffect(()=>{if(activityVersion)void syncCountsRef.current?.().catch(()=>{});},[activityVersion]);
  useEffect(()=>{if(revealProblem)revealRef.current?.(revealProblem.problemId);},[revealProblem]);

  const status=problemCount!=null?t('app.graphHint',{count:problemCount}):
    message==='loading'?t('app.graphLoading'):message||(targetId?t('app.graphNoTarget'):t('app.graphCreate'));
  return <div className="network-background">
    <div id="chartdiv" ref={chartHost} className="network-chart" aria-label={t('app.graphAria')}/>
    <div className="network-controls" aria-label="Graph zoom controls">
      <button type="button" title="Zoom in" onClick={()=>{zoomRef.current?.zoomIn();scheduleRef.current?.();}}><ZoomIn size={16}/></button>
      <button type="button" title="Zoom out" onClick={()=>{zoomRef.current?.zoomOut();scheduleRef.current?.();}}><ZoomOut size={16}/></button>
      <button type="button" title="Fit graph" onClick={()=>{zoomRef.current?.goHome();scheduleRef.current?.();}}><Maximize2 size={16}/></button>
      <button type="button" title="Reset saved graph view" onClick={()=>resetRef.current?.()}><RotateCcw size={16}/></button>
    </div>
    <div className="network-hint" role="status">{status}</div>
  </div>;
}

async function refreshSignals(targetId:string,
  signalsRef:MutableRefObject<Map<string,Signal>>,
  repaintRef:MutableRefObject<(()=>void)|null>){
  const response=await fetch(`/api/targets/${encodeURIComponent(targetId)}/signals/graph`,{credentials:'same-origin'});
  if(!response.ok)return;
  const result=await response.json() as {nodes:({graphId:string}&Signal)[]};
  // The signal graph endpoint still uses elementId for the current in-memory chart.
  signalsRef.current=new Map(result.nodes.map(n=>[n.graphId,n]));
  repaintRef.current?.();
}
