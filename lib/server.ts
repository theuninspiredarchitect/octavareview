import {env} from 'cloudflare:workers';
import {authenticatedUser} from './supabase-server';
import type {Profession,RecordItem} from './review-types';
export function db(){if(!env.DB)throw new Error('Storage is unavailable. Please try again.');return env.DB;}
export function bucket(){if(!env.BUCKET)throw new Error('Document storage is unavailable.');return env.BUCKET;}
export const profession=(value:unknown):Profession=>value==='owner'||value==='builder'||value==='other'?value:'internal';
export async function guestIdentity(req:Request){
 const token=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('octava_guest='))?.slice(13);
 if(token&&/^[a-f0-9-]{72}$/.test(token))return await db().prepare('SELECT owner_id FROM guest_sessions WHERE token_hash = ? AND expires > ?').bind(await hash(token),Date.now()).first<{owner_id:string}>();
 return null;
}
export async function identity(req:Request){
 const account=await authenticatedUser(req);
 if(account)return {id:'supabase:'+account.id,name:String(account.user_metadata?.full_name||account.email||'Reviewer').slice(0,200),email:account.email_confirmed_at?account.email?.toLowerCase()||'':'',profession:profession(account.user_metadata?.profession),guest:false,account:true};
 const id=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email')||'';
 let name=email||'Reviewer';const full=req.headers.get('oai-authenticated-user-full-name');
 if(full&&req.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(full)}catch{}}
 if(id)return {id,name,email:email.toLowerCase(),profession:'internal' as Profession,guest:false,account:false};
 const session=await guestIdentity(req);
 return {id:session?.owner_id||null,name:'Guest',email:'',profession:'internal' as Profession,guest:true,account:false};
}
export async function claimGuestWorkspace(req:Request,userId:string,verifiedEmail=''){
 const guest=await guestIdentity(req),owners=new Set<string>();if(guest)owners.add(guest.owner_id);
 const platformId=req.headers.get('oai-authenticated-user-id'),platformEmail=req.headers.get('oai-authenticated-user-email')?.toLowerCase();
 if(platformId&&verifiedEmail&&platformEmail===verifiedEmail.toLowerCase())owners.add(platformId);
 for(const owner of owners){if(owner===userId)continue;await db().batch([
  db().prepare('UPDATE projects SET owner = ? WHERE owner = ?').bind(userId,owner),
  db().prepare('UPDATE records SET creator = ? WHERE creator = ?').bind(userId,owner),
  db().prepare('UPDATE attachments SET creator = ? WHERE creator = ?').bind(userId,owner),
  db().prepare('UPDATE project_documents SET creator = ? WHERE creator = ?').bind(userId,owner),
  db().prepare('INSERT OR IGNORE INTO photo_likes(project_id,photo_id,user_id,created) SELECT project_id,photo_id,?,created FROM photo_likes WHERE user_id=?').bind(userId,owner),
  db().prepare('DELETE FROM photo_likes WHERE user_id=?').bind(owner),
  db().prepare('DELETE FROM guest_sessions WHERE owner_id = ?').bind(owner),
 ]);}
}

