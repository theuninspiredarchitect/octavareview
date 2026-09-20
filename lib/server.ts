import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw new Error('Storage is unavailable. Please try again.');return env.DB;}
export function bucket(){if(!env.BUCKET)throw new Error('Document storage is unavailable.');return env.BUCKET;}
export async function identity(req:Request){
 let id=req.headers.get('oai-authenticated-user-id'),name=req.headers.get('oai-authenticated-user-email')||'Reviewer';
 const full=req.headers.get('oai-authenticated-user-full-name');
 if(full&&req.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(full)}catch{}}
 if(id)return {id,name,guest:false};
 const cookie=req.headers.get('cookie')||'';const token=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('octava_guest='))?.slice(13);
 if(token&&/^[a-f0-9-]{72}$/.test(token)){const session=await db().prepare('SELECT owner_id FROM guest_sessions WHERE token_hash = ? AND expires > ?').bind(await hash(token),Date.now()).first<any>();if(session)return {id:session.owner_id,name:'Guest',guest:true};}
 return {id:null,name:'Guest',guest:true};
}
export function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status})}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})}
export function error(e:unknown){console.error(e instanceof Error?e.message:'Request failed');return json({error:e instanceof Error?e.message:'Something went wrong'},(e as {status?:number})?.status||500)}
export function origin(req:Request){const o=req.headers.get('origin');if(o&&o!==new URL(req.url).origin)fail('This request is not allowed.',403);}
export async function hash(t:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export type Access={project:any;role:'owner'|'editor'|'client';sheets:string[];user:string;name:string;guest:boolean;shareId?:string};
export async function access(req:Request,projectId?:string|null):Promise<Access>{
 const token=req.headers.get('x-review-token')||new URL(req.url).searchParams.get('review');
 if(token){
  const s=await db().prepare('SELECT * FROM shares WHERE token_hash = ? AND revoked = 0').bind(await hash(token)).first<any>();
  if(!s)fail('This review link is no longer available.',403);
  if(projectId&&projectId!==s.project_id)fail('Project access denied.',403);
  const p=await db().prepare('SELECT * FROM projects WHERE id = ?').bind(s.project_id).first<any>();
  if(!p)fail('Project not found.',404);
  const u=await identity(req);
  return {project:p,role:s.role,sheets:JSON.parse(s.sheet_ids),user:u.id||s.id,name:u.guest?'Client':u.name,guest:u.guest,shareId:s.id};
 }
 const u=await identity(req);if(!u.id)fail('Your guest session could not be opened. Allow cookies and try again.',401);
 let p=projectId?await db().prepare('SELECT * FROM projects WHERE id = ? AND owner = ?').bind(projectId,u.id).first<any>():await db().prepare('SELECT * FROM projects WHERE owner = ? ORDER BY created ASC LIMIT 1').bind(u.id).first<any>();
 if(!p)fail('No project found.',404);
 return {project:p,role:'owner',sheets:[],user:u.id,name:u.name,guest:u.guest};
}
export function allowedSheet(a:Access,id:string){return a.role!=='client'||a.sheets.includes(id)}
export function visible(a:Access,r:any){return a.role!=='client'||(r.type==='sheet'?a.sheets.includes(r.id):a.sheets.includes(r.sheetId)&&r.visibility==='client')}
export async function getRecords(a:Access){
 const {results}=await db().prepare('SELECT data,version,creator FROM records WHERE project_id = ? ORDER BY created ASC').bind(a.project.id).all<any>();
 const records=results.map((r:any)=>({...JSON.parse(r.data),version:r.version,...(JSON.parse(r.data).type==='markup'?{editable:a.role!=='client'||r.creator===a.user}:{})})).filter((r:any)=>visible(a,r));
 const taskIds=new Set(records.filter((r:any)=>r.type==='task').map((r:any)=>r.id));
 return records.filter((r:any)=>r.type!=='comment'||taskIds.has(r.taskId));
}
