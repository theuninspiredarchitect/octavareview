import {z} from 'zod';
import {withSession} from '@/lib/supabase-server';
import {access,bucket,db,error,fail,getRecords,json,origin,type Access} from '@/lib/server';
import {detectFileType} from '@/lib/file-type';
import {finishPlan,planImportSchema} from '@/lib/plan-import';
const chunkSize=8*1024*1024;
const clean=(s:string)=>s.replace(/[\u0000-\u001f/\\]/g,'').slice(0,240)||'File';
async function session(a:Access,id:string){const s=await db().prepare('SELECT * FROM uploads WHERE id=? AND project_id=? AND creator=?').bind(id,a.project.id,a.user).first<any>();if(!s)fail('Upload not found.',404);if(s.expires<Date.now())fail('This upload expired. Select the file again.',410);return s}
async function permission(a:Access,category:string,m:any){
 if(category==='plan'){if(a.role==='client'||a.shareId)fail('Project editors upload plans.',403);planImportSchema.parse(m)}
 else if(category==='document'){if(a.shareId)fail('Sign in as a project participant to upload files.',403);z.enum(['photo','file','specification','presentation']).parse(m.kind);if(a.role==='client'&&['specification','presentation'].includes(m.kind))fail('Project editors upload presentations and specifications.',403);if(m.groupId&&!await db().prepare('SELECT id FROM photo_groups WHERE project_id=? AND id=?').bind(a.project.id,m.groupId).first())fail('Photo group not found.',404)}
 else if(!(await getRecords(a)).some(r=>r.type==='task'&&r.id===m.taskId))fail('Save the task before uploading attachments.',404);
}
export const POST=withSession(async req=>{try{
 origin(req);const b:any=await req.json(),a=await access(req,b.projectId);
 if(b.action==='start'){
  const v=z.object({category:z.enum(['document','attachment','plan']),name:z.string().min(1).max(240),size:z.number().int().positive().max(200*1024*1024),metadata:z.record(z.unknown())}).parse(b);
  if(v.category==='plan'&&v.size>64*1024*1024)fail('Plan PDFs can be up to 64 MB. Split larger PDFs into smaller sets.',413);
  await permission(a,v.category,v.metadata);
  const active=await db().prepare('SELECT count(*) AS n FROM uploads WHERE project_id=? AND creator=? AND expires>? AND result IS NULL').bind(a.project.id,a.user,Date.now()).first<any>();if(active.n>=10)fail('Finish your other uploads first.',429);
  const id=crypto.randomUUID(),key=a.project.id+(v.category==='plan'?'/'+id+'.pdf':'/'+(v.category==='document'?'documents':'attachments')+'/'+id),multi=await bucket().createMultipartUpload(key);
  try{await db().prepare('INSERT INTO uploads(id,project_id,creator,upload_id,object_key,category,metadata,size,expires) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,a.project.id,a.user,multi.uploadId,key,v.category,JSON.stringify({...v.metadata,filename:clean(v.name)}),v.size,Date.now()+24*60*60*1000).run()}catch(e){await multi.abort();throw e}
  return json({id,chunkSize});
 }
 if(b.action!=='complete')fail('Unknown upload action.');
 const s=await session(a,z.string().parse(b.id));if(s.result)return json(JSON.parse(s.result));const m=JSON.parse(s.metadata);await permission(a,s.category,m);
 const parts=(await db().prepare('SELECT part,etag,size FROM upload_parts WHERE upload_id=? ORDER BY part').bind(s.id).all<any>()).results;
 if(!s.mime||parts.length!==Math.ceil(s.size/chunkSize)||parts.some((p,i)=>p.part!==i+1)||parts.reduce((sum,p)=>sum+p.size,0)!==s.size)fail('The upload is incomplete. Please try again.');
 let stored=await bucket().head(s.object_key);if(!stored)stored=await bucket().resumeMultipartUpload(s.object_key,s.upload_id).complete(parts.map(p=>({partNumber:p.part,etag:p.etag})));
 if(stored.size!==s.size)fail('Uploaded size did not match. Please try again.');
 const now=new Date().toISOString();let result:any;
 if(s.category==='plan')result=await finishPlan(a,s.id,m.filename,m);
 else if(s.category==='attachment'){
  await db().prepare('INSERT OR IGNORE INTO attachments(id,project_id,task_id,name,mime,size,creator,created) VALUES(?,?,?,?,?,?,?,?)').bind(s.id,a.project.id,m.taskId,m.filename,s.mime,s.size,a.user,now).run();result={attachment:{id:s.id,name:m.filename,mime:s.mime,size:s.size,created:now}};
 }else{
  const ext=m.filename.match(/\.[a-z0-9]{1,8}$/i)?.[0]||'',name=m.kind==='presentation'?clean((typeof m.name==='string'&&m.name.trim()?m.name.trim():now.slice(0,10)+' '+a.project.name)+ext):m.filename;
  await db().batch([db().prepare('INSERT OR IGNORE INTO project_documents(id,project_id,kind,name,mime,size,creator,author,author_role,created) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(s.id,a.project.id,m.kind,name,s.mime,s.size,a.user,a.name,a.profession,now),...(m.kind==='photo'&&m.groupId?[db().prepare('INSERT OR IGNORE INTO photo_group_items(project_id,photo_id,group_id) VALUES(?,?,?)').bind(a.project.id,s.id,m.groupId)]:[])]);
  result={asset:{id:s.id,name,mime:s.mime,size:s.size,created:now,kind:m.kind,source:'project',author:a.name,authorRole:a.profession,creatorId:a.user,groupId:m.groupId||undefined,liked:false,likeCount:0}};
 }
 await db().prepare('UPDATE uploads SET result=? WHERE id=?').bind(JSON.stringify(result),s.id).run();return json(result);
}catch(e){if(e instanceof z.ZodError)return json({error:'Check the upload details.'},400);return error(e)}});
export const PUT=withSession(async req=>{try{
 origin(req);const u=new URL(req.url),a=await access(req,u.searchParams.get('project')),s=await session(a,u.searchParams.get('id')||'');if(s.result)fail('This upload is complete.');
 const part=z.coerce.number().int().min(1).max(Math.ceil(s.size/chunkSize)).parse(u.searchParams.get('part')),expected=Math.min(chunkSize,s.size-(part-1)*chunkSize);
 if(Number(req.headers.get('content-length')||0)>expected)fail('Upload chunk is too large.',413);
 const reader=req.body?.getReader();if(!reader)fail('Empty upload.');const chunks:Uint8Array[]=[];let size=0;
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>expected){await reader.cancel();fail('Upload chunk is too large.',413)}chunks.push(r.value)}
 if(size!==expected)fail('Upload chunk is incomplete.');const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 let mime:string|undefined;if(part===1){mime=detectFileType(bytes);const m=JSON.parse(s.metadata);if((s.category==='plan'||m.kind==='specification')&&mime!=='application/pdf')fail('Choose a PDF file.');if(m.kind==='photo'&&!mime.startsWith('image/'))fail('Choose a JPEG, PNG, WebP, GIF, AVIF or HEIC image.');if(m.kind==='presentation'&&mime!=='application/pdf'&&!/\.(pptx?|key)$/i.test(m.filename))fail('Choose a PDF, PowerPoint or Keynote presentation.')}
 const uploaded=await bucket().resumeMultipartUpload(s.object_key,s.upload_id).uploadPart(part,bytes);
 await db().batch([db().prepare('INSERT INTO upload_parts(upload_id,part,etag,size) VALUES(?,?,?,?) ON CONFLICT(upload_id,part) DO UPDATE SET etag=excluded.etag,size=excluded.size').bind(s.id,part,uploaded.etag,size),...(mime?[db().prepare('UPDATE uploads SET mime=? WHERE id=?').bind(mime,s.id)]:[])]);return json({ok:true});
}catch(e){return error(e)}});
export const DELETE=withSession(async req=>{try{
 origin(req);const b:any=await req.json(),a=await access(req,b.projectId),s=await session(a,b.id);if(s.result)return json({ok:true});
 // Never remove a file that committed successfully before the response was interrupted.
 const table=s.category==='plan'?'files':s.category==='document'?'project_documents':'attachments';
 if(await db().prepare('SELECT id FROM '+table+' WHERE project_id=? AND id=?').bind(a.project.id,s.id).first())return json({ok:true});
 await bucket().resumeMultipartUpload(s.object_key,s.upload_id).abort().catch(()=>{});await bucket().delete(s.object_key);
 await db().batch([db().prepare('DELETE FROM upload_parts WHERE upload_id=?').bind(s.id),db().prepare('DELETE FROM uploads WHERE id=?').bind(s.id)]);return json({ok:true});
}catch(e){return error(e)}});
