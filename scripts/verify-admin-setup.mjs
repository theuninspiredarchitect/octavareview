// Isolated first-administrator setup checks. No real account or email is changed.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(root+'/package.json');
const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const grants=new Map([['a'.repeat(64),'admin@example.test'],['b'.repeat(64),'other@example.test']]),sessions=new Map();
let verified=0,passwordWrites=0;
const mf=new Miniflare({modules:['index.js',...fs.readdirSync(root+'/dist/server',{recursive:true}).filter(f=>f.endsWith('.js')&&f!=='index.js')].map(file=>({type:'ESModule',path:root+'/dist/server/'+file})),modulesRoot:root+'/dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SUPABASE_URL:'https://auth-contract.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_contract',SUPABASE_SECRET_KEY:'sb_secret_contract',ACCOUNT_ADMIN_EMAILS:'admin@example.test'},outboundService:async req=>{
 const url=new URL(req.url);assert.equal(url.hostname,'auth-contract.supabase.co');
 if(url.pathname==='/auth/v1/verify'){
  const body=await req.json();assert.equal(body.type,'invite');verified++;const email=grants.get(body.token_hash);
  if(!email)return Response.json({msg:'Token has expired',error_code:'otp_expired'},{status:403});
  grants.delete(body.token_hash);
  const user={id:crypto.randomUUID(),aud:'authenticated',role:'authenticated',email,email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),user_metadata:{full_name:'Matt',profession:'internal'},app_metadata:{provider:'email'}};
  const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.contract';sessions.set(token,user);
  return Response.json({access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'contract-refresh',user});
 }
 const token=req.headers.get('authorization')?.replace('Bearer ','');
 if(url.pathname==='/auth/v1/user'){
  const user=sessions.get(token);assert(user);
  if(req.method==='PUT'){const body=await req.json();assert.equal(user.email,'admin@example.test');assert.equal(body.password,'new-admin-password');passwordWrites++;}
  return Response.json(user);
 }
 if(url.pathname==='/auth/v1/logout'){sessions.delete(token);return new Response(null,{status:204});}
 throw Error('Unexpected Auth request '+url.pathname);
}});
const jar=new Map();
async function call(route,body,headers={},keepSession=true){const response=await mf.dispatchFetch('https://review.test'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(keepSession?{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}:{}),...headers},body:body?JSON.stringify(body):undefined});if(keepSession)for(const c of response.headers.getSetCookie()){const [name,...value]=c.split(';')[0].split('=');if(value.join('='))jar.set(name,value.join('='));else jar.delete(name);}return {status:response.status,cookies:response.headers.getSetCookie(),...await response.json()};}
const activate=(token='a'.repeat(64),password='new-admin-password',headers={},keepSession=true)=>call('/api/auth',{action:'activateAdmin',token,password},headers,keepSession);
try{
 const db=await mf.getD1Database('DB');for(const file of fs.readdirSync(root+'/drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of fs.readFileSync(root+'/drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 await call('/api/session',{});const guest=jar.get('octava_guest');
 const project=await call('/api/review',{action:'createProject',name:'Existing guest work',sample:true});assert.equal(project.status,201);
 assert.equal((await activate('a'.repeat(64),'short')).status,400);assert.equal(verified,0);
 assert.equal((await activate('a'.repeat(64),'new-admin-password',{Origin:'https://unrelated.test'})).status,403);assert.equal(verified,0);
 assert.equal((await activate('b'.repeat(64),'new-admin-password',{},false)).status,403);assert.equal(passwordWrites,0);
 assert.equal((await activate('c'.repeat(64),'new-admin-password',{},false)).status,410);assert.equal(passwordWrites,0);
 const done=await activate();assert.equal(done.status,200,JSON.stringify(done));assert.equal(passwordWrites,1);assert(done.cookies.some(c=>c.includes('HttpOnly')&&c.includes('Secure')));
 const account=await call('/api/auth');assert.equal(account.user.email,'admin@example.test');
 const workspace=await call('/api/review?project='+project.id);assert.equal(workspace.role,'owner');assert.equal(workspace.guest,false);assert.equal(workspace.records.length,10);
 const people=await call('/api/members?project='+project.id);assert.equal(people.canManageAccounts,true);assert.equal(people.accountLinksReady,true);
 assert.equal((await call('/api/review?project='+project.id,null,{Cookie:'octava_guest='+guest},false)).status,401);
 assert.equal((await activate('a'.repeat(64),'new-admin-password',{},false)).status,410);assert.equal(passwordWrites,1);
 console.log('PASS: administrator allowlist, explicit password choice, guest project preservation, enabled invite controls, HttpOnly sessions, expired/used token rejection, non-admin rejection, password validation and CSRF protection. Supabase service mocked.');
}finally{await mf.dispose()}
