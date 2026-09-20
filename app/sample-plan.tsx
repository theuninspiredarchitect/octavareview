import React from 'react';
export default function SamplePlan({variant='ground'}:{variant?:string}){
 const rooms=[{x:226,y:175,w:230,h:176,name:'BEDROOM 01',area:'18.4 m²'},{x:226,y:363,w:230,h:200,name:'BEDROOM 02',area:'19.6 m²'},{x:473,y:175,w:120,h:176,name:'BATH',area:'6.2 m²'},{x:610,y:175,w:220,h:176,name:'PRIMARY SUITE',area:'22.0 m²'}];
 const Dim=({x1,x2,y,text}:{x1:number;x2:number;y:number;text:string})=><g stroke="#8a9194" strokeWidth=".65"><path d={'M'+x1+' '+(y-10)+'v20 M'+x2+' '+(y-10)+'v20 M'+x1+' '+y+'H'+x2}/><path d={'M'+(x1-4)+' '+(y+4)+'l8 -8 M'+(x2-4)+' '+(y+4)+'l8 -8'}/><text x={(x1+x2)/2} y={y-6} textAnchor="middle" fill="#777f83" stroke="none" fontSize="10">{text}</text></g>;
 return <g fontFamily="Arial, sans-serif" fill="none">
 <rect width="1200" height="850" fill="#fff"/>
 <rect x="34" y="32" width="1132" height="786" stroke="#c9cfd0" strokeWidth=".7"/>
 <g stroke="#cdd2d2" strokeWidth=".7" strokeDasharray="8 7">
 {[215,463,601,844].map((x,i)=><g key={x}><path d={'M'+x+' 98V736'}/><circle cx={x} cy={90} r="11" fill="white" strokeDasharray="none"/><text x={x} y={94} fill="#8b9194" textAnchor="middle" fontSize="11" stroke="none">{i+1}</text></g>)}
 {[164,357,576,693].map((y,i)=><g key={y}><path d={'M130 '+y+'H981'}/><circle cx="117" cy={y} r="11" fill="white" strokeDasharray="none"/><text x="117" y={y+4} fill="#8b9194" textAnchor="middle" fontSize="11" stroke="none">{String.fromCharCode(65+i)}</text></g>)}
 </g>
 {variant==='ground'?<>
 <rect x="215" y="164" width="629" height="412" fill="#fdfdfb" stroke="#455052" strokeWidth="2"/>
 <g fill="#d5d8d7" stroke="#566162" strokeWidth="1">
 <path d="M215 164h629v412H215z M226 175v388h607V175z" fillRule="evenodd"/>
 <rect x="456" y="175" width="11" height="388"/><rect x="594" y="175" width="11" height="178"/>
 <rect x="226" y="351" width="607" height="12"/><rect x="460" y="520" width="95" height="10"/>
 </g>
 <g fill="#fff" stroke="#616c6e" strokeWidth="1">
 <rect x="275" y="164" width="125" height="11"/><path d="M275 169.5h125"/>
 <rect x="658" y="164" width="125" height="11"/><path d="M658 169.5h125"/>
 <rect x="215" y="403" width="11" height="90"/><path d="M220.5 403v90"/>
 <rect x="833" y="215" width="11" height="88"/><path d="M838.5 215v88"/>
 <rect x="623" y="563" width="185" height="13"/><path d="M623 567h185 M623 572h185 M715 563v13"/>
 </g>
 <g fill="white"><rect x="456" y="282" width="12" height="66"/><rect x="456" y="379" width="12" height="66"/><rect x="511" y="351" width="65" height="12"/><rect x="669" y="351" width="65" height="12"/><rect x="566" y="351" width="57" height="12"/></g>
 <g stroke="#899292" strokeWidth=".8"><path d="M467 348h-65a65 65 0 0 1 65-65 M467 380h65a65 65 0 0 1-65 65 M511 351v-65a65 65 0 0 1 65 65 M669 351v-65a65 65 0 0 1 65 65"/></g>
 <g stroke="#a0a7a5" strokeWidth=".75" fill="#fafbf9">
 <rect x="266" y="199" width="127" height="96" rx="2"/><rect x="272" y="201" width="54" height="24" rx="3"/><rect x="331" y="201" width="55" height="24" rx="3"/><path d="M266 232h127 M266 236h127"/><rect x="244" y="200" width="18" height="23"/><rect x="398" y="200" width="18" height="23"/>
 <rect x="266" y="411" width="127" height="96" rx="2"/><rect x="272" y="414" width="54" height="24" rx="3"/><rect x="331" y="414" width="55" height="24" rx="3"/><path d="M266 446h127 M266 450h127"/>
 <rect x="650" y="200" width="140" height="100" rx="2"/><rect x="658" y="203" width="57" height="25" rx="3"/><rect x="723" y="203" width="57" height="25" rx="3"/><path d="M650 235h140"/>
 <rect x="476" y="180" width="109" height="49"/><path d="M476 180l109 49 M585 180l-109 49"/><circle cx="533" cy="205" r="4"/>
 <rect x="554" y="271" width="30" height="55"/><ellipse cx="569" cy="298" rx="10" ry="18"/>
 <rect x="485" y="241" width="25" height="13"/><ellipse cx="497.5" cy="265" rx="12" ry="16"/>
 <rect x="613" y="371" width="212" height="35"/><rect x="790" y="406" width="35" height="103"/>
 <rect x="650" y="437" width="101" height="47" rx="2"/><rect x="658" y="442" width="33" height="21" rx="3"/><circle cx="731" cy="392" r="9"/><circle cx="754" cy="392" r="9"/>
 {[664,701,738].map(x=><g key={x}><circle cx={x} cy="501" r="12"/><path d={'M'+(x-8)+' 511h16'}/></g>)}
 <rect x="482" y="389" width="64" height="111" rx="4"/><rect x="486" y="397" width="53" height="26" rx="2"/><rect x="486" y="430" width="53" height="26" rx="2"/><rect x="486" y="463" width="53" height="26" rx="2"/>
 <rect x="564" y="410" width="34" height="66" rx="5"/>
 <rect x="236" y="535" width="205" height="24"/><path d="M305 535v24 M372 535v24"/>
 </g>
 {rooms.map(r=><g key={r.name} fill="#828a8c" textAnchor="middle"><text x={r.x+r.w/2} y={r.y+r.h-21} fontSize="10" letterSpacing="1.2">{r.name}</text><text x={r.x+r.w/2} y={r.y+r.h-7} fontSize="9">{r.area}</text></g>)}
 <g fill="#7f898b" fontSize="10" letterSpacing="1" textAnchor="middle"><text x="704" y="535">KITCHEN / DINING</text><text x="543" y="510">LIVING</text></g>
 <rect x="215" y="584" width="629" height="109" stroke="#a8aeac" fill="#fbfcfa" strokeWidth=".8"/>
 <g stroke="#d3d6d0" strokeWidth=".6">{Array.from({length:13},(_,i)=><path key={i} d={'M215 '+(588+i*8)+'H844'}/>)}</g>
 <g fill="#768179">{[215,463,844].map(x=><rect key={x} x={x-5} y="688" width="10" height="10"/>)}</g>
 <rect x="586" y="607" width="100" height="44" rx="4" stroke="#b3bbb5"/>{[605,636,667].map(x=><g key={x} stroke="#b3bbb5"><rect x={x-9} y="593" width="18" height="10" rx="2"/><rect x={x-9} y="655" width="18" height="10" rx="2"/></g>)}
 <text x="376" y="643" fill="#929b92" fontSize="11" letterSpacing="1.8" textAnchor="middle">COVERED TERRACE</text>
 <g stroke="#bfc9bd" strokeWidth=".8">{[250,326,402,894,919].map((x,i)=><g key={x}><circle cx={x} cy={i<3?744:265+i*49} r={i<3?24:28}/><circle cx={x-7} cy={i<3?739:260+i*49} r="13"/></g>)}</g>
 </>:variant==='roof'?<>
 <rect x="186" y="138" width="689" height="580" fill="#f8faf9" stroke="#5d6869" strokeWidth="2"/>
 <path d="M186 428H875 M215 164H844V693H215Z" stroke="#7c8687" strokeDasharray="5 5"/>
 {Array.from({length:35},(_,i)=><path key={i} d={'M'+(195+i*19)+' 140V716'} stroke="#b8c0c0" strokeWidth=".8"/>)}
 <g fill="#758081" fontSize="13" textAnchor="middle"><text x="530" y="268">METAL ROOF · SLOPE 12%</text><text x="530" y="602">COVERED TERRACE · SLOPE 8%</text></g>
 <path d="M530 312v73m-8-12 8 12 8-12 M530 521v-73m-8 12 8-12 8 12" stroke="#617072" strokeWidth="2"/>
 <rect x="652" y="190" width="127" height="155" fill="#e3e9ec" stroke="#82959c"/><path d="M694 190v155 M736 190v155 M652 241h127 M652 293h127" stroke="#82959c"/>
 <text x="717" y="362" fill="#758081" fontSize="10" textAnchor="middle">SOLAR PROVISION</text>
 </>:<>
 <path d="M170 140 911 175 980 645 778 742 236 711Z" stroke="#82968a" strokeWidth="2" strokeDasharray="10 5" fill="#f9fbf8"/>
 {Array.from({length:9},(_,i)=><path key={i} d={'M130 '+(210+i*55)+'Q550 '+(80+i*55)+' 1050 '+(330+i*50)} stroke="#dee4da" strokeWidth="1.2"/>)}
 <rect x="328" y="262" width="443" height="310" stroke="#5b6c68" strokeWidth="2" fill="#eff3ed"/><path d="M328 473h443 M487 262v211 M613 262v211" stroke="#9daa9f"/>
 <rect x="468" y="599" width="216" height="76" stroke="#81a6b0" fill="#edf6f8"/>
 <g fill="#718078" textAnchor="middle"><text x="550" y="388" fontSize="17" letterSpacing="2">CASA CANOPY</text><text x="550" y="410" fontSize="12">PROPOSED RESIDENCE</text><text x="575" y="642" fontSize="12">POOL</text></g>
 <path d="M850 210Q1070 456 850 710" stroke="#bec7be" strokeWidth="36"/><path d="M850 210Q1070 456 850 710" stroke="#fff" strokeDasharray="14 8"/>
 {[{x:263,y:246},{x:248,y:410},{x:253,y:583},{x:399,y:650},{x:795,y:662},{x:809,y:221}].map((p,i)=><g key={i} stroke="#b0bfa9"><circle cx={p.x} cy={p.y} r="37"/><circle cx={p.x-10} cy={p.y+5} r="21"/><circle cx={p.x+14} cy={p.y-8} r="20"/></g>)}
 </>}
 <Dim x1={215} x2={463} y={132} text="6.20"/><Dim x1={463} x2={601} y={132} text="3.45"/><Dim x1={601} x2={844} y={132} text="6.08"/>
 <Dim x1={215} x2={844} y={109} text="15.73"/>
 <g transform="translate(1022 112)" stroke="#748083" strokeWidth="1"><path d="M0 32V0l-7 17 7-4 7 4Z" fill="#748083"/><text x="0" y="-10" textAnchor="middle" fontSize="12" fill="#748083" stroke="none">N</text></g>
 <path d="M34 776h1132 M840 776v42 M997 776v42" stroke="#c9cfd0" strokeWidth=".7"/>
 <text x="56" y="795" fontSize="11" fill="#434f52" letterSpacing="2">STUDIO OCTAVA</text>
 <text x="56" y="809" fontSize="8" fill="#899294">CASA CANOPY · SAMPLE DRAWING · FOR APP DEMONSTRATION</text>
 <text x="510" y="798" fontSize="12" fill="#5a666a" letterSpacing="1">{variant==='ground'?'GROUND FLOOR PLAN':variant==='roof'?'ROOF PLAN':'SITE PLAN'}</text>
 <text x="859" y="796" fontSize="10" fill="#7a8588">SCALE 1:100</text><text x="859" y="809" fontSize="8" fill="#9aa2a4">DIMENSIONS IN METERS</text>
 <text x="1017" y="803" fontSize="21" fill="#475357">{variant==='ground'?'A.101':variant==='roof'?'A.201':'A.001'}</text>
 </g>
}
