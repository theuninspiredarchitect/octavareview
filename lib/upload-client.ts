export type Requester=(path:string,options?:RequestInit)=>Promise<any>;
export const DOCUMENT_LIMIT=200*1024*1024,PLAN_LIMIT=64*1024*1024;
export async function uploadFile(request:Requester,projectId:string,file:File,category:'document'|'attachment'|'plan',metadata:Record<string,unknown>,progress?:(percent:number)=>void){
 const limit=category==='plan'?PLAN_LIMIT:DOCUMENT_LIMIT;
 if(!file.size||file.size>limit)throw Error('Choose a file up to '+limit/1024/1024+' MB.');
 const session=await request('/api/uploads',{method:'POST',body:JSON.stringify({action:'start',projectId,category,size:file.size,name:file.name,metadata})});
 try{
  for(let offset=0,part=1;offset<file.size;offset+=session.chunkSize,part++){
   const data=file.slice(offset,offset+session.chunkSize);let attempt=0;
   while(true){try{await request('/api/uploads?project='+projectId+'&id='+session.id+'&part='+part,{method:'PUT',body:data});break}catch(e:any){if(++attempt>=3||(e.status&&e.status<500&&e.status!==408&&e.status!==429))throw e;await new Promise(r=>setTimeout(r,500*attempt))}}
   progress?.(Math.round(Math.min(file.size,offset+session.chunkSize)/file.size*100));
  }
  return await request('/api/uploads',{method:'POST',body:JSON.stringify({action:'complete',projectId,id:session.id})});
 }catch(e){await request('/api/uploads',{method:'DELETE',body:JSON.stringify({projectId,id:session.id})}).catch(()=>{});throw e}
}
export async function makeThumbnail(file:Blob){
 if(!file.type.startsWith('image/'))return null;
 let image:ImageBitmap|HTMLImageElement|undefined,url='';
 try{
  try{image=await createImageBitmap(file)}catch{url=URL.createObjectURL(file);image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url})}
  const width='naturalWidth'in image?image.naturalWidth:image.width,height='naturalHeight'in image?image.naturalHeight:image.height;
  const ratio=Math.min(1,640/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
  return await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.76));
 }catch{return null}finally{if(image&&'close'in image)image.close();if(url)URL.revokeObjectURL(url)}
}
export async function uploadThumbnail(request:Requester,projectId:string,id:string,file:Blob){const thumb=await makeThumbnail(file);if(!thumb)return false;await request('/api/thumbnails?project='+projectId+'&id='+id,{method:'POST',body:thumb});return true}
