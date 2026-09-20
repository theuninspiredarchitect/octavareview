import {z} from 'zod';
import {access,db,error,fail,getRecords,identity,json,origin,visible,allowedSheet} from '@/lib/server';
import {sampleRecords} from '@/lib/review-types';
import {validArea} from '@/lib/drawing-geometry';
const point=z.object({x:z.number().finite().min(-100000).max(100000),y:z.number().finite().min(-100000).max(100000)});
const base={id:z.string().min(1).max(100),created:z.string().max(60),version:z.number().int().optional()};
const vis=z.enum(['internal','client']);
const sheet=z.object({...base,type:z.literal('sheet'),code:z.string().max(100),name:z.string().min(1).max(200),revision:z.string().max(40),page:z.number().int().min(1).max(500),width:z.number().positive().max(30000),height:z.number().positive().max(30000),fileId:z.string().max(100).optional(),groupId:z.string().max(100),sample:z.enum(['ground','roof','site']).optional(),calibration:z.number().positive().max(100000).optional(),unit:z.enum(['m','ft']).optional()});
const mark=z.object({...base,type:z.literal('markup'),sheetId:z.string(),kind:z.enum(['pen','line','arrow','rect','ellipse','measure','area','text']),points:z.array(point).min(1).max(20000),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),width:z.number().min(0.5).max(30),precision:z.number().int().min(2).max(4).optional(),text:z.string().max(2000).optional(),visibility:vis,author:z.string().max(200)});
const task=z.object({...base,type:z.literal('task'),sheetId:z.string(),number:z.number(),title:z.string().min(1).max(200),description:z.string().max(10000),status:z.enum(['open','progress','done']),priority:z.enum(['low','medium','high']),assignee:z.string().max(120),due:z.string().max(20),source:z.enum(['Internal review','Client review','Site visit']),visibility:vis,position:point.nullable(),author:z.string().max(200)});
const comment=z.object({...base,type:z.literal('comment'),sheetId:z.string(),taskId:z.string(),text:z.string().min(1).max(10000),author:z.string().max(200),visibility:vis});
const recordSchema=z.discriminatedUnion('type',[sheet,mark,task,comment]);
export async function GET(req:Request){try{
 const a=await access(req,new URL(req.url).searchParams.get('project'));const records=await getRecords(a);
 const projects=a.role==='owner'?(await db().prepare('SELECT id,name,created FROM projects WHERE owner = ? ORDER BY created ASC').bind(a.user).all()).results:[];
 return json({project:{id:a.project.id,name:a.project.name,created:a.project.created},records,role:a.role,name:a.name,guest:a.guest,projects});
}catch(e){return error(e)}}
export async function POST(req:Request){try{
 origin(req);const b:any=await req.json();
 if(b.action==='createProject'){
  if(req.headers.get('x-review-token'))fail('Only the workspace owner can create projects.',403);
  const u=await identity(req);if(!u.id)fail('Your guest session could not be opened. Allow cookies and try again.',401);
  const name=z.string().trim().min(1).max(150).parse(b.name),id=crypto.randomUUID(),now=new Date().toISOString();
  const sample=b.sample===true?sampleRecords():[];
  await db().batch([db().prepare('INSERT INTO projects (id,owner,name,created,next_task) VALUES (?,?,?,?,?)').bind(id,u.id,name,now,sample.length?5:1),...sample.map(r=>db().prepare('INSERT INTO records (id,project_id,type,sheet_id,data,creator,version,created) VALUES (?,?,?,?,?,?,1,?)').bind(r.id,id,r.type,'sheetId'in r?r.sheetId:null,JSON.stringify(r),u.id,now))]);
  return json({id},201);
 }
 const a=await access(req,b.projectId);
 if(b.action==='renameProject'){if(a.role!=='owner')fail('Only the owner can rename this project.',403);const name=z.string().trim().min(1).max(150).parse(b.name);await db().prepare('UPDATE projects SET name = ? WHERE id = ?').bind(name,a.project.id).run();return json({ok:true})}
 if(b.action!=='save')fail('Unknown action.');
 let r=recordSchema.parse(b.record);
 if(r.type==='markup'){if(r.kind==='area'&&(r.points.length>200||(r.points.length!==2&&!validArea(r.points))))fail('An area needs a closed outline with no crossing edges.');if(r.kind!=='text'&&r.kind!=='pen'&&r.points.length<2)fail('Place both endpoints first.');}
 const old=await db().prepare('SELECT * FROM records WHERE project_id = ? AND id = ?').bind(a.project.id,r.id).first<any>();
 if(old&&old.type!==r.type)fail('Record type cannot change.');
 if(r.type==='sheet'){
  if(a.role==='client')fail('Clients cannot change drawing files or scale.',403);
  if(r.fileId){const f=await db().prepare('SELECT id FROM files WHERE id = ? AND project_id = ?').bind(r.fileId,a.project.id).first();if(!f)fail('Upload the drawing before saving it.')}
 }else{
  if(!allowedSheet(a,r.sheetId))fail('This drawing is not part of the review.',403);
  const s=await db().prepare("SELECT id FROM records WHERE project_id = ? AND id = ? AND type = 'sheet'").bind(a.project.id,r.sheetId).first();if(!s)fail('Drawing not found.',404);
  if(r.type==='comment'){const parent=await db().prepare("SELECT data FROM records WHERE project_id = ? AND id = ? AND type = 'task'").bind(a.project.id,r.taskId).first<any>();if(!parent||!visible(a,JSON.parse(parent.data))||JSON.parse(parent.data).sheetId!==r.sheetId)fail('Task not found.',404);r.visibility=JSON.parse(parent.data).visibility;}
 }
 if(a.role==='client'){
  if(old&&(r.type!=='markup'||old.creator!==a.user||!visible(a,JSON.parse(old.data))))fail('You can edit only your own markups in this review.',403);
  if(r.type==='sheet')fail('Not allowed.',403);
  r.visibility='client';
  if(r.type==='task'){r.status='open';r.source='Client review';r.assignee='Unassigned'}
 }
 if(old){
  if(b.record.version!==old.version)fail('Someone updated this item. Refresh before saving your changes.',409);
  const prior=JSON.parse(old.data);if('author'in r)r.author=prior.author;if(r.type==='task')r.number=prior.number;r.created=prior.created;
  const result=await db().prepare('UPDATE records SET data = ?, version = version + 1 WHERE project_id = ? AND id = ? AND version = ?').bind(JSON.stringify(r),a.project.id,r.id,old.version).run();
  if(!result.meta.changes)fail('This item has changed. Refresh and try again.',409);
  r.version=old.version+1;
 }else{
  r.created=new Date().toISOString();if('author'in r)r.author=a.name;
  if(r.type==='task'){const count=await db().prepare('UPDATE projects SET next_task = next_task + 1 WHERE id = ? RETURNING next_task').bind(a.project.id).first<any>();r.number=count.next_task-1}
  r.version=1;
  await db().prepare('INSERT INTO records (id,project_id,type,sheet_id,data,creator,version,created) VALUES (?,?,?,?,?,?,1,?)').bind(r.id,a.project.id,r.type,'sheetId'in r?r.sheetId:null,JSON.stringify(r),a.user,r.created).run();
 }
 return json({record:r.type==='markup'?{...r,editable:a.role!=='client'||!old||old.creator===a.user}:r});
}catch(e){if(e instanceof z.ZodError)return json({error:'Please check the fields and try again.'},400);return error(e)}}
export async function DELETE(req:Request){try{
 origin(req);const b:any=await req.json(),a=await access(req,b.projectId);
 if(Array.isArray(b.items)){
  const items=z.array(z.object({id:z.string().min(1).max(100),version:z.number().int().positive()})).min(1).max(80).parse(b.items);
  if(new Set(items.map(i=>i.id)).size!==items.length)fail('Duplicate items.');
  const {results}=await db().prepare('SELECT * FROM records WHERE project_id = ? AND id IN ('+items.map(()=>'?').join(',')+')').bind(a.project.id,...items.map(i=>i.id)).all<any>();
  const rows=new Map(results.map((r:any)=>[r.id,r]));
  for(const row of results){const r=JSON.parse(row.data);if(r.type!=='markup')fail('The eraser removes drawing markups only.');if(a.role==='client'&&(!visible(a,r)||row.creator!==a.user))fail('You can erase only your own markups.',403);}
  const eligible=items.filter(i=>rows.has(i.id)&&rows.get(i.id).version===i.version),deleted=items.filter(i=>!rows.has(i.id)).map(i=>i.id),conflicts=items.filter(i=>rows.has(i.id)&&rows.get(i.id).version!==i.version).map(i=>i.id);
  if(eligible.length){const result=await db().batch(eligible.map(i=>db().prepare('DELETE FROM records WHERE project_id = ? AND id = ? AND version = ?').bind(a.project.id,i.id,i.version)));result.forEach((r:any,i:number)=>(r.meta.changes?deleted:conflicts).push(eligible[i].id));}
  return json({deleted,conflicts});
 }
 const row=await db().prepare('SELECT * FROM records WHERE project_id = ? AND id = ?').bind(a.project.id,b.id).first<any>();
 if(!row)fail('Item not found.',404);const r=JSON.parse(row.data);
 if(a.role==='client'&&(!visible(a,r)||row.creator!==a.user||r.type==='sheet'))fail('You cannot delete this item.',403);
 if(row.type==='sheet')fail('Drawing history is preserved. Create a new revision instead.');
 const result=await db().prepare('DELETE FROM records WHERE project_id = ? AND id = ? AND version = ?').bind(a.project.id,b.id,b.version).run();
 if(!result.meta.changes)fail('This item has changed. Refresh and try again.',409);
 if(row.type==='task')await db().prepare("DELETE FROM records WHERE project_id = ? AND type = 'comment' AND json_extract(data,'$.taskId') = ?").bind(a.project.id,b.id).run();
 return json({ok:true});
}catch(e){return error(e)}}
