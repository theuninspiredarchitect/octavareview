import {z} from 'zod';
import {withSession} from '@/lib/supabase-server';
import {access,db,error,fail,getRecords,json,origin} from '@/lib/server';

export const POST=withSession(async(req)=>{try{
 origin(req);const b=z.object({projectId:z.string(),action:z.enum(['create','rename','move']),name:z.string().optional(),id:z.string().optional(),sheetId:z.string().optional(),folderId:z.string().optional(),version:z.number().optional()}).parse(await req.json()),a=await access(req,b.projectId);
 if(a.role==='client'||a.shareId)fail('Project editors manage plan folders.',403);
 if(b.action==='move'){
  const sheet=(await getRecords(a)).find(r=>r.type==='sheet'&&r.id===b.sheetId);
  if(!sheet||sheet.type!=='sheet')fail('Plan not found.',404);
  const folderId=z.string().max(100).parse(b.folderId||'');
  if(folderId&&!await db().prepare('SELECT id FROM plan_folders WHERE id=? AND project_id=?').bind(folderId,a.project.id).first())fail('Folder not found.',404);
  // A folder move only patches classification; it never replaces drawing content.
  await db().prepare(folderId
   ?"UPDATE records SET data=json_set(data,'$.folderId',?),version=version+1 WHERE project_id=? AND type='sheet' AND json_extract(data,'$.groupId')=?"
   :"UPDATE records SET data=json_remove(data,'$.folderId'),version=version+1 WHERE project_id=? AND type='sheet' AND json_extract(data,'$.groupId')=?")
   .bind(...(folderId?[folderId,a.project.id,sheet.groupId]:[a.project.id,sheet.groupId])).run();
  return json({ok:true});
 }
 const name=z.string().trim().min(1).max(80).parse(b.name).replace(/\s+/g,' ');
 if(!['create','rename'].includes(b.action))fail('Unknown folder action.');
 const duplicate=await db().prepare('SELECT id FROM plan_folders WHERE project_id=? AND name=? COLLATE NOCASE').bind(a.project.id,name).first<{id:string}>();
 if(duplicate&&duplicate.id!==b.id)fail('A folder with this name already exists.');
 if(b.action==='rename'){
  const id=z.string().max(100).parse(b.id),version=z.number().int().positive().parse(b.version);
  const result=await db().prepare('UPDATE plan_folders SET name=?,version=version+1 WHERE id=? AND project_id=? AND version=?').bind(name,id,a.project.id,version).run();
  if(!result.meta.changes)fail('This folder changed. Refresh and try again.',409);
  return json({ok:true});
 }
 const folder={id:crypto.randomUUID(),name,version:1,created:new Date().toISOString()};
 await db().prepare('INSERT INTO plan_folders(id,project_id,name,version,created) VALUES(?,?,?,1,?)').bind(folder.id,a.project.id,name,folder.created).run();
 return json({folder},201);
}catch(e){if(e instanceof z.ZodError)return json({error:'Give the folder a name of up to 80 characters.'},400);return error(e)}});
