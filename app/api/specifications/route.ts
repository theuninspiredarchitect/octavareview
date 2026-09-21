import {z} from 'zod';
import {withSession} from '@/lib/supabase-server';
import {access,db,error,fail,json,origin,type Access} from '@/lib/server';
import {projectAssets} from '@/lib/project-assets';
import {specificationSchema,selectedOffer,type Specification} from '@/lib/specifications';

function fullProject(a:Access){if(a.shareId&&a.shareScope!=='project')fail('Specifications require access to the whole project.',403)}
async function entries(a:Access):Promise<Specification[]>{return (await db().prepare('SELECT data,version,created,updated FROM specifications WHERE project_id=? ORDER BY created ASC').bind(a.project.id).all<any>()).results.map(r=>({...JSON.parse(r.data),version:r.version,created:r.created,updated:r.updated}))}
async function groups(a:Access){return (await db().prepare('SELECT id,name,version,created FROM specification_groups WHERE project_id=? ORDER BY name COLLATE NOCASE').bind(a.project.id).all()).results}
export const GET=withSession(async req=>{try{const a=await access(req,new URL(req.url).searchParams.get('project'));fullProject(a);return json({entries:await entries(a),groups:await groups(a),assets:await projectAssets(a),canEdit:a.role!=='client'&&!a.shareId})}catch(e){return error(e)}});
export const POST=withSession(async req=>{try{
 origin(req);const text=await req.text();if(text.length>1_000_000)fail('This specification is too large.',413);
 const body=JSON.parse(text),a=await access(req,z.string().parse(body.projectId));fullProject(a);if(a.role==='client'||a.shareId)fail('Project editors manage specifications and payments.',403);
 const now=new Date().toISOString();
 if(body.action==='group'){
  const b=z.object({id:z.string().max(100).optional(),name:z.string().trim().min(1).max(100),version:z.number().int().optional()}).parse(body);
  if(await db().prepare('SELECT id FROM specification_groups WHERE project_id=? AND name=? COLLATE NOCASE AND id!=?').bind(a.project.id,b.name,b.id||'').first())fail('A group with this name already exists.',409);
  const id=b.id||crypto.randomUUID();
  if(b.id){const r=await db().prepare('UPDATE specification_groups SET name=?,version=version+1 WHERE project_id=? AND id=? AND version=?').bind(b.name,a.project.id,id,b.version??0).run();if(!r.meta.changes)fail('This group changed. Refresh and try again.',409)}
  else await db().prepare('INSERT INTO specification_groups(id,project_id,name,version,created) VALUES(?,?,?,1,?)').bind(id,a.project.id,b.name,now).run();
  return json({id,groups:await groups(a)});
 }
 if(body.action==='removeGroup'){
  const b=z.object({id:z.string(),version:z.number().int()}).parse(body);
  const found=await db().prepare('SELECT id FROM specification_groups WHERE project_id=? AND id=? AND version=?').bind(a.project.id,b.id,b.version).first();if(!found)fail('This group changed. Refresh and try again.',409);
  const results=await db().batch([
   db().prepare("UPDATE specifications SET data=json_set(data,'$.groupId',NULL),version=version+1,updated=? WHERE project_id=? AND json_extract(data,'$.groupId')=? AND EXISTS(SELECT 1 FROM specification_groups WHERE project_id=? AND id=? AND version=?)").bind(now,a.project.id,b.id,a.project.id,b.id,b.version),
   db().prepare('DELETE FROM specification_groups WHERE project_id=? AND id=? AND version=?').bind(a.project.id,b.id,b.version),
  ]);if(!results[1].meta.changes)fail('This group changed. Refresh and try again.',409);return json({groups:await groups(a),entries:await entries(a)});
 }
 if(body.action!=='save')fail('Unknown specification action.');
 const entry=specificationSchema.parse(body.entry);
 const previous=await db().prepare('SELECT data,version,created FROM specifications WHERE project_id=? AND id=?').bind(a.project.id,entry.id).first<any>();
 if(previous?previous.version!==entry.version:entry.version!==0)fail('This entry changed on another device. Your draft is still open; reload the latest entry before saving.',409);
 if(entry.groupId&&!await db().prepare('SELECT id FROM specification_groups WHERE project_id=? AND id=?').bind(a.project.id,entry.groupId).first())fail('This group is no longer available. Choose another group.',409);
 const ids=[...entry.quotes.map(q=>q.id),...entry.quotes.flatMap(q=>q.revisions.map(r=>r.id)),...entry.payments.map(p=>p.id)];if(new Set(ids).size!==ids.length)fail('Quote and payment identifiers must be unique.');
 if((entry.selectedQuoteId||entry.selectedRevisionId)&&!selectedOffer(entry))fail('Choose an existing supplier quote and revision.');
 if(entry.stage!=='Quoting'&&!selectedOffer(entry)&&!entry.priceSourceId)fail('Select a quote before changing procurement progress.');
 if(entry.payments.some(p=>!entry.quotes.some(q=>q.id===p.quoteId)))fail('Each payment must belong to a supplier quote.');
 if(entry.priceSourceId){
  if(entry.priceSourceId===entry.id||entry.quotes.length||entry.payments.length)fail('A linked package cannot also have its own quotes or payments.');
  const source=await db().prepare('SELECT data FROM specifications WHERE project_id=? AND id=?').bind(a.project.id,entry.priceSourceId).first<any>();
  if(!source||!JSON.parse(source.data).quotes.length||JSON.parse(source.data).priceSourceId||JSON.parse(source.data).archived)fail('Choose an active package in this project.');
 }
 if(previous){const old:Specification=JSON.parse(previous.data);
  for(const q of old.quotes){const next=entry.quotes.find(n=>n.id===q.id);if(!next||q.currency!==next.currency||q.provider!==next.provider||q.revisions.some(r=>!next.revisions.some(n=>n.id===r.id&&JSON.stringify(n)===JSON.stringify(r))))fail('Quote history is preserved. Add a new supplier or quote revision.');}
  for(const p of old.payments){const next=entry.payments.find(n=>n.id===p.id);if(!next||JSON.stringify({...next,voided:false})!==JSON.stringify({...p,voided:false}))fail('Payment history is preserved. Void an incorrect payment and record a replacement.');}
  if(entry.archived&&!old.archived&&await db().prepare("SELECT id FROM specifications WHERE project_id=? AND json_extract(data,'$.priceSourceId')=? AND json_extract(data,'$.archived')=0 LIMIT 1").bind(a.project.id,entry.id).first())fail('Unlink the entries using this package before archiving it.');
 }
 const assets=new Map((await projectAssets(a)).map(f=>[f.id,f]));
 for(const photoId of [entry.photoId,entry.referenceId])if(photoId&&assets.get(photoId)?.kind!=='photo')fail('Choose a photo available in this project.',404);
 for(const fileId of [...entry.quotes.flatMap(q=>q.revisions.map(r=>r.fileId)),...entry.payments.map(p=>p.receiptId)])if(fileId&&!assets.has(fileId))fail('This attachment is not available in this project.',404);
 const data={...entry,created:previous?.created||now,updated:now,version:(previous?.version||0)+1};
 const result=previous?await db().prepare('UPDATE specifications SET data=?,version=version+1,updated=? WHERE project_id=? AND id=? AND version=?').bind(JSON.stringify(data),now,a.project.id,entry.id,entry.version).run():await db().prepare('INSERT OR IGNORE INTO specifications(id,project_id,data,creator,version,created,updated) VALUES(?,?,?,?,1,?,?)').bind(entry.id,a.project.id,JSON.stringify(data),a.user,now,now).run();
 if(!result.meta.changes)fail('This entry changed. Reload the latest entry before saving.',409);
 return json({entry:data},previous?200:201);
}catch(e){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Check the specification fields.'},400);if(e instanceof SyntaxError)return json({error:'Invalid specification request.'},400);return error(e)}});
