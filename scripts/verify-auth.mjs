// Contract checks use an isolated Auth stub; no real accounts or emails are created.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(root+'/package.json');
const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const user={id:'00000000-0000-4000-8000-000000000123',aud:'authenticated',role:'authenticated',email:'qa-auth@example.test',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),user_metadata:{full_name:'QA account',profession:'owner'},app_metadata:{provider:'email'}};
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),role:'authenticated'})).toString('base64url')+'.test-signature';
let validationCalls=0,refreshCalls=0;
const mf=new Miniflare({modules:['index.js',...fs.readdirSync(root+'/dist/server',{recursive:true}).filter(f=>f.endsWith('.js')&&f!=='index.js')].map(file=>({type:'ESModule',path:root+'/dist/server/'+file})),modulesRoot:root+'/dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SUPABASE_URL:'https://auth-contract.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_contract_test'},outboundService:async(req)=>{
 const url=new URL(req.url);assert.equal(url.hostname,'auth-contract.supabase.co');
 if(url.pathname==='/auth/v1/token'){const body=await req.json();if(url.searchParams.get('grant_type')==='refresh_token'){assert.equal(body.refresh_token,'contract-refresh');refreshCalls++;}else assert.equal(body.email,user.email);return Response.json({access_token:token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'contract-refresh',user});}
 if(url.pathname==='/auth/v1/user'){validationCalls++;return req.headers.get('Authorization')==='Bearer '+token?Response.json(user):Response.json({message:'Invalid token',code:'bad_jwt'},{status:401});}
 if(url.pathname==='/auth/v1/logout')return new Response(null,{status:204});
 throw Error('Unexpected Auth request '+url.pathname);
}});
const jar=new Map();
async function call(route,body,headers={}){const res=await mf.dispatchFetch('https://review.test'+route,{method:body?'POST':'GET',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});for(const cookie of res.headers.getSetCookie()){const pair=cookie.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const data=await res.json();return {status:res.status,cookies:res.headers.getSetCookie(),...data};}
try{
 const db=await mf.getD1Database('DB');for(const file of fs.readdirSync(root+'/drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of fs.readFileSync(root+'/drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 assert.equal((await call('/api/auth')).configured,true);
 await call('/api/session',{});const oldGuest=jar.get('octava_guest');
 const p=await call('/api/review',{action:'createProject',name:'Guest to permanent account',sample:true});assert.equal(p.status,201);
 const signedIn=await call('/api/auth',{action:'signin',email:user.email,password:'contract-test-password'});assert.equal(signedIn.status,200);assert(signedIn.cookies.some(c=>c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=None')));
 const permanent=await call('/api/review?project='+p.id);assert.equal(permanent.userId,'supabase:'+user.id);assert.equal(permanent.guest,false);assert.equal(permanent.role,'owner');assert.equal(permanent.records.length,10);assert(validationCalls>0);
 const owner=await db.prepare('SELECT owner FROM projects WHERE id=?').bind(p.id).first();assert.equal(owner.owner,'supabase:'+user.id);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM guest_sessions').first()).n,0);
 const staleGuest=await mf.dispatchFetch('https://review.test/api/review?project='+p.id,{headers:{Cookie:'octava_guest='+oldGuest}});assert.equal(staleGuest.status,401);
 const sessionEntry=[...jar].find(([name,value])=>name.includes('auth-token')&&value.startsWith('base64-'));assert(sessionEntry);const savedSession=JSON.parse(Buffer.from(sessionEntry[1].slice(7),'base64url').toString());savedSession.expires_at=Math.floor(Date.now()/1000)-30;jar.set(sessionEntry[0],'base64-'+Buffer.from(JSON.stringify(savedSession)).toString('base64url'));const refreshed=await call('/api/auth');assert.equal(refreshed.user.id,'supabase:'+user.id);assert.equal(refreshCalls,1);assert(refreshed.cookies.some(c=>c.includes('HttpOnly')));
 const crossSite=await call('/api/auth',{action:'signout'},{Origin:'https://unrelated.test'});assert.equal(crossSite.status,403);
 assert.equal((await call('/api/auth',{action:'signout'})).status,200);assert.equal((await call('/api/auth')).user,null);
 console.log('PASS: server-validated Supabase session, HttpOnly cookies, guest project claim, retired guest capability, cross-origin protection, logout. Auth service is mocked; live email confirmation still requires configured Supabase.');
}finally{await mf.dispose();}
