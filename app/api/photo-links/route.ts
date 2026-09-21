import {withSession} from '@/lib/supabase-server';
import {access,bucket,db,error,fail,getRecords,json} from '@/lib/server';

// A visible pin grants access to its one linked photo, not the rest of its library or task.
export const GET=withSession(async req=>{try{
 const u=new URL(req.url),a=await access(req,u.searchParams.get('project'));
 const pin=(await getRecords(a)).find(r=>r.type==='markup'&&r.kind==='photo'&&r.id===u.searchParams.get('pin'));
 if(!pin||pin.type!=='markup'||!pin.photoId)fail('This photo pin is no longer available.',404);
 const file=await db().prepare("SELECT id,name,mime,size,'project' AS source FROM project_documents WHERE project_id=? AND id=? AND kind='photo' UNION ALL SELECT id,name,mime,size,'task' AS source FROM attachments WHERE project_id=? AND id=?").bind(a.project.id,pin.photoId,a.project.id,pin.photoId).first<{id:string;name:string;mime:string;size:number;source:'project'|'task'}>();
 if(!file||!file.mime.startsWith('image/'))fail('The linked photo is no longer available.',404);
 if(u.searchParams.has('metadata'))return json({file});
 const thumb=u.searchParams.has('thumbnail'),key=a.project.id+'/'+(thumb?'thumbnails':file.source==='task'?'attachments':'documents')+'/'+file.id;
 const object=await bucket().get(key);if(!object)fail(thumb?'Preview not generated yet.':'The linked photo could not be found.',404);
 return new Response(object.body,{headers:{'Content-Type':thumb?object.httpMetadata?.contentType||'image/webp':file.mime,'Content-Disposition':(u.searchParams.has('download')?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(file.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}catch(e){return error(e)}});
