import {withSession} from '@/lib/supabase-server';
import {db,error,identity,json,hash,origin} from '@/lib/server';
async function handlePOST(req:Request){try{
 origin(req);
 const current=await identity(req);
 if(current.id)return json({guest:current.guest,name:current.name});
 const token=crypto.randomUUID()+crypto.randomUUID(),id='guest:'+crypto.randomUUID(),expires=Date.now()+30*24*60*60*1000;
 await db().prepare('INSERT INTO guest_sessions (token_hash,owner_id,expires) VALUES (?,?,?)').bind(await hash(token),id,expires).run();
 const secure=new URL(req.url).protocol==='https:';
 return Response.json({guest:true,name:'Guest'},{headers:{'Cache-Control':'no-store','Set-Cookie':'octava_guest='+token+'; Path=/; HttpOnly; Max-Age=2592000; '+(secure?'Secure; SameSite=None; Partitioned':'SameSite=Lax')}});
}catch(e){return error(e)}}

export const POST=withSession(handlePOST);
