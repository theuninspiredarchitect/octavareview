"use client";
import type {ReactNode} from 'react';
import {Check,FileText,LoaderCircle,RefreshCw,X} from 'lucide-react';
import {Progress} from '@/components/ui/progress';
import type {UploadItem} from '@/lib/upload-batch';
import './upload-queue.css';
export default function UploadQueue<T extends UploadItem>({items,busy,onRetry,onRemove,onClear,details}:{items:T[];busy:boolean;onRetry?:()=>void;onRemove?:(id:string)=>void;onClear?:()=>void;details?:(item:T)=>ReactNode}){
 if(!items.length)return null;
 const done=items.filter(i=>i.status==='done').length,errors=items.filter(i=>i.status==='error').length;
 return <section className="upload-queue" aria-label="File uploads"><div className="upload-queue-heading"><strong>{done} of {items.length} uploaded</strong><span>{errors?errors+(errors===1?' needs attention':' need attention'):busy?'Uploading…':done===items.length?'Complete':'Selected files'}</span>{!busy&&onClear&&<button type="button" className="icon-button" aria-label="Dismiss upload results" onClick={onClear}><X size={15}/></button>}</div>
 <div className="upload-queue-list">{items.map(item=><div className="upload-queue-item" data-state={item.status} key={item.id}><div className="upload-queue-file">{item.status==='done'?<Check size={17}/>:item.status==='uploading'?<LoaderCircle className="spin" size={17}/>:<FileText size={17}/>}<span><strong>{item.file.name}</strong><small>{(item.file.size/1024/1024).toFixed(1)} MB · {item.status==='done'?'Uploaded':item.status==='error'?'Not uploaded':item.status==='uploading'?item.progress+'%':'Ready'}</small></span>{!busy&&item.status!=='done'&&onRemove&&<button type="button" className="icon-button" aria-label={'Remove '+item.file.name} onClick={()=>onRemove(item.id)}><X size={15}/></button>}</div>{item.status==='uploading'&&<Progress className="upload-queue-progress" value={item.progress} aria-label={'Uploading '+item.file.name}/>} {item.error&&<p className="form-error" role="alert">{item.error}</p>}{details&&details(item)}</div>)}</div>
 {!busy&&errors>0&&onRetry&&<button type="button" className="button outline upload-retry" onClick={onRetry}><RefreshCw size={15}/>Retry failed files</button>}
 </section>;
}
