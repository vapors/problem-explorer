import {useEffect, useMemo, useRef} from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5radar from '@amcharts/amcharts5/radar';
import {tenPoint} from './scoreScale';
import {useTerminology} from './contexts/TerminologyContext';

export const FACTORS = ['desirability','feasibility','viability','impact','coverage'] as const;
export type ScoreFactor = {factor: string; score:number|null; basis?:'evidence'|'inference'|'unknown'};
export type SocialFactor = {factor:string;score:number;sourceCount:number};

export default function EvaluationRadar({factors,socialFactors,theme,exploratory,scoreMax=10}: {
  factors:ScoreFactor[];socialFactors?:SocialFactor[];
  theme:'light'|'dark';exploratory:boolean;scoreMax?:5|10;
}) {
  const {t}=useTerminology();
  const host=useRef<HTMLDivElement>(null);
  const data=useMemo(()=>FACTORS.map(factor=>{
    const current=factors.find(f=>f.factor===factor);
    const social=socialFactors?.find(f=>f.factor===factor && f.sourceCount>0);
    return {factor, score:tenPoint(current?.score,scoreMax),
      social:social && Number.isFinite(social.score) && social.score>=1 && social.score<=10?social.score:undefined};
  }),[factors,socialFactors,scoreMax]);
  const complete=data.filter(x=>x.score!==undefined).length;
  const socialComplete=data.filter(x=>x.social!==undefined).length;
  useEffect(()=>{
    if(!host.current)return;
    const root=am5.Root.new(host.current);
    const dark=theme==='dark';
    const ink=am5.color(dark?0xe2e8f0:0x334155);
    const grid=am5.color(dark?0x475569:0xcbd5e1);
    const mainInk=am5.color(dark?0xe2e8f0:0x475569);
    const socialInk=am5.color(dark?0x94a3b8:0x64748b);
    const chart=root.container.children.push(am5radar.RadarChart.new(root,{
      panX:false,panY:false,wheelX:'none',wheelY:'none',innerRadius:am5.percent(5),radius:am5.percent(76),
    }));
    const rendererX=am5radar.AxisRendererCircular.new(root,{minGridDistance:25});
    rendererX.labels.template.setAll({fill:ink,fontSize:11,textType:'adjusted',radius:14});
    rendererX.grid.template.setAll({stroke:grid,strokeOpacity:0.15});
    const xAxis=chart.xAxes.push(am5xy.CategoryAxis.new(root,{categoryField:'factor',renderer:rendererX}));
    const rendererY=am5radar.AxisRendererRadial.new(root,{minGridDistance:28});
    rendererY.labels.template.setAll({fill:ink,fontSize:10});
    rendererY.grid.template.setAll({stroke:grid,strokeOpacity:0.3});
    const yAxis=chart.yAxes.push(am5xy.ValueAxis.new(root,{min:1,max:10,strictMinMax:true,renderer:rendererY,numberFormat:'#.#'}));
    xAxis.data.setAll(data);
    // Nulls are omitted rather than converted to zero or 1. Sparse scores have
    // point markers and open segments, not a fabricated, closed polygon.
    const main=chart.series.push(am5radar.RadarLineSeries.new(root,{
      name:exploratory?t('radar.exploratory'):t('radar.evidence'),
      xAxis,yAxis,categoryXField:'factor',valueYField:'score',
      connectEnds:complete===5,connect:false,stroke:mainInk,fill:mainInk,
      tooltip:am5.Tooltip.new(root,{labelText:'{categoryX}: {valueY}/10'}),
    }));
    main.strokes.template.setAll({strokeWidth:2.5,strokeDasharray:exploratory?[6,3]:[]});
    main.fills.template.setAll({visible:complete===5,fillOpacity:complete===5?0.09:0});
    main.data.setAll(data);
    main.bullets.push((_root,_series,dataItem)=>{
      if (dataItem.get('valueY')==null)return undefined;
      return am5.Bullet.new(root,{sprite:am5.Circle.new(root,{radius:5,fill:mainInk,stroke:grid,strokeWidth:1})});
    });
    if(socialComplete){
      const social=chart.series.push(am5radar.RadarLineSeries.new(root,{
        name:t('radar.social'),xAxis,yAxis,
        categoryXField:'factor',valueYField:'social',connectEnds:socialComplete===5,connect:false,
        stroke:socialInk,fill:socialInk,
        tooltip:am5.Tooltip.new(root,{labelText:'Social discussion · {categoryX}: {valueY}/10'}),
      }));
      social.strokes.template.setAll({strokeWidth:2,strokeDasharray:[3,4]});
      social.fills.template.setAll({visible:false});
      social.data.setAll(data);
      social.bullets.push((_root,_series,dataItem)=>{
        if(dataItem.get('valueY')==null)return undefined;
        return am5.Bullet.new(root,{sprite:am5.Circle.new(root,{radius:4,fill:socialInk})});
      });
    }
    chart.appear(350,40);
    return ()=>root.dispose();
  },[data,theme,exploratory,complete,socialComplete]);
  // The source radar is a chart-only stage. Review status remains available
  // via the accessible description and individual factor cards below the chart.
  return <div className="radar-shell">
    <div ref={host} className="amcharts-radar" role="img" aria-label={t('radar.description',{count:complete})}/>
  </div>;
}
