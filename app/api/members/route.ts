import {z} from 'zod';
import {access,db,error,fail,json,origin,profession} from '@/lib/server';
import {withSession} from '@/lib/supabase-server';
import {accountAdminAllowed,accountLinksConfigured} from '@/lib/account-admin';
export const GET=withSession(async(req)=>{try{
 const a=await access(req,new URL(req.url).searchParams.get('project'));if(a.role==='client')fail('Your team manages project access.',403);
 const rows=(await db().prepare('SELECT id,email,name,profession,access,user_id FROM project_members WHERE project_id=? ORDER BY name').bind(a.project.id).all<any>()).results;
 return json({canManage:a.role==='owner',canManageAccounts:a.role==='owner'&&accountAdminAllowed(a)&&accountLinksConfigured(),accountLinksReady:accountLinksConfigured(),members:[{id:'owner',name:a.role==='owner'?a.name:'Project administrator',email:a.role==='owner'?a.email:'',profession:profession(a.project.owner_profession),access:'editor',joined:true,owner:true},...rows.map(m=>({...m,profession:profession(m.profession),user_id:undefined,joined:!!m.user_id}))]});
}catch(e){return error(e)}});
export const POST=withSession(async(req)=>{try{
 origin(req);const b:any=await req.json(),a=await access(req,b.projectId);if(a.role!=='owner')fail('Only the project administrator can manage people.',403);
 if(b.action==='remove'){const id=z.string().parse(b.id);await db().batch([db().prepare('DELETE FROM project_members WHERE id=? AND project_id=?').bind(id,a.project.id),db().prepare('UPDATE account_links SET used=1 WHERE member_id=? AND project_id=?').bind(id,a.project.id)]);return json({ok:true})}
 const job=z.enum(['internal','owner','builder','other']).parse(b.profession);
 if(b.id==='owner'){await db().prepare('UPDATE projects SET owner_profession=? WHERE id=?').bind(job,a.project.id).run();return json({ok:true})}
 const email=z.string().trim().email().max(254).parse(b.email).toLowerCase(),name=z.string().trim().min(1).max(120).parse(b.name),permission=z.enum(['editor','client']).parse(b.access);
 if(email===a.email)fail('Use your administrator entry to change your role.');
 if(b.id){const old=await db().prepare('SELECT email FROM project_members WHERE id=? AND project_id=?').bind(b.id,a.project.id).first<any>();if(!old)fail('Person not found.',404);if(old.email!==email)await db().prepare('UPDATE account_links SET used=1 WHERE member_id=? AND project_id=?').bind(b.id,a.project.id).run();await db().prepare('UPDATE project_members SET email=?,name=?,profession=?,access=?,user_id=CASE WHEN email=? THEN user_id ELSE NULL END WHERE id=? AND project_id=?').bind(email,name,job,permission,email,b.id,a.project.id).run()}
 else{if(await db().prepare('SELECT id FROM project_members WHERE project_id=? AND email=?').bind(a.project.id,email).first())fail('This person has already been added.');await db().prepare('INSERT INTO project_members(id,project_id,email,name,profession,access,created) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),a.project.id,email,name,job,permission,new Date().toISOString()).run()}
 return json({ok:true,url:new URL(req.url).origin+'/?project='+a.project.id});
}catch(e){if(e instanceof z.ZodError)return json({error:'Check the name, email and role.'},400);return error(e)}});
