"use client";
import {useEffect,useRef,useState} from 'react';
import {FileText,LoaderCircle} from 'lucide-react';
import type {Point,Sheet} from '@/lib/review-types';
import {openPdf} from '@/lib/pdf';
import SamplePlan from './sample-plan';
const previews=new Map<string,string>();
export default function PlanPreview({sheet,projectId,headers,pin,number,focus=false}:{sheet?:Sheet;projectId:string;headers:Record<string,string>;pin?:Point|null;number?:number;focus?:boolean}){
 const host=useRef<HTMLDivElement>(null),[active,setActive]=useState(false),[src,setSrc]=useState(''),[error,setError]=useState(false);
 const key=projectId+':'+sheet?.id+':'+(headers['x-review-token']||''),auth=useRef(headers);auth.current=headers;
 useEffect(()=>{const el=host.current;if(!el)return;if(!('IntersectionObserver'in window)){setActive(true);return}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setActive(true);observer.disconnect()}},{rootMargin:'200px'});observer.observe(el);return()=>observer.disconnect()},[]);
 useEffect(()=>{if(!active||!sheet?.fileId)return;let cancelled=false,doc:any,render:any;setError(false);setSrc('');const cached=previews.get(key);if(cached){setSrc(cached);return}
  (async()=>{try{doc=await openPdf('/api/files?project='+projectId+'&id='+sheet.fileId,auth.current);if(cancelled)return;const page=await doc.getPage(sheet.page),scale=Math.min(2,1400/sheet.width),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;render=page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport});await render.promise;if(!cancelled){const image=canvas.toDataURL('image/webp',.85);previews.set(key,image);if(previews.size>48)previews.delete(previews.keys().next().value!);setSrc(image)}}catch{if(!cancelled)setError(true)}finally{doc?.destroy()}})();return()=>{cancelled=true;render?.cancel();doc?.destroy()}
 },[active,key,sheet?.fileId]);
 const x=pin&&sheet?pin.x/sheet.width*100:50,y=pin&&sheet?pin.y/sheet.height*100:50;
 return <div ref={host} className="plan-preview" style={{aspectRatio:sheet?`${sheet.width}/${sheet.height}`:'1.414'}}><div className="plan-preview-paper" style={{transform:focus&&pin?'scale(2.6)':'none',transformOrigin:`${x}% ${y}%`}}>{sheet?.fileId?(src?<img src={src} alt={sheet.name+' preview'} draggable={false}/>:<div className="preview-placeholder">{error?<FileText/>:<LoaderCircle className="spin"/>}<span>{error?'Open plan to view':'Loading preview'}</span></div>):sheet?<svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} aria-label={sheet.name+' preview'}><SamplePlan variant={sheet.sample}/></svg>:<div className="preview-placeholder"><FileText/><span>No plans yet</span></div>}
 {pin&&<div className="preview-pin" style={{left:x+'%',top:y+'%',transform:`translate(-50%,-100%) scale(${focus?1/2.6:1})`}}><svg viewBox="0 0 32 42" aria-label={'Task pin '+(number||'')}><path d="M16 41 3 21A15 15 0 1 1 29 21Z" fill="#e4683d" stroke="white" strokeWidth="2"/><text x="16" y="20" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">{number||'+'}</text></svg></div>}</div></div>
}
