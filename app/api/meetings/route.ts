import {z} from 'zod';
import {withSession} from '@/lib/supabase-server';
import {access,db,error,fail,getRecords,json,origin,type Access} from '@/lib/server';
import {projectAssets} from '@/lib/project-assets';
import {meetingSchema,type Meeting,type MeetingReport} from '@/lib/meetings';
import {parseSpecAmount,specificationSchema} from '@/lib/specifications';
const fullProject=(a:Access)=>{if(a.shareId&&a.shareScope!=='project')fail('Meetings require access to the whole project.',403)};
const decode=(r:any):Meeting=>({...JSON.parse(r.data),version:r.version,created:r.created,updated:r.updated});
const conflict=()=>fail('This meeting changed on another device. Your draft has been kept. Reload the latest meeting before saving.',409);
async function validate(a:Access,m:Meeting){
 if(new Set(m.entries.map(e=>e.id)).size!==m.entries.length)fail('Meeting entries must be unique.');
 const assets=new Map((await projectAssets(a)).map(f=>[f.id,f]));
 const tasks=new Set((await getRecords(a)).filter(r=>r.type==='task').map(r=>r.id));
 const specs=new Set((await db().prepare('SELECT id FROM specifications WHERE project_id=?').bind(a.project.id).all<any>()).results.map(r=>r.id));
 for(const e of m.entries){
  if(e.photoIds.some(id=>assets.get(id)?.kind!=='photo'))fail('A photo is not available in this project.',404);
  if(e.presentationId&&assets.get(e.presentationId)?.kind!=='presentation')fail('Choose a presentation from this project.',404);
  if(e.taskId&&!tasks.has(e.taskId))fail('A linked task was removed. Unlink it before saving.',409);
  if(e.specificationId&&!specs.has(e.specificationId))fail('A linked specification is no longer available.',409);
 }
}
export const GET=withSession(async req=>{try{
 const a=await access(req,new URL(req.url).searchParams.get('project'));fullProject(a);
 const meetings=(await db().prepare('SELECT * FROM meetings WHERE project_id=? ORDER BY updated DESC').bind(a.project.id).all<any>()).results.map(decode);
 const reports=(await db().prepare('SELECT data,revision FROM meeting_reports WHERE project_id=? ORDER BY created DESC').bind(a.project.id).all<any>()).results.map(r=>({...JSON.parse(r.data),revision:r.revision}));
 return json({meetings,reports,assets:await projectAssets(a),canEdit:a.role!=='client'&&!a.shareId});
}catch(e){return error(e)}});
export const POST=withSession(async req=>{try{
 origin(req);const raw=await req.text();if(raw.length>1_000_000)fail('This meeting is too large.',413);
 const b=JSON.parse(raw),a=await access(req,z.string().parse(b.projectId));fullProject(a);
 if(a.role==='client'||a.shareId)fail('Project editors manage meeting notes and reports.',403);
 const now=new Date().toISOString();
 if(b.action==='save'){
  const m=meetingSchema.parse(b.meeting),old=await db().prepare('SELECT * FROM meetings WHERE project_id=? AND id=?').bind(a.project.id,m.id).first<any>();
  if(old?old.version!==m.version:m.version!==0)conflict();
  await validate(a,m);
  m.created=old?.created||now;m.updated=now;m.version=(old?.version||0)+1;
  m.photoGroupId=old?decode(old).photoGroupId:crypto.randomUUID();
  const commands=[old?db().prepare('UPDATE meetings SET data=?,version=version+1,updated=? WHERE project_id=? AND id=? AND version=?').bind(JSON.stringify(m),now,a.project.id,m.id,old.version):db().prepare('INSERT OR IGNORE INTO meetings(id,project_id,data,creator,version,created,updated) VALUES(?,?,?,?,1,?,?)').bind(m.id,a.project.id,JSON.stringify(m),a.user,now,now)];
  if(!old)commands.push(db().prepare('INSERT INTO photo_groups(id,project_id,name,created) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM meetings WHERE project_id=? AND id=?)').bind(m.photoGroupId,a.project.id,m.date+' · '+m.title.slice(0,65)+' · '+m.id.slice(0,4),now,a.project.id,m.id));
  const [r]=await db().batch(commands);if(!r.meta.changes)conflict();return json({meeting:m});
 }
 const id=z.string().min(1).max(100).parse(b.id),old=await db().prepare('SELECT * FROM meetings WHERE project_id=? AND id=?').bind(a.project.id,id).first<any>();
 if(!old)fail('Meeting not found.',404);const m=decode(old);
 if(b.action==='issue'){
  const reportId=z.string().uuid().parse(b.reportId);
  const existing=await db().prepare('SELECT data,revision FROM meeting_reports WHERE id=? AND project_id=? AND meeting_id=?').bind(reportId,a.project.id,id).first<any>();
  if(existing)return json({report:{...JSON.parse(existing.data),revision:existing.revision}});
  if(m.version!==b.version)conflict();await validate(a,m);
  const included=m.entries.filter(e=>e.include);if(!included.length)fail('Include at least one entry in the report.');
  const ids=new Set(included.map(e=>e.taskId));const tasks=(await getRecords(a)).filter((r):r is import('@/lib/review-types').Task=>r.type==='task'&&ids.has(r.id));
  const photoIds=new Set([...included.flatMap(e=>e.photoIds),...tasks.flatMap(t=>(t.photos||[]).map(p=>p.id)),...included.map(e=>e.presentationId)]);
  const report:MeetingReport={id:reportId,meetingId:m.id,revision:0,issued:now,issuedBy:a.name,projectName:a.project.name,meeting:{...m,entries:included},tasks,assets:(await projectAssets(a)).filter(f=>photoIds.has(f.id))};
  const r=await db().prepare('INSERT INTO meeting_reports(id,project_id,meeting_id,revision,data,created) SELECT ?,?,?,COALESCE((SELECT MAX(revision) FROM meeting_reports WHERE project_id=? AND meeting_id=?),0)+1,?,? WHERE EXISTS(SELECT 1 FROM meetings WHERE project_id=? AND id=? AND version=?) RETURNING revision').bind(reportId,a.project.id,id,a.project.id,id,JSON.stringify(report),now,a.project.id,id,m.version).first<any>();
  if(!r)conflict();return json({report:{...report,revision:r.revision}},201);
 }
 if(m.version!==b.version)conflict();
 const entry=m.entries.find(e=>e.id===b.entryId);if(!entry)fail('Meeting entry not found.',404);
 const commands=[];
 if(b.action==='task'){
  if(entry.taskId)return json({meeting:m});
  if(!entry.title.trim())fail('Add a title before creating the task.');
  const assets=new Map((await projectAssets(a)).map(f=>[f.id,f]));
  const number=await db().prepare('UPDATE projects SET next_task=next_task+1 WHERE id=? RETURNING next_task').bind(a.project.id).first<any>();
  const task={id:crypto.randomUUID(),type:'task',sheetId:null,number:number.next_task-1,title:entry.title,description:entry.text,location:entry.location,photos:entry.photoIds.map(id=>assets.get(id)).filter(Boolean),status:'open',priority:'medium',assignee:'Unassigned',due:'',source:m.kind==='site'?'Site visit':'Internal review',visibility:'internal',audience:[],position:null,author:a.name,authorRole:a.profession,created:now};
  entry.taskId=task.id;entry.kind='task';
  commands.push(db().prepare('INSERT INTO records(id,project_id,type,sheet_id,data,creator,version,created) SELECT ?,?,?,NULL,?,?,1,? WHERE EXISTS(SELECT 1 FROM meetings WHERE project_id=? AND id=? AND version=?)').bind(task.id,a.project.id,'task',JSON.stringify(task),a.user,now,a.project.id,m.id,m.version));
 }else if(b.action==='specification'){
  if(entry.specificationId)return json({meeting:m});
  if(!entry.title.trim())fail('Add a product name first.');
  const quoteId=crypto.randomUUID(),revisionId=crypto.randomUUID();
  const quotes=entry.price.trim()?[{id:quoteId,provider:entry.vendor.trim()||'Supplier to confirm',currency:entry.currency,revisions:[{id:revisionId,amount:parseSpecAmount(entry.price),created:now,date:m.date,leadTime:'',scope:entry.text,fileId:null,url:''}]}]:[];
  const selected=entry.selectionStatus==='Selected'&&quotes.length>0;
  const spec=specificationSchema.parse({id:crypto.randomUUID(),name:entry.title,description:[entry.text,entry.location&&'Location: '+entry.location,entry.model&&'Model: '+entry.model,entry.color&&'Color: '+entry.color,entry.finish&&'Finish: '+entry.finish,entry.size&&'Size: '+entry.size,entry.quantity&&'Quantity: '+entry.quantity].filter(Boolean).join('\n'),notes:'From '+m.title+' · '+m.date+'\nDesign selection: '+entry.selectionStatus+(entry.vendor?'\nSupplier: '+entry.vendor:''),groupId:null,photoId:entry.photoIds[0]||null,referenceId:null,stage:selected?'Selected':'Quoting',purchasedBy:'Reference only',quotes,selectedQuoteId:selected?quoteId:null,selectedRevisionId:selected?revisionId:null,payments:[],priceSourceId:null,archived:false,version:1,created:now,updated:now});
  entry.specificationId=spec.id;
  commands.push(db().prepare('INSERT INTO specifications(id,project_id,data,creator,version,created,updated) SELECT ?,?,?,?,1,?,? WHERE EXISTS(SELECT 1 FROM meetings WHERE project_id=? AND id=? AND version=?)').bind(spec.id,a.project.id,JSON.stringify(spec),a.user,now,now,a.project.id,m.id,m.version));
 }else fail('Unknown meeting action.');
 const version=m.version;m.version++;m.updated=now;
 commands.push(db().prepare('UPDATE meetings SET data=?,version=version+1,updated=? WHERE project_id=? AND id=? AND version=?').bind(JSON.stringify(m),now,a.project.id,id,version));
 const result=await db().batch(commands);if(!result.at(-1)?.meta.changes)conflict();return json({meeting:m});
}catch(e){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Check the meeting fields.'},400);if(e instanceof SyntaxError)return json({error:'Invalid meeting request.'},400);return error(e)}});
