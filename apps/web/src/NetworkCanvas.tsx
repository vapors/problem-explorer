import {useEffect, useRef, useState} from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5hierarchy from '@amcharts/amcharts5/hierarchy';
import {Maximize2, ZoomIn, ZoomOut} from 'lucide-react';

export type TreeNode = {
  id: string;
  name: string;
  type: 'target' | 'stream' | 'category' | 'problem';
  children?: TreeNode[];
  value?: number;
  recordId?: number;
  crossLinks?: string[];
};

type Theme = 'light' | 'dark';
type Props = {
  targetId: string | null;
  refreshKey: number;
  theme: Theme;
  onProblemNodeSelect: (recordId: number) => void;
};

const palette = {
  dark: {canvas: 0x0f172a, node: 0x1e293b, stroke: 0x334155, text: 0xf8fafc},
  light: {canvas: 0xf8fafc, node: 0xffffff, stroke: 0xe2e8f0, text: 0x1e293b},
};

// One persistent chart surface; data changes cause a clean amCharts root disposal.
// The API's elementIds are never parsed as the application's numeric Problem.id.
export default function NetworkCanvas({targetId, refreshKey, theme, onProblemNodeSelect}: Props) {
  const chartHost = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<am5.ZoomableContainer | null>(null);
  const onSelectRef = useRef(onProblemNodeSelect);
  const [message, setMessage] = useState('Select a target, then explore its research streams.');
  onSelectRef.current = onProblemNodeSelect;

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
        valueField: 'value', categoryField: 'name', childDataField: 'children',
        idField: 'id', linkWithField: 'crossLinks',
        centerStrength: 0.5, manyBodyStrength: -20, nodePadding: 15,
        minRadius: 10, maxRadius: 40,
        singleBranchOnly: false, initialDepth: 1, downDepth: 1, topDepth: 0,
      }));
      series.nodes.template.setAll({
        tooltipText: '{category}', cursorOverStyle: 'pointer',
      });
      series.nodes.template.adapters.add('toggleKey', (key, target) => {
        const data = target.dataItem?.dataContext as TreeNode | undefined;
        return data?.type === 'problem' ? 'none' : key;
      });
      series.circles.template.setAll({
        fill: am5.color(color.node), stroke: am5.color(color.stroke),
        strokeWidth: 1.5, fillOpacity: 0.98,
      });
      // Circle radii are determined by semantic role, rather than arbitrary
      // label length or overall branch population.
      series.circles.template.adapters.add('radius', (radius, target) => {
        const data = target.dataItem?.dataContext as TreeNode | undefined;
        if (data?.type === 'target') return 37;
        if (data?.type === 'stream') return 27;
        if (data?.type === 'category') return 19;
        if (data?.type === 'problem') return 11;
        return radius;
      });
      series.outerCircles.template.setAll({
        stroke: am5.color(color.stroke), strokeWidth: 1.5, strokeOpacity: 0.9,
      });
      series.labels.template.setAll({
        fill: am5.color(color.text), fontSize: 11, oversizedBehavior: 'truncate',
        maxWidth: 210, textAlign: 'center',
      });
      series.labels.template.adapters.add('text', (value, label) => {
        const data = label.dataItem?.dataContext as TreeNode | undefined;
        const text = data?.name || value || '';
        return data?.type === 'problem' && text.length > 54 ? `${text.slice(0, 53)}…` : text;
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
        return children?.length ? {...node, children} :
          node.type === 'problem' ? node : {...node, children: [], value: 100};
      };
      series.data.setAll([withEmptyBranchValues(tree)]);
      if (series.dataItems.length) series.set('selectedDataItem', series.dataItems[0]);
      series.appear(600, 80);
      const count = (node: TreeNode): number => (node.type === 'problem' ? 1 : (node.children || []).reduce((sum, item) => sum + count(item), 0));
      setMessage(`${count(tree)} problems · click branches to explore · click a problem to open details`);
    };
    load().catch((error: Error) => { if (!cancelled && error.name !== 'AbortError') setMessage(error.message); });
    return () => {
      cancelled = true;
      controller.abort();
      zoomRef.current = null;
      root?.dispose();
    };
  }, [targetId, refreshKey, theme]);

  return <div className="network-background">
    <div id="chartdiv" ref={chartHost} className="network-chart" aria-label="Interactive target research network"/>
    <div className="network-controls" aria-label="Graph zoom controls">
      <button type="button" title="Zoom in" onClick={() => zoomRef.current?.zoomIn()}><ZoomIn size={16}/></button>
      <button type="button" title="Zoom out" onClick={() => zoomRef.current?.zoomOut()}><ZoomOut size={16}/></button>
      <button type="button" title="Fit graph" onClick={() => zoomRef.current?.goHome()}><Maximize2 size={16}/></button>
    </div>
    <div className="network-hint" role="status">{message}</div>
  </div>;
}
