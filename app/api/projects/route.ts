import {access,error,getRecords,json,projectList} from '@/lib/server';
import {withSession} from '@/lib/supabase-server';
export const GET=withSession(async(req)=>{try{
 const list=req.headers.get('x-review-token')?[(await access(req)).project]:await projectList(req),projects=[];
 for(const p of list){const a=await access(req,p.id),records=await getRecords(a),sheets=records.filter(r=>r.type==='sheet'),groups=new Set(sheets.map(s=>s.groupId));projects.push({id:p.id,name:p.name,created:p.created,role:a.role,planCount:groups.size,taskCount:records.filter(r=>r.type==='task'&&r.status!=='done').length,cover:sheets.at(-1)})}
 return json({projects});
}catch(e){return error(e)}});
