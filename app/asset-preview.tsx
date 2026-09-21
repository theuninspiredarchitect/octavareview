"use client";
import {useEffect,useRef,useState} from 'react';
import {Image as ImageIcon,LoaderCircle} from 'lucide-react';
import type {ProjectAsset} from '@/lib/review-types';
import {makeThumbnail} from '@/lib/upload-client';
export const assetPath=(projectId:string,file:Pick<ProjectAsset,'id'|'source'>)=>'/api/'+(file.source==='task'?'attachments':'documents')+'?project='+encodeURIComponent(projectId)+'&id='+encodeURIComponent(file.id);
export default function AssetPreview({file,projectId,headers,large=false,sourceUrl}:{file:Pick<ProjectAsset,'id'|'source'|'mime'|'name'|'size'>;projectId:string;headers:Record<string,string>;large?:boolean;sourceUrl?:string}){
 const [src,setSrc]=useState(''),[error,setError]=useState(false),[visible,setVisible]=useState(large),element=useRef<HTMLDivElement>(null),auth=useRef(headers);auth.current=headers;
 useEffect(()=>{if(large){setVisible(true);return}const observer=new IntersectionObserver(items=>{if(items.some(i=>i.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'150px'});if(element.current)observer.observe(element.current);return()=>observer.disconnect()},[large,file.id]);
 useEffect(()=>{
  if(!visible)return;let live=true,url='';const controller=new AbortController();setError(false);setSrc('');
  (async()=>{
   let blob:Blob;
   if(!large&&file.mime.startsWith('image/')){
    const path=sourceUrl?sourceUrl+'&thumbnail=1':'/api/thumbnails?project='+projectId+'&id='+file.id,r=await fetch(path,{headers:auth.current,signal:controller.signal});
    if(r.ok)blob=await r.blob();
    else if(r.status===404&&file.size<=25*1024*1024){
     const original=await fetch(sourceUrl||assetPath(projectId,file),{headers:auth.current,signal:controller.signal});if(!original.ok)throw Error();const thumbnail=await makeThumbnail(await original.blob());if(!thumbnail)throw Error();blob=thumbnail;
     if(!sourceUrl)void fetch(path,{method:'POST',headers:auth.current,body:thumbnail,signal:controller.signal}).catch(()=>{});
    }else throw Error();
   }else{const r=await fetch(sourceUrl||assetPath(projectId,file),{headers:auth.current,signal:controller.signal});if(!r.ok)throw Error();blob=await r.blob()}
   if(live){url=URL.createObjectURL(blob);setSrc(url)}
  })().catch(()=>{if(live)setError(true)});
  return()=>{live=false;controller.abort();if(url)URL.revokeObjectURL(url)};
 },[file.id,projectId,large,visible,sourceUrl]);
 return <div ref={element} className={'asset-preview-surface '+(large?'large':'')}>{error?<div className="asset-preview-placeholder"><ImageIcon size={26}/><span>Open to view or download</span></div>:!src?<div className="asset-preview-placeholder">{visible?<LoaderCircle className="spin" size={22}/>:<ImageIcon size={22}/>}</div>:file.mime.startsWith('image/')?<img src={src} alt={file.name} loading="lazy" onError={()=>setError(true)} className={large?'asset-image-large':'asset-image'}/>:<iframe title={file.name} src={src} className="asset-pdf-preview"/>}</div>
}
