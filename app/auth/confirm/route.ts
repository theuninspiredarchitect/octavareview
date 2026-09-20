import {authClient,withSession} from '@/lib/supabase-server';
import {claimGuestWorkspace} from '@/lib/server';
export const GET=withSession(async(req)=>{
 const url=new URL(req.url),code=url.searchParams.get('code');
 try{if(code){const {data,error}=await authClient(req).auth.exchangeCodeForSession(code);if(!error&&data.user){await claimGuestWorkspace(req,'supabase:'+data.user.id,data.user.email_confirmed_at?data.user.email||'':'');return Response.redirect(url.origin+'/?account='+(url.searchParams.has('recovery')?'recovery':'confirmed'),303)}}}catch{}
 return Response.redirect(url.origin+'/?account=expired',303);
});
