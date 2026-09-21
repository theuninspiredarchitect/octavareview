import {z} from 'zod';
import {withSession} from '@/lib/supabase-server';
import {db,json,error,origin,fail,access} from '@/lib/server';
import {drawingAccess,decodeDrawing,snapshotMeetingDrawings} from '@/lib/document-drawings-server';
import {drawingDataSchema,drawingMarkSchema} from '@/lib/document-drawings';
export const GET=withSession(async req=>{try{
 const q=new URL(req.url).searchParams;
 if(q.get('snapshot')){const a=await access(req,q.get('project'));if(a.shareId&&a.shareScope!=='project')fail('Project access is required.',403);const row=await db().prepare('SELECT data FROM meetings WHERE project_id=? AND id=?').bind(a.project.id,q.get('snapshot')).first<any>();if(!row)fail('Meeting not found.',404);return json({drawings:await snapshotMeetingDrawings(a,JSON.parse(row.data))});}
 const {a,target,canEdit}=await drawingAccess(req,q.get('project'),{source:q.get('source'),targetId:q.get('target'),meetingId:q.get('meeting')||undefined});
 const rows=await db().prepare('SELECT * FROM document_drawings WHERE project_id=? AND source=? AND target_id=? ORDER BY page').bind(a.project.id,target.source,target.targetId).all<any>();
 return json({pages:rows.results.map(decodeDrawing),canEdit,name:a.name,userId:a.user,role:a.role});
 }catch(e){if(e instanceof z.ZodError)return json({error:'Choose a PDF or meeting sketch.'},400);return error(e)}});
export const POST=withSession(async req=>{try{
 origin(req);const raw=await req.text();if(raw.length>1_600_000)fail('This drawing page is full.',413);
 const b=JSON.parse(raw),{a,target,canEdit}=await drawingAccess(req,z.string().parse(b.projectId),b.target);if(!canEdit)fail('Project editors can draw on this document.',403);
 const page=z.number().int().min(1).max(2000).parse(b.page),version=z.number().int().nonnegative().parse(b.version),data=drawingDataSchema.parse(b.data);
 if(target.source==='sketch'&&page!==1)fail('A sketch has one page.');
 const now=new Date().toISOString(),key=[a.project.id,target.source,target.targetId,page];
 const old=await db().prepare('SELECT * FROM document_drawings WHERE project_id=? AND source=? AND target_id=? AND page=?').bind(...key).first<any>();
 const conflict=()=>fail('This page changed on another device. Your drawing is kept. Reload the saved page or download your copy.',409);
 // Identical retries after a lost response are safe, including a retried erase.
 const previous=old?JSON.parse(old.data):null,prior=new Map<string,any>((previous?.marks||[]).map((m:any)=>[m.id,m]));
 data.marks=data.marks.map(m=>{const p=prior.get(m.id);return {...m,author:p?.author||a.name,created:p?.created||m.created||now,creatorId:p?.creatorId||a.user,authorRole:p?.authorRole||a.profession};});
 if(a.role==='client'&&previous){if(data.width!==previous.width||data.height!==previous.height)fail('The PDF page size cannot be changed.',403);for(const p of previous.marks){if(p.creatorId!==a.user){const next=data.marks.find(m=>m.id===p.id);if(!next||JSON.stringify(drawingMarkSchema.parse(next))!==JSON.stringify(drawingMarkSchema.parse(p)))fail('You can change or erase only your own marks.',403);}}}
 const encoded=JSON.stringify(drawingDataSchema.parse(data));if(old&&old.version===version+1&&JSON.stringify(drawingDataSchema.parse(JSON.parse(old.data)))===encoded)return json({page:decodeDrawing(old)});
 if(old?old.version!==version:version!==0)conflict();
 const result=old?await db().prepare('UPDATE document_drawings SET data=?,version=version+1,updated=? WHERE project_id=? AND source=? AND target_id=? AND page=? AND version=? RETURNING *').bind(encoded,now,...key,version).first<any>():await db().prepare('INSERT OR IGNORE INTO document_drawings(id,project_id,source,target_id,meeting_id,page,data,creator,version,created,updated) VALUES(?,?,?,?,?,?,?,?,1,?,?) RETURNING *').bind(crypto.randomUUID(),...key.slice(0,3),target.meetingId||null,page,encoded,a.user,now,now).first<any>();
 if(!result)conflict();return json({page:decodeDrawing(result)});
 }catch(e){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Check the drawing.'},400);if(e instanceof SyntaxError)return json({error:'Invalid drawing.'},400);return error(e)}});
