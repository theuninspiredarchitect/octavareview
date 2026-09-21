import {z} from 'zod';
import {access,db,error,fail,identity,json,managedProjects,origin,profession,type Access} from '@/lib/server';
import {withSession} from '@/lib/supabase-server';
import {accountAdminAllowed,accountLinksConfigured} from '@/lib/account-admin';

const emailSchema=z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const profileSchema=z.object({name:z.string().trim().min(1).max(120),profession:z.enum(['internal','owner','builder','other']),access:z.enum(['editor','client']),accountRole:z.enum(['admin','user'])});
async function context(req:Request,projectId?:string){
 const a=await access(req,projectId);if(a.role!=='owner'||a.shareId)fail('Only an admin can manage users.',403);
 const projects=await managedProjects(req,a.project.owner);
 return {a,projects,ids:projects.map(p=>p.id as string)};
}
async function rows(ids:string[]){
 if(!ids.length)return [];
 return (await db().prepare('SELECT * FROM project_members WHERE project_id IN ('+ids.map(()=>'?').join(',')+') ORDER BY name COLLATE NOCASE,created').bind(...ids).all<any>()).results;
}
function protect(a:Access,matching:any[],email:string){
 if(email===a.email||matching.some(m=>m.user_id===a.user))fail('Another admin must change your own access.',403);
 if(matching.some(m=>m.user_id===a.project.owner))fail('The workspace owner always retains admin access.',403);
}
export const GET=withSession(async req=>{try{
 const {a,projects,ids}=await context(req,new URL(req.url).searchParams.get('project')||undefined),people=new Map<string,any>();
 for(const m of await rows(ids)){
  let person=people.get(m.email);
  if(!person){person={email:m.email,name:m.name,profession:profession(m.profession),access:m.access,accountRole:m.account_role,joined:!!m.user_id,self:m.email===a.email||m.user_id===a.user,owner:m.user_id===a.project.owner,projects:[]};people.set(m.email,person)}
  person.joined ||= !!m.user_id;person.self ||= m.user_id===a.user;person.owner ||= m.user_id===a.project.owner;
  person.projects.push({id:m.project_id,memberId:m.id,enabled:m.enabled===1,accountRole:m.account_role});
 }
 const users=[...people.values()].map(p=>({...p,accountRole:new Set(p.projects.map((m:any)=>m.accountRole)).size>1?'mixed':p.accountRole}));
 return json({projects:projects.map(p=>({id:p.id,name:p.name})),users,owner:{name:a.user===a.project.owner?a.name:'Workspace owner',email:a.user===a.project.owner?a.email:'',self:a.user===a.project.owner},canManageAccounts:accountAdminAllowed(a)&&accountLinksConfigured(),accountLinksReady:accountLinksConfigured()});
}catch(e){return error(e)}});

export const POST=withSession(async req=>{try{
 origin(req);const text=await req.text();if(text.length>30000)fail('Request is too large.',413);
 const b=JSON.parse(text),{a,projects,ids}=await context(req,z.string().min(1).parse(b.projectId));
 const email=emailSchema.parse(b.email),existing=(await rows(ids)).filter(m=>m.email===email);
 protect(a,existing,email);
 if(b.action==='toggle'){
  const target=z.string().parse(b.targetProjectId),enabled=z.boolean().parse(b.enabled);
  if(!projects.some(p=>p.id===target))fail('You can only assign projects you administer.',403);
  if(!existing.length)fail('Person not found.',404);
  const member=existing.find(m=>m.project_id===target),source=existing[0];
  const statements=member?[db().prepare('UPDATE project_members SET enabled=? WHERE id=? AND project_id=?').bind(enabled?1:0,member.id,target)]:[db().prepare('INSERT INTO project_members(id,project_id,user_id,email,name,profession,access,account_role,enabled,created) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),target,source.user_id,email,source.name,source.profession,source.access,source.account_role,enabled?1:0,new Date().toISOString())];
  if(!enabled)statements.push(db().prepare('UPDATE account_links SET used=1 WHERE project_id=? AND email=?').bind(target,email));
  await db().batch(statements);return json({ok:true});
 }
 const profile=profileSchema.parse(b);
 if(b.action==='profile'){
  if(!existing.length)fail('Person not found.',404);
  await db().batch(existing.map(m=>db().prepare('UPDATE project_members SET name=?,profession=?,access=?,account_role=? WHERE id=? AND project_id=?').bind(profile.name,profile.profession,profile.access,profile.accountRole,m.id,m.project_id)));
  return json({ok:true});
 }
 if(b.action!=='add')fail('Unknown user action.');
 if(existing.length)fail('This person is already listed. Select them to change project access.',409);
 const selected=[...new Set(z.array(z.string()).min(1,'Choose at least one project.').max(200).parse(b.projects))];
 if(selected.some(id=>!ids.includes(id)))fail('You can only assign projects you administer.',403);
 const now=new Date().toISOString();
 // Leave every other project unassigned, including projects created later.
 await db().batch(selected.map(id=>db().prepare('INSERT INTO project_members(id,project_id,email,name,profession,access,account_role,enabled,created) VALUES(?,?,?,?,?,?,?,1,?)').bind(crypto.randomUUID(),id,email,profile.name,profile.profession,profile.access,profile.accountRole,now)));
 return json({ok:true},201);
}catch(e){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Check the user details.'},400);return error(e)}});
