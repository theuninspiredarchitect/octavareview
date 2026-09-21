import {Camera} from 'lucide-react';
import type {Point} from '@/lib/review-types';

export default function PhotoPin({point,scale=1,draft=false,selected=false}:{point:Point;scale?:number;draft?:boolean;selected?:boolean}){
 return <g transform={`translate(${point.x},${point.y})`}><g data-screen-scale transform={`scale(${1/scale})`} opacity={draft?.75:1}>
  {selected&&<rect data-selection x={-22} y={-44} width={44} height={47} rx={11} fill="#88adff" opacity=".35"/>}
  <path d="M-11 -40H11Q17 -40 17 -34V-14Q17 -8 11 -8H6L0 0 -6 -8H-11Q-17 -8 -17 -14V-34Q-17 -40 -11 -40Z" fill="#416dc2" stroke="white" strokeWidth="1.5"/>
  <Camera x={-11} y={-35} width={22} height={22} stroke="white" strokeWidth={1.7} fill="none"/>
  {draft&&<path d="M-8 0H8M0 -4V7" stroke="#6b9dff" strokeWidth="1.25"/>}
 </g></g>
}
