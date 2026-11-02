import React from 'react';
import {Rnd} from 'react-rnd';
import {ChevronDown, ChevronUp, X} from 'lucide-react';
import {useTerminology} from './contexts/TerminologyContext';

export type PanelId = 'navigation' | 'targetExplorer' | 'overview' | 'directory' | 'problems' | 'research' |
  'problemResearch' | 'discovery' | 'concepts' | 'generateConcepts' | 'rejected' | 'rejectedConcepts' | 'matching' | 'evaluation' | 'manage' | 'admin' | 'signals' | 'appearance';
export type PanelLayout = {
  isOpen: boolean;
  isCollapsed: boolean;
  x: number; y: number; width: number; height: number; z: number;
};
export type PanelLayouts = Record<PanelId, PanelLayout>;

export const initialLayouts: PanelLayouts = {
  navigation: {isOpen: true, isCollapsed: false, x: 12, y: 70, width: 248, height: 610, z: 10},
  targetExplorer: {isOpen: false, isCollapsed: false, x: 270, y: 85, width: 420, height: 650, z: 11},
  overview: {isOpen: true, isCollapsed: false, x: 0, y: 72, width: 420, height: 760, z: 12},
  directory: {isOpen: false, isCollapsed: false, x: 310, y: 105, width: 650, height: 580, z: 12},
  problems: {isOpen: false, isCollapsed: false, x: 310, y: 100, width: 690, height: 650, z: 12},
  research: {isOpen: false, isCollapsed: false, x: 330, y: 95, width: 720, height: 700, z: 12},
  problemResearch: {isOpen:false,isCollapsed:false,x:355,y:105,width:720,height:690,z:12},
  discovery: {isOpen: false, isCollapsed: false, x: 335, y: 105, width: 670, height: 650, z: 12},
  concepts: {isOpen: false, isCollapsed: false, x: 320, y: 100, width: 780, height: 690, z: 12},
  generateConcepts: {isOpen: false, isCollapsed: false, x: 335, y: 110, width: 715, height: 680, z: 12},
  rejectedConcepts: {isOpen:false,isCollapsed:false,x:375,y:115,width:650,height:650,z:12},
  rejected: {isOpen: false, isCollapsed: false, x: 365, y: 105, width: 680, height: 650, z: 12},
  matching: {isOpen: false, isCollapsed: false, x: 340, y: 120, width: 700, height: 650, z: 12},
  evaluation: {isOpen: false, isCollapsed: false, x: 350, y: 105, width: 760, height: 680, z: 12},
  manage: {isOpen: false, isCollapsed: false, x: 310, y: 115, width: 750, height: 680, z: 12},
  admin: {isOpen: false, isCollapsed: false, x: 300, y: 100, width: 900, height: 690, z: 12},
  appearance: {isOpen:false,isCollapsed:false,x:390,y:125,width:460,height:490,z:12},
  signals: {isOpen: false, isCollapsed: false, x: 365, y: 105, width: 650, height: 695, z: 12},
};

export function viewportLayouts(): PanelLayouts {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const result = {} as PanelLayouts;
  (Object.keys(initialLayouts) as PanelId[]).forEach(id => {
    const layout = initialLayouts[id];
    const width = Math.min(layout.width, Math.max(240, screenWidth - 24));
    const height = Math.min(layout.height, Math.max(180, screenHeight - 100));
    const panelWidth = id==='overview' ? Math.min(width,Math.max(250,screenWidth-284)) : width;
    const panelX = id==='overview' ? screenWidth-panelWidth-14 : layout.x;
    const panelHeight = id==='navigation' ? Math.max(190,screenHeight-88)
      : id==='overview' ? Math.max(190,screenHeight-100) : height;
    result[id] = {...layout, width: panelWidth, height: panelHeight,
      x: Math.max(8, Math.min(panelX, screenWidth - panelWidth - 12)),
      y: Math.max(64, Math.min(layout.y, screenHeight - 52))};
  });
  return result;
}

type Props = {
  id: PanelId;
  title: string;
  state: PanelLayout;
  update: (id: PanelId, patch: Partial<PanelLayout>) => void;
  focus: (id: PanelId) => void;
  children: React.ReactNode;
};
export default function FloatingPanel({id, title, state, update, focus, children}: Props) {
  const {t}=useTerminology();
  if (!state.isOpen) return null;
  return <Rnd
    className={'floating-window'+(state.isCollapsed ? ' is-collapsed' : '')}
    style={{zIndex: state.z, pointerEvents: 'auto'}}
    size={{width: state.width, height: state.isCollapsed ? 44 : state.height}}
    position={{x: state.x, y: state.y}}
    bounds="window" minWidth={240} minHeight={44}
    enableResizing={!state.isCollapsed}
    dragHandleClassName="window-drag-bar" cancel=".window-actions, input, select, textarea, button, a"
    onMouseDown={() => focus(id)}
    onDragStop={(_event, data) => update(id, {x: data.x, y: data.y})}
    onResizeStop={(_event, _direction, element, _delta, position) =>
      update(id, {width: element.offsetWidth, height: element.offsetHeight, ...position})}
  >
    <div className="floating-window-inner">
      <div className="window-drag-bar">
        <span className="window-grip" aria-hidden="true">⠿</span>
        <strong>{title}</strong>
        <div className="window-actions">
          <button type="button" title={state.isCollapsed ? t('app.panelExpand') : t('app.panelCollapse')}
            aria-label={state.isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={() => {focus(id); update(id, {isCollapsed: !state.isCollapsed});}}>
            {state.isCollapsed ? <ChevronDown size={15}/> : <ChevronUp size={15}/>}
          </button>
          <button type="button" title={t('app.panelClose')} aria-label={`Close ${title}`}
            onClick={() => update(id, {isOpen: false})}><X size={15}/></button>
        </div>
      </div>
      {!state.isCollapsed && <div className="floating-window-body">{children}</div>}
    </div>
  </Rnd>;
}
