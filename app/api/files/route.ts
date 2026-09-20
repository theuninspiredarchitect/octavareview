import {withSession} from '@/lib/supabase-server';
import {PDFDocument} from 'pdf-lib';
import {access,bucket,db,error,fail,json,origin,getRecords} from '@/lib/server';
async function handlePOST(req:Request){try{
 origin(req);const a=await access(req,new URL(req.url).searchParams.get('project'));if(a.role==='client')fail('Only your team can upload drawings.',403);
 const length=Number(req.headers.get('content-length')||0);if(length>42*1024*1024)fail('Please use a PDF smaller than 40 MB.',413);
 const form=await req.formData();const file=form.get('file');if(!(file instanceof File)||file.size>40*1024*1024)fail('Choose a PDF smaller than 40 MB.');
 const bytes=await file.arrayBuffer();if(!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))fail('This file is not a valid PDF.');
 let document;try{document=await PDFDocument.load(bytes,{updateMetadata:false})}catch{fail('This PDF cannot be opened. Remove its password or export an unencrypted copy.')}
 const pageCount=document.getPageCount();if(pageCount>200)fail('Split PDFs with more than 200 pages into smaller files.');
 const id=crypto.randomUUID();await bucket().put(a.project.id+'/'+id+'.pdf',bytes,{httpMetadata:{contentType:'application/pdf'}});
 try{await db().prepare('INSERT INTO files (id,project_id,name,page_count,created) VALUES (?,?,?,?,?)').bind(id,a.project.id,file.name,pageCount,new Date().toISOString()).run()}catch(e){await bucket().delete(a.project.id+'/'+id+'.pdf');throw e}
 return json({id});
}catch(e){return error(e)}}
async function handleGET(req:Request){try{
 const url=new URL(req.url),a=await access(req,url.searchParams.get('project')),id=url.searchParams.get('id');
 const f=await db().prepare('SELECT * FROM files WHERE id = ? AND project_id = ?').bind(id,a.project.id).first<any>();if(!f)fail('Drawing not found.',404);
 if(a.role!=='owner'){const records=await getRecords(a),pages=new Set(records.filter((r:any)=>r.type==='sheet'&&r.fileId===id).map((r:any)=>r.page));if(pages.size!==f.page_count)fail('This complete PDF is not shared with your role.',403)}
 const object=await bucket().get(a.project.id+'/'+id+'.pdf');if(!object)fail('Drawing not found.',404);
 return new Response(object.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}catch(e){return error(e)}}

export const POST=withSession(handlePOST);
export const GET=withSession(handleGET);
