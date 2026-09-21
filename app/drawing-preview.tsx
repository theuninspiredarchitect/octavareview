"use client";
import {useEffect,useState} from 'react';
import {LoaderCircle} from 'lucide-react';
import {drawingQuery,type DrawingSnapshot} from '@/lib/document-drawings';
import {snapshotPng} from '@/lib/drawing-render';
export default function DrawingPreview({snapshot,projectId,headers,live=false,revision=0}:{snapshot:DrawingSnapshot;projectId:string;headers:Record<string,string>;live?:boolean;revision?:number}){
 const [src,setSrc]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true,url='';setSrc('');setError('');(async()=>{let current=snapshot;if(live){const r=await fetch('/api/drawings?'+drawingQuery(projectId,snapshot.target),{headers});if(!r.ok)throw Error('Could not load the drawing.');const {pages}=await r.json() as any;current={...snapshot,data:pages.find((p:any)=>p.page===snapshot.page)||null};}const blob=await snapshotPng(current,projectId,headers);if(active){url=URL.createObjectURL(blob);setSrc(url);}})().catch(e=>{if(active)setError(e.message);});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[snapshot.target.targetId,snapshot.page,live,revision,projectId,JSON.stringify(snapshot.data)]);
 return <div className="drawing-preview">{src?<img alt={snapshot.target.source==='sketch'?'Meeting sketch':'Annotated PDF page '+snapshot.page} src={src}/>:error?<span>{error}</span>:<LoaderCircle className="spin" size={20}/>}</div>;
}
