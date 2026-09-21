import {access,db,fail,type Access} from './server';
import {projectAssets} from './project-assets';
import {drawingTargetSchema,type DrawingTarget,type DrawingSnapshot,type DrawingPage} from './document-drawings';
import type {Meeting,MeetingEntry} from './meetings';
export const decodeDrawing=(r:any):DrawingPage=>({...JSON.parse(r.data),id:r.id,page:r.page,version:r.version,updated:r.updated});
export async function drawingAccess(req:Request,projectId:string|null,raw:unknown){
 const a=await access(req,projectId),target=drawingTargetSchema.parse(raw);
 if(target.source==='sketch'){
  if(a.shareId&&a.shareScope!=='project')fail('This sketch needs project access.',403);
  const row=await db().prepare('SELECT data FROM meetings WHERE project_id=? AND id=?').bind(a.project.id,target.meetingId||'').first<any>();
  const meeting:Meeting|null=row?JSON.parse(row.data):null;
  if(!meeting?.entries.some(e=>e.id===target.targetId&&e.drawing?.source==='sketch'&&e.drawing.targetId===target.targetId))fail('Meeting sketch not found.',404);
 }else{
  const file=(await projectAssets(a)).find(f=>f.id===target.targetId&&f.source===target.source);
  if(!file||file.mime!=='application/pdf')fail('PDF not found in this project.',404);
 }
 return {a,target,canEdit:true};
}
export const entryDrawing=(entry:MeetingEntry):DrawingTarget|null=>entry.drawing||(entry.presentationId?{source:'project',targetId:entry.presentationId}:null);
export async function snapshotMeetingDrawings(a:Access,meeting:Meeting):Promise<DrawingSnapshot[]>{
 const entries=meeting.entries.filter(e=>e.include&&entryDrawing(e));if(!entries.length)return [];
 const rows=await db().batch(entries.map(e=>{const t=entryDrawing(e)!;return db().prepare('SELECT data FROM document_drawings WHERE project_id=? AND source=? AND target_id=? AND page=?').bind(a.project.id,t.source,t.targetId,t.source==='sketch'?1:e.page)}));
 return entries.map((e,i)=>({entryId:e.id,target:entryDrawing(e)!,page:entryDrawing(e)!.source==='sketch'?1:e.page,data:rows[i].results[0]?JSON.parse((rows[i].results[0] as any).data):null}));
}
