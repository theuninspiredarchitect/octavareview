import {z} from 'zod';
import {PDFDocument} from 'pdf-lib';
import {bucket,db,fail,getRecords,type Access} from './server';
import type {Sheet} from './review-types';
export const planImportSchema=z.object({name:z.string().trim().min(1).max(180),code:z.string().trim().min(1).max(80),revision:z.string().trim().min(1).max(40),revisionOf:z.string().max(100).optional(),folderId:z.string().max(100).optional(),pages:z.array(z.object({width:z.number().positive().max(30000),height:z.number().positive().max(30000)})).min(1).max(200)});
export async function finishPlan(a:Access,id:string,name:string,raw:unknown){
 const existing=await db().prepare('SELECT id FROM files WHERE project_id=? AND id=?').bind(a.project.id,id).first();
 if(existing)return {id,sheets:(await getRecords(a)).filter(r=>r.type==='sheet'&&r.fileId===id)};
 const meta=planImportSchema.parse(raw);
 if(meta.folderId&&!await db().prepare('SELECT id FROM plan_folders WHERE id=? AND project_id=?').bind(meta.folderId,a.project.id).first())fail('Folder not found.',404);
 const object=await bucket().get(a.project.id+'/'+id+'.pdf');if(!object)fail('Upload not found.',404);
 const bytes=await object.arrayBuffer();let document;try{document=await PDFDocument.load(bytes,{updateMetadata:false})}catch{fail('This PDF cannot be opened. Export an unencrypted copy.')}
 const count=document.getPageCount();if(count!==meta.pages.length||count>200)fail('The PDF page count does not match. Please import it again.');
 let previous:Sheet|undefined;if(meta.revisionOf){previous=(await getRecords(a)).find((r):r is Sheet=>r.type==='sheet'&&r.id===meta.revisionOf);if(!previous)fail('Original plan not found.',404);if(count!==1)fail('Upload a single page for a revision.')}
 const created=new Date().toISOString(),sheets:Sheet[]=meta.pages.map((size,i)=>{const sheetId=crypto.randomUUID();return {id:sheetId,type:'sheet',fileId:id,page:i+1,...size,code:count===1?meta.code:meta.code+'.'+String(i+1).padStart(2,'0'),name:count===1?meta.name:meta.name+' · Page '+(i+1),revision:meta.revision,groupId:previous?.groupId||sheetId,folderId:previous?.folderId||meta.folderId,audience:previous?.audience||[],created,version:1}});
 await db().batch([db().prepare('INSERT INTO files(id,project_id,name,page_count,created) VALUES(?,?,?,?,?)').bind(id,a.project.id,name,count,created),...sheets.map(s=>db().prepare('INSERT INTO records(id,project_id,type,sheet_id,data,creator,version,created) VALUES(?,?,?,?,?,?,1,?)').bind(s.id,a.project.id,'sheet',null,JSON.stringify(s),a.user,created))]);return {id,sheets};
}
