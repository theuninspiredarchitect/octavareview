export type UploadItem={id:string;file:File;status:'queued'|'uploading'|'done'|'error';progress:number;error?:string};
export const fileKey=(file:File)=>[file.name,file.size,file.lastModified].join('\0');
let uploadNumber=0;
export function newUploadItems(files:File[]):UploadItem[]{
 const seen=new Set<string>();
 return files.filter(file=>{const key=fileKey(file);if(seen.has(key))return false;seen.add(key);return true}).map(file=>({id:'upload-'+Date.now()+'-'+(++uploadNumber),file,status:'queued',progress:0}));
}
export function isPdf(file:File){return file.type==='application/pdf'||/\.pdf$/i.test(file.name)}
// Keep memory bounded on phones and continue the batch if one file fails.
// Completed items are retained and skipped when the user retries.
export async function runUploadBatch<T extends UploadItem>(items:T[],upload:(item:T,progress:(n:number)=>void)=>Promise<void>,onChange:(items:T[])=>void){
 const queue=items.map(item=>({...item}));
 const publish=()=>onChange(queue.map(item=>({...item})));
 for(const item of queue){
  if(item.status==='done')continue;
  item.status='uploading';item.progress=0;item.error=undefined;publish();
  try{await upload(item,n=>{item.progress=Math.max(0,Math.min(100,n));publish()});item.status='done';item.progress=100}
  catch(error){item.status='error';item.error=error instanceof Error?error.message:'Upload failed. Please retry.'}
  publish();
 }
 return queue;
}
