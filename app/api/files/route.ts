import {withSession} from '@/lib/supabase-server';
import {z} from 'zod';
import type {Sheet} from '@/lib/review-types';
import {PDFDocument} from 'pdf-lib';
import {access,bucket,db,error,fail,json,origin,getRecords} from '@/lib/server';
async function handlePOST(req:Request){try{
 origin(req);const a=await access(req,new URL(req.url).searchParams.get('project'));if(a.role==='client')fail('Only your team can upload drawings.',403);
 const length=Number(req.headers.get('content-length')||0);if(length>42*1024*1024)fail('Please use a PDF smaller than 40 MB.',413);
 const form=await req.formData();const file=form.get('file');if(!(file instanceof File)||file.size>40*1024*1024)fail('Choose a PDF smaller than 40 MB.');
 const bytes=await file.arrayBuffer();if(!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))fail('This file is not a valid PDF.');
 let document;try{document=await PDFDocument.load(bytes,{updateMetadata:false})}catch{fail('This PDF cannot be opened. Remove its password or export an unencrypted copy.')}
 const pageCount=document.getPageCount();if(pageCount>200)fail('Split PDFs with more than 200 pages into smaller files.');
 const raw=form.get('import');
 const meta=typeof raw==='string'?z.object({name:z.string().trim().min(1).max(180),code:z.string().trim().min(1).max(80),revision:z.string().trim().min(1).max(40),revisionOf:z.string().max(100).optional(),folderId:z.string().max(100).optional(),pages:z.array(z.object({width:z.number().positive().max(30000),height:z.number().positive().max(30000)})).min(1).max(200)}).parse(JSON.parse(raw)):null;
 let previous:Sheet|undefined;
 if(meta){
  if(meta.folderId&&!await db().prepare('SELECT id FROM plan_folders WHERE id=? AND project_id=?').bind(meta.folderId,a.project.id).first())fail('Folder not found.',404);
  if(meta.pages.length!==pageCount)fail('The number of pages does not match this PDF.');
  if(meta.revisionOf){previous=(await getRecords(a)).find((r):r is Sheet=>r.type==='sheet'&&r.id===meta.revisionOf);if(!previous)fail('Original plan not found.',404);if(pageCount!==1)fail('Upload a single-page PDF for a revision.')}
 }
 const id=crypto.randomUUID(),created=new Date().toISOString();
 const sheets:Sheet[]=meta?meta.pages.map((size,index)=>{const sheetId=crypto.randomUUID();return {id:sheetId,type:'sheet',fileId:id,page:index+1,...size,code:pageCount===1?meta.code:meta.code+'.'+String(index+1).padStart(2,'0'),name:pageCount===1?meta.name:meta.name+' · Page '+(index+1),revision:meta.revision,groupId:previous?.groupId||sheetId,folderId:previous?.folderId||meta.folderId||undefined,audience:previous?.audience||[],created,version:1}}):[];
 await bucket().put(a.project.id+'/'+id+'.pdf',bytes,{httpMetadata:{contentType:'application/pdf'}});
 try{await db().batch([
  db().prepare('INSERT INTO files (id,project_id,name,page_count,created) VALUES (?,?,?,?,?)').bind(id,a.project.id,file.name,pageCount,created),
  ...sheets.map(sheet=>db().prepare('INSERT INTO records (id,project_id,type,sheet_id,data,creator,version,created) VALUES (?,?,?,?,?,?,1,?)').bind(sheet.id,a.project.id,'sheet',null,JSON.stringify(sheet),a.user,created)),
 ])}catch(e){await bucket().delete(a.project.id+'/'+id+'.pdf');throw e}
 return json({id,sheets});
}catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'Check the drawing name, number and PDF pages.'},400);return error(e)}}
async function handleGET(req:Request){try{
 const url=new URL(req.url),a=await access(req,url.searchParams.get('project')),id=url.searchParams.get('id');
 const f=await db().prepare('SELECT * FROM files WHERE id = ? AND project_id = ?').bind(id,a.project.id).first<any>();if(!f)fail('Drawing not found.',404);
 if(a.role!=='owner'){const records=await getRecords(a),pages=new Set(records.filter((r:any)=>r.type==='sheet'&&r.fileId===id).map((r:any)=>r.page));if(pages.size!==f.page_count)fail('This complete PDF is not shared with your role.',403)}
 const object=await bucket().get(a.project.id+'/'+id+'.pdf');if(!object)fail('Drawing not found.',404);
 return new Response(object.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}catch(e){return error(e)}}

export const POST=withSession(handlePOST);
export const GET=withSession(handleGET);
