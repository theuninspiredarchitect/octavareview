"use client";
import {useEffect,useRef,useState} from 'react';
import {Download,LoaderCircle,Move,Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {toast} from 'sonner';
import type {Markup,ProjectAsset} from '@/lib/review-types';
import type {Requester} from '@/lib/upload-client';
import AssetPreview from './asset-preview';
export type LinkedPhotoFile=Pick<ProjectAsset,'id'|'source'|'mime'|'name'|'size'>;
export default function LinkedPhotoDialog({pin,projectId,headers,request,onClose,onMove,onRemove}:{pin:Markup|null;projectId:string;headers:Record<string,string>;request:Requester;onClose:()=>void;onMove:(file:LinkedPhotoFile,pin:Markup)=>void;onRemove:(pin:Markup)=>Promise<void>}){
 const [file,setFile]=useState<LinkedPhotoFile|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),api=useRef(request);api.current=request;
 const url=pin?'/api/photo-links?project='+encodeURIComponent(projectId)+'&pin='+encodeURIComponent(pin.id):'';
 useEffect(()=>{setFile(null);setError('');if(!url)return;let live=true;api.current(url+'&metadata=1').then(r=>{if(live)setFile(r.file)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[url,retry,pin?.photoId]);
 async function download(){if(!file)return;setBusy(true);try{const r=await fetch(url+'&download=1',{headers});if(!r.ok)throw Error('This photo could not be downloaded.');const href=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=href;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(href),10000)}catch(e:any){toast.error(e.message)}finally{setBusy(false)}}
 return <Dialog open={!!pin} onOpenChange={v=>!v&&onClose()}><DialogContent className="project-asset-dialog linked-photo-dialog"><DialogHeader><DialogTitle>{file?.name||pin?.text||'Linked photo'}</DialogTitle><DialogDescription>Photo linked to this location on the plan.</DialogDescription></DialogHeader>{error?<div className="overview-empty"><p role="alert">{error}</p><button className="button outline" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:file?<AssetPreview file={file} projectId={projectId} headers={headers} sourceUrl={url} large/>:<div className="overview-loading"><LoaderCircle className="spin"/> Opening photo…</div>}<div className="asset-detail-actions">{pin?.editable!==false&&pin&&<><button className="button outline" disabled={busy||!file} onClick={()=>file&&onMove(file,pin)}><Move size={16}/> Move pin</button><button className="button outline" disabled={busy} onClick={async()=>{setBusy(true);try{await onRemove(pin)}finally{setBusy(false)}}}><Trash2 size={16}/> Remove pin</button></>}<button className="button outline" disabled={!file||busy} onClick={download}><Download size={16}/> Download</button></div></DialogContent></Dialog>
}
