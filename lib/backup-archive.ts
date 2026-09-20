import {bucket} from './server';
import type {BackupManifest} from './backups';
// Streaming POSIX tar keeps exports independent of worker memory and archive size.
const encoder=new TextEncoder();
function header(name:string,size:number){
 const bytes=new Uint8Array(512),write=(offset:number,length:number,text:string)=>bytes.set(encoder.encode(text).slice(0,length),offset),oct=(n:number,length:number)=>n.toString(8).padStart(length-1,'0')+'\0';
 write(0,100,name);write(100,8,oct(0o644,8));write(108,8,oct(0,8));write(116,8,oct(0,8));write(124,12,oct(size,12));write(136,12,oct(Math.floor(Date.now()/1000),12));write(148,8,'        ');write(156,1,'0');write(257,6,'ustar\0');write(263,2,'00');write(148,8,bytes.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ');return bytes;
}
export function backupArchive(manifest:BackupManifest){
 async function* chunks(){
  const bytes=encoder.encode(JSON.stringify(manifest,null,2));yield header('manifest.json',bytes.length);yield bytes;if(bytes.length%512)yield new Uint8Array(512-bytes.length%512);
  for(const item of manifest.objects){const file=await bucket().get(item.backupKey);if(!file)throw Error('A backup file is missing.');yield header(item.archivePath,file.size);const reader=file.body.getReader();try{while(true){const data=await reader.read();if(data.done)break;yield data.value}}finally{await reader.cancel().catch(()=>{})}if(file.size%512)yield new Uint8Array(512-file.size%512)}
  yield new Uint8Array(1024);
 }
 const iterator=chunks();return new ReadableStream<Uint8Array>({async pull(controller){try{const item=await iterator.next();if(item.done)controller.close();else controller.enqueue(item.value)}catch(e){controller.error(e)}},async cancel(){await iterator.return(undefined)}});
}
