import {env} from 'cloudflare:workers';
import {createClient} from '@supabase/supabase-js';
import {authConfigured} from './supabase-server';
import {fail,type Access} from './server';

// Separate from project ownership: a public demo project must never grant Auth administration.
export function accountAdminAllowed(user:{email:string;guest:boolean;shareId?:string}){
 const emails=((env as unknown as Record<string,string>).ACCOUNT_ADMIN_EMAILS||'').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);
 return !user.guest&&!user.shareId&&!!user.email&&emails.includes(user.email.toLowerCase());
}
export function accountLinksConfigured(){return authConfigured()&&!!(env as unknown as Record<string,string>).SUPABASE_SECRET_KEY}
export function accountAdmin(a:Access){
 if(a.role!=='owner'||!accountAdminAllowed(a))fail('Only an account administrator can create account links.',403);
 if(!accountLinksConfigured())fail('Account links need the server account connection to be activated.',503);
 const e=env as unknown as Record<string,string>;
 return createClient(e.SUPABASE_URL,e.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
