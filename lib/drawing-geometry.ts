import type {Point,Markup,Sheet} from './review-types';
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function segmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return distance(p,{x:a.x+t*dx,y:a.y+t*dy})}
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function intersects(a:Point,b:Point,c:Point,d:Point){const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);if(((ab1>0&&ab2<0)||(ab1<0&&ab2>0))&&((cd1>0&&cd2<0)||(cd1<0&&cd2>0)))return true;return [segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b)].some(v=>v<1e-7)}
export function segmentGap(a:Point,b:Point,c:Point,d:Point){return intersects(a,b,c,d)?0:Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b))}
export function areaPoints(points:Point[]){if(points.length!==2)return points;const[a,b]=points;return[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}]}
export function polygonArea(points:Point[]){return Math.abs(points.reduce((v,p,i)=>{const n=points[(i+1)%points.length];return v+p.x*n.y-n.x*p.y},0))/2}
export function polygonCrosses(points:Point[],closed=true){const count=points.length-(closed?0:1);for(let i=0;i<count;i++)for(let j=i+2;j<count;j++){if(closed&&i===0&&j===count-1)continue;if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return true}return false}
export function validArea(points:Point[]){return points.length>=3&&polygonArea(points)>1e-5&&!polygonCrosses(points)&&points.every((p,i)=>distance(p,points[(i+1)%points.length])>1e-5)}
export function inPolygon(p:Point,points:Point[]){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(((a.y>p.y)!==(b.y>p.y))&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
export function polygonLabel(points:Point[]){let sum=0,x=0,y=0;points.forEach((a,i)=>{const b=points[(i+1)%points.length],c=a.x*b.y-b.x*a.y;sum+=c;x+=(a.x+b.x)*c;y+=(a.y+b.y)*c});const center=Math.abs(sum)>1e-8?{x:x/(3*sum),y:y/(3*sum)}:points[0];if(inPolygon(center,points))return center;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY;let best=points[0],gap=-1;for(let i=1;i<20;i++)for(let j=1;j<20;j++){const p={x:minX+w*i/20,y:minY+h*j/20};if(!inPolygon(p,points))continue;const g=Math.min(...points.map((a,k)=>segmentDistance(p,a,points[(k+1)%points.length])));if(g>gap){gap=g;best=p}}return best}
export function measureText(m:Markup,s:Sheet){if(!s.calibration)return 'Set scale';const a=m.points[0],b=m.points.at(-1)!;const value=m.kind==='area'?polygonArea(areaPoints(m.points))*s.calibration**2:distance(a,b)*s.calibration;return value.toFixed(m.precision??2)+' '+(s.unit||'m')+(m.kind==='area'?'²':'')}
export function labelPoint(m:Markup){return m.kind==='area'?polygonLabel(areaPoints(m.points)):{x:(m.points[0].x+m.points.at(-1)!.x)/2,y:(m.points[0].y+m.points.at(-1)!.y)/2-15}}
export function constrain(a:Point,b:Point){return Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)?{x:b.x,y:a.y}:{x:a.x,y:b.y}}
function polyline(m:Markup):Point[]{const a=m.points[0],b=m.points.at(-1)!;if(m.kind==='area')return areaPoints(m.points);if(m.kind==='rect')return[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];if(m.kind==='ellipse'){const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,rx=Math.abs(a.x-b.x)/2,ry=Math.abs(a.y-b.y)/2;return Array.from({length:65},(_,i)=>({x:cx+rx*Math.cos(i*Math.PI/32),y:cy+ry*Math.sin(i*Math.PI/32)}))}if(m.kind==='pen'&&m.points.length>2){const out=[a];let from=a;for(let i=1;i<m.points.length-1;i++){const p=m.points[i],n=m.points[i+1],end={x:(p.x+n.x)/2,y:(p.y+n.y)/2};for(let j=1;j<=4;j++){const t=j/4,u=1-t;out.push({x:u*u*from.x+2*u*t*p.x+t*t*end.x,y:u*u*from.y+2*u*t*p.y+t*t*end.y})}from=end}out.push(b);return out}return m.points}
function boxHit(a:Point,b:Point,r:number,x:number,y:number,w:number,h:number){const ps=[{x:x-r,y:y-r},{x:x+w+r,y:y-r},{x:x+w+r,y:y+h+r},{x:x-r,y:y+h+r}];return inPolygon(a,ps)||inPolygon(b,ps)||ps.some((p,i)=>intersects(a,b,p,ps[(i+1)%4]))}
export function hitMarkup(m:Markup,s:Sheet,from:Point,to:Point,radius:number){const a=m.points[0];if(!a)return false;const r=radius+m.width/2;
 if(m.kind==='text'){const lines=(m.text||'').split('\n'),size=Math.max(14,m.width*5);return boxHit(from,to,r,a.x,a.y-size,Math.max(...lines.map(l=>l.length),1)*size*.62,lines.length*Math.max(17,m.width*6))}
 const ps=polyline(m),closed=['rect','area','ellipse'].includes(m.kind);
 if(m.kind==='area'&&(inPolygon(from,ps)||inPolygon(to,ps)))return true;
 if(ps.length===1&&segmentDistance(ps[0],from,to)<=r)return true;
 for(let i=1;i<ps.length;i++)if(segmentGap(from,to,ps[i-1],ps[i])<=r)return true;
 if(closed&&segmentGap(from,to,ps.at(-1)!,ps[0])<=r)return true;
 if(m.kind==='arrow'){const b=ps.at(-1)!,ang=Math.atan2(b.y-a.y,b.x-a.x),l=Math.max(10,m.width*4);if([-.45,.45].some(t=>segmentGap(from,to,b,{x:b.x-l*Math.cos(ang+t),y:b.y-l*Math.sin(ang+t)})<=r))return true}
 if(m.kind==='measure'||m.kind==='area'){const p=labelPoint(m),w=Math.max(94,measureText(m,s).length*7.5+18);if(boxHit(from,to,r,p.x-w/2,p.y-14,w,25))return true}return false;
}
