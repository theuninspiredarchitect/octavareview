import {env} from 'cloudflare:workers';
import {createServerClient,parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';
import type {SupabaseClient,User} from '@supabase/supabase-js';
const clients=new WeakMap<Request,SupabaseClient>();
const cookies=new WeakMap<Request,Map<string,string>>();
const users=new WeakMap<Request,Promise<User|null>>();
export function authConfigured(){const e=env as unknown as Record<string,string>;return !!(e.SUPABASE_URL&&e.SUPABASE_PUBLISHABLE_KEY)}
export function authEmailReady(){return authConfigured()&&(env as unknown as Record<string,string>).SUPABASE_AUTH_EMAIL_READY==='true'}
export function authClient(req:Request){
 if(clients.has(req))return clients.get(req)!;
 const e=env as unknown as Record<string,string>;
 if(!authConfigured())throw Object.assign(new Error('Permanent accounts are not connected yet. You can continue using the demo.'),{status:503});
 const jar=new Map(parseCookieHeader(req.headers.get('cookie')||'').map(c=>[c.name,c.value||''])),outgoing=new Map<string,string>();cookies.set(req,outgoing);
 const secure=new URL(req.url).protocol==='https:';
 const client=createServerClient(e.SUPABASE_URL,e.SUPABASE_PUBLISHABLE_KEY,{
  cookieOptions:{httpOnly:true,path:'/',secure,sameSite:secure?'none':'lax',partitioned:secure},
  cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll(items){for(const c of items){jar.set(c.name,c.value);outgoing.set(c.name,serializeCookieHeader(c.name,c.value,{...c.options,httpOnly:true,path:'/',secure,sameSite:secure?'none':'lax',partitioned:secure}))}}},
 });clients.set(req,client);return client;
}
export async function authenticatedUser(req:Request):Promise<User|null>{
 if(!authConfigured())return null;
 if(!users.has(req))users.set(req,(async()=>{const {data,error}=await authClient(req).auth.getUser();if(error&&error.status&&error.status>=500)throw Object.assign(new Error('Sign-in is temporarily unavailable. Please try again.'),{status:503});return data.user||null})());
 return users.get(req)!;
}
export function withSession(handler:(req:Request)=>Promise<Response>){return async(req:Request)=>{
 const response=await handler(req),outgoing=cookies.get(req);if(!outgoing?.size)return response;
 const headers=new Headers(response.headers);outgoing.forEach(value=>headers.append('Set-Cookie',value));
 headers.set('Cache-Control','private, no-cache, no-store, must-revalidate, max-age=0');headers.set('Pragma','no-cache');headers.set('Expires','0');
 return new Response(response.body,{status:response.status,headers});
}}
