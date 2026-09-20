import {withSession} from '@/lib/supabase-server';
import {access,db,error,fail,json,origin,hash} from '@/lib/server';
import {z} from 'zod';
async function handleGET(req:Request){try{const a=await access(req,new URL(req.url).searchParams.get('project'));if(a.role!=='owner')fail('Only the owner can manage review links.',403);return json((await db().prepare('SELECT id,label,role,profession,scope,created FROM shares WHERE project_id = ? AND revoked = 0 ORDER BY created DESC').bind(a.project.id).all()).results)}catch(e){return error(e)}}
async function handlePOST(req:Request){try{
 origin(req);const b:any=await req.json(),a=await access(req,b.projectId);if(a.role!=='owner')fail('Only the owner can manage review links.',403);
 if(b.action==='revoke'){await db().prepare('UPDATE shares SET revoked = 1 WHERE id = ? AND project_id = ?').bind(b.id,a.project.id).run();return json({ok:true})}
 const role=z.enum(['client','editor']).parse(b.role),profession=z.enum(['internal','owner','builder','other']).parse(b.profession||(role==='editor'?'internal':'owner')),scope=z.enum(['sheets','project']).parse(b.scope||'sheets'),sheetIds=scope==='project'?[]:z.array(z.string()).min(1).max(500).parse(b.sheetIds);
 const existing=(await db().prepare("SELECT id FROM records WHERE project_id = ? AND type = 'sheet'").bind(a.project.id).all<any>()).results.map(r=>r.id);
 if(!sheetIds.every(id=>existing.includes(id)))fail('One of these drawings is no longer available.');
 // PDFs can contain multiple pages. Do not disclose excluded pages through a shared file.
 if(scope==='sheets'){
 const sheets=(await db().prepare("SELECT data FROM records WHERE project_id = ? AND type = 'sheet'").bind(a.project.id).all<any>()).results.map(r=>JSON.parse(r.data));
 const files=new Set(sheets.filter(r=>sheetIds.includes(r.id)).map(r=>r.fileId).filter(Boolean));
 for(const fileId of files){const f=await db().prepare('SELECT page_count FROM files WHERE id = ? AND project_id = ?').bind(fileId,a.project.id).first<any>();const included=new Set(sheets.filter(r=>r.fileId===fileId&&sheetIds.includes(r.id)).map(r=>r.page));if(!f||included.size!==f.page_count)fail('Every page of a PDF must finish importing and be included before it can be shared.');}
 if(sheets.some(r=>r.fileId&&files.has(r.fileId)&&!sheetIds.includes(r.id)))fail('Select every page from each PDF, or upload a separate PDF containing only the pages you want to share.');
 }
 const token=crypto.randomUUID()+crypto.randomUUID(),id=crypto.randomUUID(),created=new Date().toISOString(),label=z.string().trim().min(1).max(100).parse(b.label);
 await db().prepare('INSERT INTO shares (id,project_id,token_hash,role,sheet_ids,label,created,profession,scope,revoked) VALUES (?,?,?,?,?,?,?,?,?,0)').bind(id,a.project.id,await hash(token),role,JSON.stringify(sheetIds),label,created,profession,scope).run();
 return json({id,token,role,label,scope,created});
}catch(e){return error(e)}}

export const GET=withSession(handleGET);
export const POST=withSession(handlePOST);
