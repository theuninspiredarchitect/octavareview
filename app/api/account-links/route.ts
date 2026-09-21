import {z} from 'zod';
import {authClient,withSession} from '@/lib/supabase-server';
import {accountAdmin} from '@/lib/account-admin';
import {access,claimGuestWorkspace,db,error,fail,hash,json,origin} from '@/lib/server';

const tokenSchema=z.string().regex(/^[a-f0-9]{64}$/);
const passwordSchema=z.string().min(8,'Use at least 8 characters.').max(128);
async function pending(token:string){
 const row=await db().prepare(`SELECT l.*,m.name,p.name AS project_name FROM account_links l
 JOIN project_members m ON m.id=l.member_id AND m.project_id=l.project_id AND m.email=l.email
 JOIN projects p ON p.id=l.project_id
 WHERE l.token_hash=? AND l.used=0 AND l.expires>?`).bind(await hash(token),Date.now()).first<any>();
 if(!row)fail('This link has expired, was already used, or was revoked. Ask your administrator for a new link.',410);
 return row;
}
export const POST=withSession(async req=>{try{
 origin(req);const text=await req.text();if(text.length>5000)fail('Request is too large.',413);const b=JSON.parse(text);
 if(b.action==='inspect'||b.action==='complete'){
  const row=await pending(tokenSchema.parse(b.token));
  if(b.action==='inspect')return json({name:row.name,email:row.email,projectName:row.project_name,purpose:row.purpose,expires:row.expires});
  const password=passwordSchema.parse(b.password);
  // Only the explicit form submission consumes a link. Opening or previewing it is safe.
  const claimed=await db().prepare('UPDATE account_links SET used=1 WHERE token_hash=? AND used=0 AND expires>? AND EXISTS(SELECT 1 FROM project_members m WHERE m.id=account_links.member_id AND m.project_id=account_links.project_id AND m.email=account_links.email)').bind(row.token_hash,Date.now()).run();
  if(!claimed.meta.changes)fail('This link has already been used. Ask for a new one.',410);
  const client=authClient(req),{data,error:verifyError}=await client.auth.verifyOtp({token_hash:row.auth_hash,type:row.purpose==='invite'?'invite':'recovery'});
  if(verifyError||!data.user||data.user.email?.toLowerCase()!==row.email){await client.auth.signOut({scope:'local'});fail('This account link could not be completed. Ask your administrator for a new link.',410)}
  const {error:updateError}=await client.auth.updateUser({password});
  if(updateError){await client.auth.signOut({scope:'local'});fail('The password was not saved. '+updateError.message+' Ask your administrator for a new link.',400)}
  await claimGuestWorkspace(req,'supabase:'+data.user.id,row.email);
  await db().prepare('UPDATE project_members SET user_id=? WHERE id=? AND project_id=? AND email=?').bind('supabase:'+data.user.id,row.member_id,row.project_id,row.email).run();
  return json({ok:true,projectId:row.project_id});
 }
 const a=await access(req,z.string().parse(b.projectId)),admin=accountAdmin(a);
 const member=await db().prepare('SELECT id,email,name,profession FROM project_members WHERE project_id=? AND id=?').bind(a.project.id,z.string().parse(b.memberId)).first<any>();
 if(!member)fail('Person not found in this project.',404);
 if(b.action==='revoke'){await db().prepare('UPDATE account_links SET used=1 WHERE member_id=? AND project_id=?').bind(member.id,a.project.id).run();return json({ok:true})}
 if(b.action!=='generate')fail('Unknown account link action.');
 const purpose=z.enum(['invite','recovery']).parse(b.purpose),now=Date.now();
 const recent=await db().prepare('SELECT count(*) AS n FROM account_links WHERE creator=? AND created>?').bind(a.user,now-600000).first<any>();if(recent.n>=20)fail('Please wait a few minutes before creating more account links.',429);
 const {data,error:linkError}=await admin.auth.admin.generateLink(purpose==='invite'?{type:'invite',email:member.email,options:{data:{full_name:member.name,profession:member.profession}}}:{type:'recovery',email:member.email});
 if(linkError){if(purpose==='invite'&&['email_exists','user_already_exists'].includes(linkError.code||''))return json({existing:true,url:new URL(req.url).origin+'/?project='+encodeURIComponent(a.project.id)+'&account=signin',message:'This person already has an account. Send the sign-in link, or use Reset password.'});fail('Could not create the account link. '+linkError.message,400)}
 if(!data.properties?.hashed_token)fail('No account link was returned. Please try again.',502);
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),expires=now+30*60*1000;
 await db().batch([
  db().prepare('UPDATE account_links SET used=1 WHERE email=? AND used=0').bind(member.email),
  db().prepare('INSERT INTO account_links(token_hash,project_id,member_id,email,purpose,auth_hash,creator,created,expires,used) VALUES(?,?,?,?,?,?,?,?,?,0)').bind(await hash(token),a.project.id,member.id,member.email,purpose,data.properties.hashed_token,a.user,now,expires),
  db().prepare('DELETE FROM account_links WHERE expires<?').bind(now-86400000),
 ]);
 return json({url:new URL(req.url).origin+'/?account=setup#invite='+token,email:member.email,purpose,expires});
}catch(e){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Check the account details.'},400);if(e instanceof SyntaxError)return json({error:'Invalid account request.'},400);return error(e)}});
