// Isolated Auth contract. No real invitation, account, password or email is changed.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(root+'/package.json');
const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
let generated=0,verified=0,passwordWrites=0;
const grants=new Map(),sessions=new Map();
const mf=new Miniflare({modules:['index.js',...fs.readdirSync(root+'/dist/server',{recursive:true}).filter(f=>f.endsWith('.js')&&f!=='index.js')].map(file=>({type:'ESModule',path:root+'/dist/server/'+file})),modulesRoot:root+'/dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SUPABASE_URL:'https://auth-contract.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_contract',SUPABASE_SECRET_KEY:'sb_secret_contract',ACCOUNT_ADMIN_EMAILS:'admin@example.test'},outboundService:async req=>{
 const url=new URL(req.url);assert.equal(url.hostname,'auth-contract.supabase.co');
 if(url.pathname==='/auth/v1/admin/generate_link'){
  assert.equal(req.headers.get('apikey'),'sb_secret_contract');const body=await req.json();generated++;const hashed_token=crypto.randomUUID();grants.set(hashed_token,body);
  return Response.json({id:crypto.randomUUID(),email:body.email,action_link:'https://auth-contract.supabase.co/auth/v1/verify',email_otp:'123456',hashed_token,verification_type:body.type,redirect_to:'https://review.test'});
 }
 if(url.pathname==='/auth/v1/verify'){
  const body=await req.json(),grant=grants.get(body.token_hash);assert(grant);assert.equal(body.type,grant.type);grants.delete(body.token_hash);verified++;
  const user={id:crypto.randomUUID(),aud:'authenticated',role:'authenticated',email:grant.email,email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),user_metadata:{full_name:'Invitee'},app_metadata:{provider:'email'}};
  const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.contract';sessions.set(token,user);
  return Response.json({access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'contract-refresh',user});
 }
 if(url.pathname==='/auth/v1/user'){
  const user=sessions.get(req.headers.get('authorization')?.replace('Bearer ',''));assert(user);
  if(req.method==='PUT'){const body=await req.json();assert.equal(body.password,'new-test-password');passwordWrites++;}return Response.json(user);
 }
 if(url.pathname==='/auth/v1/logout')return new Response(null,{status:204});
 throw Error('Unexpected Auth request '+url.pathname);
}});
const admin={'oai-authenticated-user-id':'account-admin','oai-authenticated-user-email':'admin@example.test'},outsider={'oai-authenticated-user-id':'other-owner','oai-authenticated-user-email':'other@example.test'};
async function call(route,body,headers=admin){const r=await mf.dispatchFetch('https://review.test'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,cookies:r.headers.getSetCookie(),...await r.json()};}
const tokenOf=r=>new URLSearchParams(new URL(r.url).hash.slice(1)).get('invite');
try{
 const db=await mf.getD1Database('DB');for(const file of fs.readdirSync(root+'/drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of fs.readFileSync(root+'/drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const p=await call('/api/review',{action:'createProject',name:'Account links QA',sample:true}),projectId=p.id;
 await call('/api/members',{projectId,name:'New client',email:'client@example.test',profession:'owner',access:'client'});
 const members=await call('/api/members?project='+projectId),memberId=members.members.find(m=>!m.owner).id;assert.equal(members.canManageAccounts,true);
 const generate=(purpose='invite')=>call('/api/account-links',{action:'generate',projectId,memberId,purpose});
 const first=await generate();assert.equal(first.status,200,JSON.stringify(first));assert.equal(verified,0);assert.equal(passwordWrites,0);assert(!first.url.includes('hashed_token'));
 const token=tokenOf(first),inspect=()=>call('/api/account-links',{action:'inspect',token},{});
 assert.equal((await inspect()).email,'client@example.test');assert.equal((await inspect()).status,200);assert.equal(verified,0);
 assert.equal((await call('/api/account-links',{action:'complete',token,password:'short'},{})).status,400);assert.equal((await inspect()).status,200);
 assert.equal((await call('/api/account-links',{action:'complete',token,password:'new-test-password'},{Origin:'https://unrelated.test'})).status,403);
 const completed=await call('/api/account-links',{action:'complete',token,password:'new-test-password'},{});assert.equal(completed.status,200,JSON.stringify(completed));assert.equal(completed.projectId,projectId);assert.equal(passwordWrites,1);assert.equal(verified,1);assert(completed.cookies.some(c=>c.includes('HttpOnly')&&c.includes('Secure')));
 const cookie=completed.cookies.map(c=>c.split(';')[0]).join('; '),opened=await call('/api/review?project='+projectId,null,{Cookie:cookie});assert.equal(opened.role,'client');assert.equal(opened.profession,'owner');
 assert.equal((await call('/api/account-links',{action:'complete',token,password:'new-test-password'},{})).status,410);
 assert.equal((await call('/api/account-links',{action:'generate',projectId,memberId,purpose:'recovery'},{Cookie:cookie})).status,403);
 assert.equal((await call('/api/account-links',{action:'generate',projectId,memberId,purpose:'recovery'},outsider)).status,403);
 const otherProject=await call('/api/review',{action:'createProject',name:'Other project',sample:true},outsider);await call('/api/members',{projectId:otherProject.id,name:'Target',email:'target@example.test',profession:'owner',access:'client'},outsider);
 const target=(await call('/api/members?project='+otherProject.id,null,outsider)).members.find(m=>!m.owner);assert.equal((await call('/api/account-links',{action:'generate',projectId:otherProject.id,memberId:target.id,purpose:'recovery'},outsider)).status,403);
 const recovery=await generate('recovery');assert.equal(recovery.status,200);assert.equal(passwordWrites,1);const revoked=tokenOf(recovery);await call('/api/account-links',{action:'revoke',projectId,memberId});assert.equal((await call('/api/account-links',{action:'inspect',token:revoked},{})).status,410);
 const expired=tokenOf(await generate('recovery'));await db.prepare('UPDATE account_links SET expires=0 WHERE used=0').run();assert.equal((await call('/api/account-links',{action:'complete',token:expired,password:'new-test-password'},{})).status,410);
 const older=tokenOf(await generate('recovery')),newer=tokenOf(await generate('recovery'));assert.equal((await call('/api/account-links',{action:'inspect',token:older},{})).status,410);
 const reset=await call('/api/account-links',{action:'complete',token:newer,password:'new-test-password'},{});assert.equal(reset.status,200);assert.equal(passwordWrites,2);
 const removed=tokenOf(await generate('recovery'));await call('/api/members',{projectId,id:memberId,action:'remove'});assert.equal((await call('/api/account-links',{action:'inspect',token:removed},{})).status,410);
 assert.equal(generated,6);console.log('PASS: trusted admin allowlist, project/member authorization, invite acceptance on a new device, recipient password choice, reset links, HttpOnly sessions, no email sending, explicit redemption, CSRF protection, expiry, replay rejection, regeneration, revocation and removed-member invalidation. Supabase service mocked.');
}finally{await mf.dispose()}