export function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status})}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})}
export function error(e:unknown){console.error(e instanceof Error?e.message:'Request failed');return json({error:e instanceof Error?e.message:'Something went wrong'},(e as {status?:number})?.status||500)}
export function origin(req:Request){const o=req.headers.get('origin');if(o&&o!==new URL(req.url).origin)fail('This request is not allowed.',403);if(req.headers.get('sec-fetch-site')==='cross-site'&&!o)fail('This request is not allowed.',403)}
export async function hash(t:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export type Access={project:any;role:'owner'|'editor'|'client';profession:Profession;sheets:string[];user:string;name:string;email:string;guest:boolean;shareId?:string;shareScope?:'sheets'|'project'};
export async function projectList(req:Request){
 const u=await identity(req);if(!u.id)return [];
 return (await db().prepare("SELECT DISTINCT p.id,p.name,p.created FROM projects p LEFT JOIN project_members m ON m.project_id=p.id WHERE p.owner=? OR m.user_id=? OR (m.user_id IS NULL AND m.email=? AND ?!='') ORDER BY p.created DESC").bind(u.id,u.id,u.email,u.email).all<any>()).results;
}
export async function access(req:Request,projectId?:string|null):Promise<Access>{
 const token=req.headers.get('x-review-token')||new URL(req.url).searchParams.get('review'),u=await identity(req);
 if(token){
  const s=await db().prepare('SELECT * FROM shares WHERE token_hash = ? AND revoked = 0').bind(await hash(token)).first<any>();
  if(!s)fail('This review link is no longer available.',403);
  if(projectId&&projectId!==s.project_id)fail('Project access denied.',403);
  const p=await db().prepare('SELECT * FROM projects WHERE id = ?').bind(s.project_id).first<any>();if(!p)fail('Project not found.',404);
  return {project:p,role:s.role,profession:profession(s.profession),sheets:JSON.parse(s.sheet_ids),user:u.id||s.id,name:u.guest?'Client':u.name,email:u.email,guest:u.guest,shareId:s.id,shareScope:s.scope==='project'?'project':'sheets'};
 }
 if(!u.id)fail('Open a guest workspace or sign in to continue.',401);
 const id=projectId||(await projectList(req))[0]?.id;if(!id)fail('No project found.',404);
 const p=await db().prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<any>();if(!p)fail('No project found.',404);
 if(p.owner===u.id)return {project:p,role:'owner',profession:profession(p.owner_profession),sheets:[],user:u.id,name:u.name,email:u.email,guest:u.guest};
 const m=await db().prepare("SELECT * FROM project_members WHERE project_id=? AND (user_id=? OR (user_id IS NULL AND email=? AND ?!=''))").bind(p.id,u.id,u.email,u.email).first<any>();
 if(!m)fail('Sign in with the email that was added to this project.',403);
 if(!m.user_id)await db().prepare('UPDATE project_members SET user_id=? WHERE id=? AND user_id IS NULL').bind(u.id,m.id).run();
 return {project:p,role:m.access,profession:profession(m.profession),sheets:[],user:u.id,name:m.name||u.name,email:u.email,guest:u.guest};
}
export function allowedSheet(a:Access,id:string){return !a.shareId||a.shareScope==='project'||a.sheets.includes(id)}
export function visible(a:Access,r:any){
 if(!allowedSheet(a,r.type==='sheet'?r.id:r.sheetId))return false;
 // Roles classify work for filtering. They do not hide markups, tasks or discussion.
 if(r.type==='sheet'&&a.role!=='owner'&&r.audience?.length&&!r.audience.map(profession).includes(a.profession))return false;
 return true;
}
export async function getRecords(a:Access):Promise<RecordItem[]>{
 const {results}=await db().prepare('SELECT data,version,creator FROM records WHERE project_id = ? ORDER BY created ASC').bind(a.project.id).all<any>();
 const parsed=results.map((r:any)=>{const data=JSON.parse(r.data);return {...data,...('authorRole'in data?{authorRole:profession(data.authorRole)}:{}),...(Array.isArray(data.audience)?{audience:Array.from(new Set(data.audience.map(profession)))}:{}),version:r.version,creatorId:r.creator,...(data.type==='markup'?{editable:a.role!=='client'||r.creator===a.user}:{})}});
 const sheetIds=new Set(parsed.filter((r:any)=>r.type==='sheet'&&visible(a,r)).map((r:any)=>r.id));
 const records=parsed.filter((r:any)=>visible(a,r)&&(r.type==='sheet'||sheetIds.has(r.sheetId)));
 const taskIds=new Set(records.filter((r:any)=>r.type==='task').map((r:any)=>r.id));
 return records.filter((r:any)=>r.type!=='comment'||taskIds.has(r.taskId));
}
