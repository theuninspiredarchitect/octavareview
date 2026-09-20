import type React from 'react';
import {Markup,Sheet} from '@/lib/review-types';
import {areaPoints,labelPoint,measureText,textLayout,calloutPath} from '@/lib/drawing-geometry';
export {measureText} from '@/lib/drawing-geometry';
export function pathData(points:{x:number;y:number}[]){if(!points.length)return '';if(points.length===1)return 'M'+points[0].x+' '+points[0].y+'l.01 .01';let d='M'+points[0].x+' '+points[0].y;for(let i=1;i<points.length-1;i++){const p=points[i],n=points[i+1];d+='Q'+p.x+' '+p.y+' '+(p.x+n.x)/2+' '+(p.y+n.y)/2}const p=points.at(-1)!;return d+'L'+p.x+' '+p.y}
export default function MarkupShape({m,s,selected=false,onClick}:{m:Markup;s:Sheet;selected?:boolean;onClick?:(e:React.PointerEvent)=>void}){
 const a=m.points[0],b=m.points.at(-1)!;if(!a)return null;
 const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y),vertices=m.kind==='area'?areaPoints(m.points):[a,b];
 const line=<path d={'M'+a.x+' '+a.y+'L'+b.x+' '+b.y}/>;
 let shape:React.ReactNode=line;
 if(m.kind==='pen')shape=<path d={pathData(m.points)}/>;
 if(m.kind==='rect')shape=<rect x={x} y={y} width={w} height={h}/>;
 if(m.kind==='area')shape=<polygon points={vertices.map(p=>p.x+','+p.y).join(' ')} fill={m.color+'14'}/>;
 if(m.kind==='ellipse')shape=<ellipse cx={x+w/2} cy={y+h/2} rx={w/2} ry={h/2}/>;
 if(m.kind==='arrow'){const angle=Math.atan2(b.y-a.y,b.x-a.x),l=Math.max(10,m.width*4);shape=<>{line}<path d={'M'+(b.x-l*Math.cos(angle-.45))+' '+(b.y-l*Math.sin(angle-.45))+'L'+b.x+' '+b.y+'L'+(b.x-l*Math.cos(angle+.45))+' '+(b.y-l*Math.sin(angle+.45))}/></>}
 if(m.kind==='text'){const box=textLayout(m,s);shape=<>{box.callout&&<path d={calloutPath(box)} fill="#fffdf8" strokeWidth={Math.max(1,m.width*.7)}/>}<text x={box.textX} y={box.textY} fontSize={box.size} fill={m.color} stroke="none" fontFamily="Arial,sans-serif">{box.lines.map((t,i)=><tspan key={i} x={box.textX} dy={i?box.lineHeight:0}>{t||' '}</tspan>)}</text></>;}
 const measured=m.kind==='measure'||m.kind==='area',label=measured?labelPoint(m):a,text=measured?measureText(m,s):'',labelWidth=Math.max(94,text.length*7.5+18);
 return <g data-markup-id={m.id} onPointerDown={onClick} stroke={m.color} strokeWidth={m.width} strokeLinecap="round" strokeLinejoin="round" fill="none" style={{cursor:onClick?'pointer':undefined}}>
 {selected&&<g data-selection stroke="#75bce6" strokeWidth={m.width+7} opacity=".3">{shape}</g>}{shape}
 {measured&&<><g strokeWidth="1.2">{vertices.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" fill="white"/>)}</g><g transform={'translate('+label.x+','+label.y+')'}><rect x={-labelWidth/2} y="-14" width={labelWidth} height="25" fill="white" stroke={m.color} strokeWidth="1" rx="3"/><text y="3" fontSize="13" fill={m.color} textAnchor="middle" stroke="none" fontFamily="Arial">{text}</text></g></>}
 </g>;
}
