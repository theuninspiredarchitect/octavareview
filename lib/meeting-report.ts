import {snapshotPng} from './drawing-render';
import type {DrawingSnapshot} from './document-drawings';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import type {MeetingReport} from './meetings';
import {meetingKinds} from './meetings';
import {statusNames,type ProjectAsset} from './review-types';

// The browser supplies authenticated image bytes. No report data goes to a third-party service.
export async function buildMeetingReport(report:MeetingReport,photoBytes?:(asset:ProjectAsset)=>Promise<Uint8Array|null>,drawingBytes?:(drawing:DrawingSnapshot)=>Promise<Uint8Array>){
 const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 pdf.setTitle(report.meeting.title);pdf.setAuthor('Octava Review');
 let page=pdf.addPage([595.28,841.89]),y=786;
 const ink=rgb(.12,.13,.14),muted=rgb(.4,.42,.44),line=rgb(.84,.85,.86);
 const safe=(text:string)=>Array.from(text.replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'")).map(c=>{if(c==='\n')return c;try{regular.encodeText(c);return c}catch{return '?'}}).join('');
 function newPage(){page=pdf.addPage([595.28,841.89]);y=785;}
 function room(h:number){if(y-h<60)newPage()}
 function text(value:string,size=11,strong=false,color=ink){
  const font=strong?bold:regular,chars=safe(value).split('\n');
  for(const paragraph of chars){let row='';for(const word of paragraph.split(' ')){let pieces=[word];if(font.widthOfTextAtSize(word,size)>490){pieces=[];let part='';for(const char of word){if(font.widthOfTextAtSize(part+char,size)>480){pieces.push(part);part=''}part+=char}if(part)pieces.push(part)}for(const piece of pieces){if(row&&font.widthOfTextAtSize(row+' '+piece,size)>490){room(size+6);page.drawText(row,{x:52,y,size,font,color});y-=size+6;row=''}row+=(row?' ':'')+piece;}}room(size+6);page.drawText(row,{x:52,y,size,font,color});y-=size+6;}
 }
 text('OCTAVA / '+meetingKinds[report.meeting.kind].toUpperCase(),10,true,muted);y-=13;
 text(report.meeting.title,23,true);text(report.projectName,13);y-=14;
 text(report.meeting.date+'  |  '+(report.revision?'REPORT R'+String(report.revision).padStart(2,'0'):'DRAFT - NOT ISSUED'),10,true,muted);
 if(report.meeting.location)text('Location: '+report.meeting.location);
 text('Participants: '+(report.meeting.participants||'Not recorded'));y-=14;
 if(report.meeting.summary){text(report.meeting.summary);y-=12;}
 let index=0;
 for(const entry of report.meeting.entries.filter(e=>e.include)){
  room(95);page.drawLine({start:{x:52,y},end:{x:543,y},color:line,thickness:.6});y-=24;
  text(String(++index).padStart(2,'0')+' / '+entry.kind.toUpperCase()+(entry.location?' - '+entry.location:''),9,true,muted);
  text(entry.title||'Untitled note',15,true);y-=5;
  const task=report.tasks.find(t=>t.id===entry.taskId),photos=[...new Set([...entry.photoIds,...(task?.photos||[]).map(p=>p.id)])];
  for(const id of photos){const asset=report.assets.find(a=>a.id===id);if(!asset)continue;let image;
   if(photoBytes){try{const bytes=await photoBytes(asset);if(bytes)image=bytes[0]===0xff?await pdf.embedJpg(bytes):await pdf.embedPng(bytes)}catch{}}
   if(image){const ratio=Math.min(490/image.width,230/image.height),w=image.width*ratio,h=image.height*ratio;room(h+24);page.drawImage(image,{x:52,y:y-h,width:w,height:h});y-=h+8;}
   else text('Photo: '+asset.name+' (view original in project)',9,false,muted);
  }
  const drawing=report.drawings?.find(d=>d.entryId===entry.id);if(drawing){if(!drawingBytes)throw Error('Drawing images are required for this report.');const image=await pdf.embedPng(await drawingBytes(drawing)),ratio=Math.min(490/image.width,330/image.height),w=image.width*ratio,h=image.height*ratio;room(h+28);page.drawImage(image,{x:52,y:y-h,width:w,height:h});y-=h+10;text(drawing.target.source==='sketch'?'Meeting sketch':'Marked-up PDF / Page '+drawing.page,9,false,muted);}
  if(entry.text)text(entry.text);
  if(entry.kind==='selection')for(const [label,value] of [['Supplier',entry.vendor],['Model',entry.model],['Color / finish',[entry.color,entry.finish].filter(Boolean).join(' / ')],['Size / quantity',[entry.size,entry.quantity].filter(Boolean).join(' / ')],['Quoted price',entry.price?entry.currency+' '+entry.price:''],['Selection',entry.selectionStatus]])if(value)text(label+': '+value,10);
  if(task){y-=6;text('TASK #'+task.number+' / '+statusNames[task.status]+' / '+task.assignee+(task.due?' / Due '+task.due:''),10,true);}
  const deck=report.assets.find(a=>a.id===entry.presentationId);if(deck)text('Presentation: '+deck.name+' / Page '+entry.page,9,false,muted);
  y-=16;
 }
 if(report.revision){room(55);text('Issued '+new Date(report.issued).toLocaleString()+' by '+report.issuedBy,9,false,muted);text('Task status is recorded at issue. Follow live tasks in the project.',9,false,muted);}
 pdf.getPages().forEach((p,i)=>{p.drawText('OCTAVA REVIEW  /  '+(report.revision?'R'+String(report.revision).padStart(2,'0'):'DRAFT'),{x:52,y:30,size:8,font:regular,color:muted});p.drawText((i+1)+' / '+pdf.getPageCount(),{x:511,y:30,size:8,font:regular,color:muted});});
 return pdf.save();
}
export async function downloadMeetingReport(report:MeetingReport,projectId:string,headers:Record<string,string>,download=true){
 const bytes=await buildMeetingReport(report,async asset=>{
  let blob:Blob;const thumb=await fetch('/api/thumbnails?project='+encodeURIComponent(projectId)+'&id='+encodeURIComponent(asset.id),{headers});
  if(thumb.ok)blob=await thumb.blob();else{const res=await fetch('/api/'+(asset.source==='task'?'attachments':'documents')+'?project='+encodeURIComponent(projectId)+'&id='+encodeURIComponent(asset.id),{headers});if(!res.ok)return null;blob=await res.blob();}
  const url=URL.createObjectURL(blob);try{const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url});const canvas=document.createElement('canvas'),ratio=Math.min(1,1400/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=image.naturalWidth*ratio;canvas.height=image.naturalHeight*ratio;canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);const jpg=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));return jpg?new Uint8Array(await jpg.arrayBuffer()):null}finally{URL.revokeObjectURL(url)}
 },async drawing=>new Uint8Array(await (await snapshotPng(drawing,projectId,headers)).arrayBuffer()));
 const filename=(report.meeting.date+' '+report.meeting.title+' '+(report.revision?'R'+String(report.revision).padStart(2,'0'):'DRAFT')).replace(/[/\\:*?"<>|]/g,'-')+'.pdf',file=new File([bytes as BlobPart],filename,{type:'application/pdf'});
 if(download){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000)}return file;
}
