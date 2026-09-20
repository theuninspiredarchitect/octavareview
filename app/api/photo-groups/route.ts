import {z} from 'zod';
import {withSession} from '@/lib/supabase-server';
import {access,db,error,fail,json,origin} from '@/lib/server';
import {projectAssets} from '@/lib/project-assets';

export const POST=withSession(async req=>{try{
 origin(req);const b=z.object({projectId:z.string(),action:z.enum(['create','rename','remove','move']),id:z.string().optional(),name:z.string().trim().min(1).max(100).optional(),photoIds:z.array(z.string()).max(200).optional(),groupId:z.string().nullable().optional()}).parse(await req.json()),a=await access(req,b.projectId);
 if(a.shareId||a.role==='client')fail('Project editors manage photo groups.',403);
 if(b.action==='move'){
  if(!b.photoIds?.length)fail('Select photos first.');
  if(b.groupId&&!await db().prepare('SELECT id FROM photo_groups WHERE id=? AND project_id=?').bind(b.groupId,a.project.id).first())fail('Photo group not found.',404);
  const visible=new Set((await projectAssets(a)).filter(f=>f.kind==='photo').map(f=>f.id));
  if(b.photoIds.some(id=>!visible.has(id)))fail('Photo not available in this project.',404);
  await db().batch(b.photoIds.map(id=>b.groupId?db().prepare('INSERT INTO photo_group_items(project_id,photo_id,group_id) VALUES(?,?,?) ON CONFLICT(project_id,photo_id) DO UPDATE SET group_id=excluded.group_id').bind(a.project.id,id,b.groupId):db().prepare('DELETE FROM photo_group_items WHERE project_id=? AND photo_id=?').bind(a.project.id,id)));
 }else if(b.action==='remove'){
  await db().batch([db().prepare('DELETE FROM photo_group_items WHERE project_id=? AND group_id=?').bind(a.project.id,b.id||''),db().prepare('DELETE FROM photo_groups WHERE project_id=? AND id=?').bind(a.project.id,b.id||'')]);
 }else{
  if(!b.name)fail('Enter a group name.');
  const duplicate=await db().prepare('SELECT id FROM photo_groups WHERE project_id=? AND name=? COLLATE NOCASE AND id!=?').bind(a.project.id,b.name,b.id||'').first();if(duplicate)fail('A group with this name already exists.');
  if(b.action==='rename'){const r=await db().prepare('UPDATE photo_groups SET name=? WHERE project_id=? AND id=?').bind(b.name,a.project.id,b.id||'').run();if(!r.meta.changes)fail('Group not found.',404)}
  else await db().prepare('INSERT INTO photo_groups(id,project_id,name,created) VALUES(?,?,?,?)').bind(crypto.randomUUID(),a.project.id,b.name,new Date().toISOString()).run();
 }
 return json({groups:(await db().prepare('SELECT id,name,created FROM photo_groups WHERE project_id=? ORDER BY name COLLATE NOCASE').bind(a.project.id).all()).results});
}catch(e){if(e instanceof z.ZodError)return json({error:'Check the group name and selected photos.'},400);return error(e)}});
