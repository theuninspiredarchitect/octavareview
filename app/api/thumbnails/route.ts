import {withSession} from '@/lib/supabase-server';
import {access,bucket,db,error,fail,json,origin} from '@/lib/server';
import {projectAssets} from '@/lib/project-assets';
import {detectFileType} from '@/lib/file-type';
export const GET=withSession(async req=>{try{
 const u=new URL(req.url),a=await access(req,u.searchParams.get('project')),id=u.searchParams.get('id');
 if(!(await projectAssets(a)).some(f=>f.id===id&&f.kind==='photo'))fail('Photo not found.',404);
 const object=await bucket().get(a.project.id+'/thumbnails/'+id);if(!object)fail('Preview not generated yet.',404);
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return error(e)}});
export const POST=withSession(async req=>{try{
 origin(req);const u=new URL(req.url),a=await access(req,u.searchParams.get('project')),id=u.searchParams.get('id');if(!id)fail('Photo required.');
 // Permit the uploader to attach a thumbnail before its task comment is published.
 const file=await db().prepare('SELECT creator,mime FROM project_documents WHERE project_id=? AND id=? UNION ALL SELECT creator,mime FROM attachments WHERE project_id=? AND id=?').bind(a.project.id,id,a.project.id,id).first<any>();
 if(!file||!file.mime.startsWith('image/'))fail('Photo not found.',404);
 if(file.creator!==a.user&&(a.role==='client'||a.shareId))fail('Only the uploader or project team can create this preview.',403);
 if(Number(req.headers.get('content-length')||0)>1024*1024)fail('Preview is too large.',413);
 const reader=req.body?.getReader();if(!reader)fail('Preview required.');const chunks:Uint8Array[]=[];let size=0;
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>1024*1024){await reader.cancel();fail('Preview is too large.',413)}chunks.push(r.value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}const mime=detectFileType(bytes);if(!['image/webp','image/jpeg','image/png'].includes(mime))fail('Use a WebP, JPEG or PNG preview.');
 await bucket().put(a.project.id+'/thumbnails/'+id,bytes,{httpMetadata:{contentType:mime}});
 await db().prepare('INSERT OR IGNORE INTO thumbnails(project_id,asset_id,created) VALUES(?,?,?)').bind(a.project.id,id,new Date().toISOString()).run();return json({ok:true});
}catch(e){return error(e)}});
