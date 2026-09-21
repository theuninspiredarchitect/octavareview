import {z} from 'zod';
import {authClient,authConfigured,authEmailReady,withSession} from '@/lib/supabase-server';
import {accountAdminAllowed} from '@/lib/account-admin';
import {claimGuestWorkspace,error,identity,json,origin} from '@/lib/server';
export const GET=withSession(async(req)=>{try{const u=await identity(req);return json({configured:authConfigured(),emailReady:authEmailReady(),user:u.account?{id:u.id,email:u.email,name:u.name,profession:u.profession}:null})}catch(e){return error(e)}});
export const POST=withSession(async(req)=>{try{
 origin(req);const b:any=await req.json(),client=authClient(req),base=new URL(req.url).origin;
 if(['signup','reset'].includes(b.action)&&!authEmailReady())return json({error:'Account emails are still being configured. Existing accounts can sign in; review links work without an account.'},503);
 const email=()=>z.string().trim().email().max(254).parse(b.email).toLowerCase();
 const password=()=>z.string().min(8,'Use at least 8 characters.').max(128).parse(b.password);
 if(b.action==='activateAdmin'){
  const nextPassword=password(),tokenHash=z.string().regex(/^[A-Za-z0-9_-]{32,256}$/).parse(b.token);
  // The private, single-use Supabase invitation proves ownership of the administrator email.
  const {data,error:verifyError}=await client.auth.verifyOtp({token_hash:tokenHash,type:'invite'});
  if(verifyError||!data.user?.email_confirmed_at||!data.user.email){await client.auth.signOut({scope:'local'});return json({error:'This setup link has expired or was already used. Ask for a new administrator setup link.'},410)}
  if(!accountAdminAllowed({email:data.user.email,guest:false})){await client.auth.signOut({scope:'local'});return json({error:'This setup link is not for the workspace administrator.'},403)}
  const {error:updateError}=await client.auth.updateUser({password:nextPassword});
  if(updateError){await client.auth.signOut({scope:'local'});return json({error:'The password could not be saved. '+updateError.message+' Request a new setup link.'},400)}
  await claimGuestWorkspace(req,'supabase:'+data.user.id,data.user.email);
  return json({ok:true});
 }
 if(b.action==='signin'){
  const {data,error:e}=await client.auth.signInWithPassword({email:email(),password:password()});if(e)throw Object.assign(new Error(e.message),{status:400});
  if(data.user)await claimGuestWorkspace(req,'supabase:'+data.user.id,data.user.email_confirmed_at?data.user.email||'':'');return json({ok:true});
 }
 if(b.action==='signup'){
  const {data,error:e}=await client.auth.signUp({email:email(),password:password(),options:{emailRedirectTo:base+'/auth/confirm',data:{full_name:z.string().trim().min(1).max(120).parse(b.name),profession:z.enum(['internal','owner','builder','other']).parse(b.profession)}}});
  if(e)throw Object.assign(new Error(e.message),{status:400});
  if(data.session&&data.user)await claimGuestWorkspace(req,'supabase:'+data.user.id,data.user.email_confirmed_at?data.user.email||'':'');
  return json({ok:true,confirmation:!data.session});
 }
 if(b.action==='reset'){
  const {error:e}=await client.auth.resetPasswordForEmail(email(),{redirectTo:base+'/auth/confirm?recovery=1'});if(e)throw Object.assign(new Error(e.message),{status:400});return json({ok:true});
 }
 if(b.action==='password'){
  const {data}=await client.auth.getUser();if(!data.user)return json({error:'Open the password reset link first.'},401);
  const {error:e}=await client.auth.updateUser({password:password()});if(e)throw Object.assign(new Error(e.message),{status:400});return json({ok:true});
 }
 if(b.action==='signout'){const {error:e}=await client.auth.signOut({scope:'local'});if(e)throw e;return json({ok:true})}
 return json({error:'Unknown account action.'},400);
}catch(e){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Check your account details.'},400);return error(e)}});
