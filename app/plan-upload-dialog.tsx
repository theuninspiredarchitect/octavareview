"use client";
import {useEffect,useRef,useState} from 'react';
import {LoaderCircle,Upload} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {toast} from 'sonner';
import {Choice} from './review-controls';
import UploadQueue from './upload-queue';
import {openPdf} from '@/lib/pdf';
import {uploadFile,PLAN_LIMIT,type Requester} from '@/lib/upload-client';
import {fileKey,isPdf,newUploadItems,runUploadBatch,type UploadItem} from '@/lib/upload-batch';
import type {PlanFolder,Sheet} from '@/lib/review-types';
type PlanUpload=UploadItem&{name:string;code:string;sheets?:Sheet[]};
export default function PlanUploadDialog({onClose,projectId,target,initialFolder,folders,sheets,request,onImported,onDone}:{onClose:()=>void;projectId:string;target?:Sheet;initialFolder:string;folders:PlanFolder[];sheets:Sheet[];request:Requester;onImported:(sheets:Sheet[])=>void;onDone:(first:Sheet,batch:boolean)=>void}){
 const [items,setItems]=useState<PlanUpload[]>([]),[revision,setRevision]=useState(target?'R'+String(Number(target.revision.replace(/\D/g,''))+1).padStart(2,'0'):'R01'),[folder,setFolder]=useState(initialFolder),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),running=useRef(false);
 useEffect(()=>{if(!busy)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[busy]);
 function choose(files:File[]){
  if(running.current||!files.length)return;setError('');
  if(target&&files.length>1){setError('Choose one PDF for this drawing revision. Use Import PDF in Plans to add several new drawings.');return}
  setItems(old=>{
   const current=target?[]:old,seen=new Set(current.map(i=>fileKey(i.file))),codes=new Set([...sheets.map(s=>s.code),...current.map(i=>i.code)]);
   const next=newUploadItems(files.filter(f=>!seen.has(fileKey(f)))).map(item=>{
    const name=item.file.name.replace(/\.pdf$/i,'').slice(0,180),guess=name.match(/^([a-z]{1,5}[.-]?\d{1,5}(?:[.-]\d+)?)(?:[\s_-]|$)/i)?.[1];let number=101;while(codes.has('A.'+number))number++;
    const code=target?.code||(guess&&!codes.has(guess)?guess:'A.'+number);codes.add(code);
    return {...item,name:target?.name||name,code};
   });return [...current,...next];
  });
 }
 function edit(id:string,patch:Partial<PlanUpload>){setItems(old=>old.map(i=>i.id===id?{...i,...patch}:i))}
 async function upload(event:React.FormEvent){
  event.preventDefault();if(running.current||!items.some(i=>i.status!=='done'))return;
  running.current=true;setBusy(true);setError('');let count=0;
  try{
   const queue=await runUploadBatch(items,async(item,progress)=>{
    if(!isPdf(item.file))throw Error('Choose a PDF file.');if(item.file.size>PLAN_LIMIT)throw Error('This PDF exceeds 64 MB. Split it into smaller files.');
    if(!item.name.trim()||!item.code.trim())throw Error('Enter a drawing name and sheet number.');
    let pdf:Awaited<ReturnType<typeof openPdf>>|undefined;
    try{
     setMessage('Reading '+item.file.name+'…');pdf=await openPdf(new Uint8Array(await item.file.arrayBuffer()));
     if(pdf.numPages>200)throw Error('Split PDFs with more than 200 pages into smaller files.');if(target&&pdf.numPages!==1)throw Error('A drawing revision must be a single page PDF.');
     const pages=[];for(let page=1;page<=pdf.numPages;page++){const p=await pdf.getPage(page),view=p.getViewport({scale:1});pages.push({width:view.width,height:view.height})}
     const result=await uploadFile(request,projectId,item.file,'plan',{name:item.name,code:item.code,revision,revisionOf:target?.id,folderId:target?undefined:folder||undefined,pages},n=>{progress(n);setMessage(item.file.name+' · '+n+'%')});
     item.sheets=result.sheets;onImported(result.sheets);count+=result.sheets.length;
    }finally{await pdf?.destroy().catch(()=>{})}
   },setItems);
   if(count)toast.success(count+' drawing'+(count===1?'':'s')+' imported');
   if(queue.every(i=>i.status==='done')){const first=queue.find(i=>i.sheets?.length)?.sheets?.[0];if(first)onDone(first,queue.length>1);onClose()}
   else setError('Some PDFs need attention. Uploaded drawings are saved. Retry the failed files or remove them.');
  }finally{running.current=false;setBusy(false);setMessage('')}
 }
 const pending=items.filter(i=>i.status!=='done').length;
 return <Dialog open onOpenChange={v=>{if(!v&&!running.current)onClose()}}><DialogContent className="upload-dialog plan-batch-dialog"><DialogHeader><DialogTitle>{target?'Add a drawing revision':'Upload drawings'}</DialogTitle><DialogDescription>{target?'The previous revision and its feedback stay in the drawing history.':'Select several PDFs together. Every page becomes a drawing, using its file name.'}</DialogDescription></DialogHeader>
 <form className="form-stack" onSubmit={upload}><label className="drop-zone" aria-disabled={busy} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();choose(Array.from(e.dataTransfer.files))}}><Upload size={24}/><strong>{target?'Choose a revision PDF':items.length?'Add more PDFs':'Drop PDFs here, or browse'}</strong><span>Up to 64 MB per PDF · {target?'one page':'multiple files and pages'}</span><input type="file" multiple={!target} accept="application/pdf,.pdf" aria-label={target?'Choose revision PDF':'Choose PDF drawings'} disabled={busy} onChange={e=>{choose(Array.from(e.target.files||[]));e.target.value=''}}/></label>
 <UploadQueue items={items} busy={busy} onRemove={id=>setItems(old=>old.filter(i=>i.id!==id))} details={item=>item.status==='done'?null:<div className="plan-upload-fields"><label>Drawing name<input aria-label={'Drawing name for '+item.file.name} required value={item.name} disabled={busy} maxLength={180} onChange={e=>edit(item.id,{name:e.target.value})}/></label><label>Sheet number<input aria-label={'Sheet number for '+item.file.name} required value={item.code} disabled={busy} maxLength={80} onChange={e=>edit(item.id,{code:e.target.value})}/></label></div>}/>
 <div className="form-grid"><label>Revision<input required value={revision} disabled={busy} maxLength={40} onChange={e=>setRevision(e.target.value)}/></label>{!target&&folders.length>0&&<label>Folder<Choice label="Import into folder" value={folder||'unfiled'} disabled={busy} onChange={v=>setFolder(v==='unfiled'?'':v)} options={[{value:'unfiled',label:'Unfiled plans'},...folders.map(f=>({value:f.id,label:f.name}))]}/></label>}</div>
 {error&&<p className="form-error" role="alert">{error}</p>}{busy&&<p className="upload-keep-open" role="status">{message} · Keep this screen open.</p>}
 <button className="button primary full" disabled={busy||!pending||!revision.trim()}>{busy?<LoaderCircle className="spin" size={17}/>:<Upload size={17}/>} {busy?'Uploading PDFs…':items.some(i=>i.status==='error')?'Retry failed PDFs':target?'Import revision':'Import '+pending+' PDF'+(pending===1?'':'s')}</button>
 </form></DialogContent></Dialog>;
}
