/** Pure geometry for positioning hierarchy badges around the nearest edge of a node.
 * Coordinates are in one global Cartesian coordinate system, independent of zoom.
 * The preferred axis points toward rendered children; when collapsed, callers
 * reuse a cached direction or use the direction away from the parent link.
 */
export type Point={x:number;y:number};
export function badgeDirections(children:Point[], center:Point, ancestor?:Point, previous?:number):number {
  const visible=children.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(visible.length){
    const centroid={x:visible.reduce((s,p)=>s+p.x,0)/visible.length,
      y:visible.reduce((s,p)=>s+p.y,0)/visible.length};
    const dx=centroid.x-center.x,dy=centroid.y-center.y;
    if(dx*dx+dy*dy>36)return Math.atan2(dy,dx);
  }
  if(previous!==undefined&&Number.isFinite(previous))return previous;
  if(ancestor){const dx=center.x-ancestor.x,dy=center.y-ancestor.y;
    if(dx*dx+dy*dy>36)return Math.atan2(dy,dx);
  }
  return -Math.PI/2;
}
export function perimeterBadges(center:Point,radius:number,direction:number,count:number):Point[]{
  if(!count)return [];
  // Each badge is 28–34px in diameter; space its siblings around a short arc.
  const distance=radius+13; // Exact transformed circle edge + badge radius, no fixed minimum offset
  const spread=Math.min(.55,Math.max(.28,30/distance));
  return Array.from({length:count},(_,i)=>{
    // Center the arc on the child connection, not on an invisible sibling.
    const angle=direction+(i-(count-1)/2)*spread;
    return {x:center.x+distance*Math.cos(angle),y:center.y+distance*Math.sin(angle)};
  });
}

/** Small, screen-space optical correction for independent overlay circles.
 * The overlay badge and hierarchy circle have separate center-anchor semantics.
 * Keeping this correction in overlay pixels prevents zooming it along with data.
 * It does not modify saved node positions, chart camera, or force simulation.
 */
export function alignOverlayBadge(point:Point, dx=4, dy=-4, zoomScale=1):Point {
  const scale=Number.isFinite(zoomScale)&&zoomScale>0?zoomScale:1;
  return {x:point.x+dx/scale,y:point.y+dy/scale};
}
