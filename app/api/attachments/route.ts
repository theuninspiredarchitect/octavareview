import {access,bucket,db,error,fail,getRecords,json,origin} from '@/lib/server';
import {withSession} from '@/lib/supabase-server';
function detect(bytes:Uint8Array){
 const h=Array.from(bytes.slice(0,12)).map(v=>v.toString(16).padStart(2,'0')).join(''),ascii=new TextDecoder().decode(bytes.slice(0,16));
 if(h.startsWith('89504e470d0a1a0a'))return 'image/png';if(h.startsWith('ffd8ff'))return 'image/jpeg';if(ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a'))return 'image/gif';if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')return 'image/webp';if(ascii.startsWith('%PDF-'))return 'application/pdf';return 'application/octet-stream';
}
export const POST=withSession(async(req)=>{try{
 origin(req);const url=new URL(req.url),a=await access(req,url.searchParams.get('project')),taskId=url.searchParams.get('task');
 const task=(await getRecords(a)).find(r=>r.type==='task'&&r.id===taskId);if(!task)fail('Save the task before attaching files.',404);
 if(Number(req.headers.get('content-length')||0)>26*1024*1024)fail('Choose a file smaller than 25 MB.',413);
 const form=await req.formData(),file=form.get('file');if(!(file instanceof File)||!file.size||file.size>25*1024*1024)fail('Choose a file smaller than 25 MB.');
 const bytes=await file.arrayBuffer(),id=crypto.randomUUID(),mime=detect(new Uint8Array(bytes)),name=file.name.replace(/[\u0000-\u001f]/g,'').slice(0,240)||'Attachment',created=new Date().toISOString();
 await bucket().put(a.project.id+'/attachments/'+id,bytes,{httpMetadata:{contentType:mime}});
 try{await db().prepare('INSERT INTO attachments(id,project_id,task_id,name,mime,size,creator,created) VALUES(?,?,?,?,?,?,?,?)').bind(id,a.project.id,task.id,name,mime,file.size,a.user,created).run()}catch(e){await bucket().delete(a.project.id+'/attachments/'+id);throw e}
 return json({attachment:{id,name,mime,size:file.size,created}},201);
}catch(e){return error(e)}});
export const GET=withSession(async(req)=>{try{
 const url=new URL(req.url),a=await access(req,url.searchParams.get('project')),f=await db().prepare('SELECT * FROM attachments WHERE id=? AND project_id=?').bind(url.searchParams.get('id'),a.project.id).first<any>();
 if(!f)fail('Attachment not found.',404);
 const records=await getRecords(a);if(!records.some(r=>r.type==='task'&&r.id===f.task_id))fail('Attachment not available.',403);
 if(!records.some(r=>r.type==='comment'&&r.attachments?.some(item=>item.id===f.id)))fail('Attachment not available.',403);
 const object=await bucket().get(a.project.id+'/attachments/'+f.id);if(!object)fail('Attachment not found.',404);
 const inline=f.mime.startsWith('image/')&&!url.searchParams.has('download');
 return new Response(object.body,{headers:{'Content-Type':f.mime,'Content-Disposition':(inline?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(f.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}catch(e){return error(e)}});
