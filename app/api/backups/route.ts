import {z} from 'zod';
import {withSession} from '@/lib/supabase-server';
import {access,db,error,fail,json,origin} from '@/lib/server';
import {backupRow,createBackup,manifestFor,startRestore,stepBackup,stepRestore} from '@/lib/backups';
import {backupArchive} from '@/lib/backup-archive';
export const GET=withSession(async req=>{try{
 const url=new URL(req.url),a=await access(req,url.searchParams.get('project'));if(a.role!=='owner'||a.shareId)fail('Only the project administrator can access backups.',403);
 const id=url.searchParams.get('id');if(!id)return json({backups:(await db().prepare('SELECT id,created,status,cursor,total FROM backups WHERE project_id=? ORDER BY created DESC').bind(a.project.id).all()).results});
 const row=await backupRow(a,id);if(row.status!=='ready')fail('Finish the backup before downloading.');const manifest=await manifestFor(row);
 return new Response(backupArchive(manifest),{headers:{'Content-Type':'application/x-tar','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent('Octava '+a.project.name+' '+row.created.slice(0,10)+'.tar'),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return error(e)}});
export const POST=withSession(async req=>{try{
 origin(req);const b=z.object({projectId:z.string(),action:z.enum(['create','step','restore','restoreStep']),id:z.string().optional()}).parse(await req.json()),a=await access(req,b.projectId);if(a.role!=='owner'||a.shareId)fail('Only the project administrator can manage backups.',403);
 if(b.action==='create')return json(await createBackup(a));if(!b.id)fail('Choose a backup.');
 return json(b.action==='step'?await stepBackup(a,b.id):b.action==='restore'?await startRestore(a,b.id):await stepRestore(a,b.id));
}catch(e){return error(e)}});
