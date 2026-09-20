import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
import assert from 'node:assert/strict';
const require=createRequire(root+'/package.json');
const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const {PDFDocument}=require('pdf-lib');
const mf=new Miniflare({modules:['index.js',...fs.readdirSync(root+'/dist/server',{recursive:true}).filter(f=>f.endsWith('.js')&&f!=='index.js')].map(path=>({type:'ESModule',path:root+'/dist/server/'+path})),modulesRoot:root+'/dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],log:undefined});
const owner={'oai-authenticated-user-id':'qa-owner','oai-authenticated-user-email':'qa@example.test'};
const now=new Date().toISOString();
async function call(path,body,headers=owner,method){
 const r=await mf.dispatchFetch('https://review.test'+path,{method:method||(body?'POST':'GET'),headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const json=await r.json();return {status:r.status,...json};
}
try{
 const database=await mf.getD1Database('DB');
 for(const f of fs.readdirSync(root+'/drizzle').filter(f=>f.endsWith('.sql')).sort()){
 for(const statement of fs.readFileSync(root+'/drizzle/'+f,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean)) await database.prepare(statement).run();
 }
 const unauthorized=await call('/api/review',null,{});assert.equal(unauthorized.status,401);
 const p=await call('/api/review',{action:'createProject',name:'QA plan review',sample:true});assert.equal(p.status,201);
 const loaded=await call('/api/review?project='+p.id);assert.equal(loaded.records.length,10);assert.equal(loaded.role,'owner');
 const guestSession=await mf.dispatchFetch('https://review.test/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(guestSession.status,200);assert.equal((await guestSession.json()).guest,true);
 const guestCookie=guestSession.headers.get('Set-Cookie');assert(guestCookie.includes('HttpOnly'));assert(guestCookie.includes('Secure'));assert(guestCookie.includes('Partitioned'));
 const guest={Cookie:guestCookie.split(';')[0]};
 const guestProject=await call('/api/review',{action:'createProject',name:'Guest review',sample:true},guest);assert.equal(guestProject.status,201);
 const guestLoaded=await call('/api/review?project='+guestProject.id,null,guest);assert.equal(guestLoaded.guest,true);assert.equal(guestLoaded.records.length,10);
 assert.equal((await call('/api/review?project='+p.id,null,guest)).status,403);
 const guestSession2=await mf.dispatchFetch('https://review.test/api/session',{method:'POST',body:'{}'});
 const guest2={Cookie:guestSession2.headers.get('Set-Cookie').split(';')[0]};
 assert.equal((await call('/api/review?project='+guestProject.id,null,guest2)).status,403);
 assert.equal((await call('/api/review?project='+guestProject.id,null,{Cookie:'octava_guest='+crypto.randomUUID()+crypto.randomUUID()})).status,401);
 const renewed=await mf.dispatchFetch('https://review.test/api/session',{method:'POST',headers:guest,body:'{}'});assert.equal(renewed.status,200);assert.equal(renewed.headers.get('Set-Cookie'),null);
 const guestMark={id:crypto.randomUUID(),type:'markup',sheetId:'sample-ground',kind:'pen',points:[{x:10,y:10},{x:100,y:200}],color:'#e4683d',width:12,visibility:'internal',author:'Guest',created:now};
 assert.equal((await call('/api/review',{action:'save',projectId:guestProject.id,record:guestMark},guest)).status,200);
 const guestLink=await call('/api/shares',{projectId:guestProject.id,role:'client',label:'Guest client review',sheetIds:['sample-ground']},guest);assert.equal(guestLink.status,200);
 const anonShared=await call('/api/review',null,{'x-review-token':guestLink.token});assert.equal(anonShared.status,200);assert.equal(anonShared.role,'client');assert(anonShared.records.every(r=>r.type==='sheet'||r.visibility==='client'));
 const task={id:crypto.randomUUID(),type:'task',sheetId:'sample-ground',number:0,title:'QA task',description:'Check clearance',status:'open',priority:'high',assignee:'Architecture',due:'',source:'Internal review',visibility:'internal',position:{x:20,y:30},author:'test',created:now};
 const created=await call('/api/review',{action:'save',projectId:p.id,record:task});assert.equal(created.record.number,5);
 const updated=await call('/api/review',{action:'save',projectId:p.id,record:{...created.record,status:'progress'}});assert.equal(updated.record.status,'progress');assert.equal(updated.record.version,2);
 const conflict=await call('/api/review',{action:'save',projectId:p.id,record:{...created.record,title:'stale'}});assert.equal(conflict.status,409);
 const cross=await call('/api/review?project='+p.id,null,{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.test'});assert.equal(cross.status,403);
 const link=await call('/api/shares',{projectId:p.id,role:'client',label:'QA client',sheetIds:['sample-ground']});assert.equal(link.status,200);
 const client={'x-review-token':link.token,'oai-authenticated-user-id':'qa-client','oai-authenticated-user-email':'client@example.test'};
 const shared=await call('/api/review',null,client);assert.equal(shared.role,'client');assert(shared.records.every(r=>r.type==='sheet'?r.id==='sample-ground':r.visibility==='client'));assert.equal(shared.records.filter(r=>r.type==='task').length,2);
 const clientTask=await call('/api/review',{action:'save',projectId:p.id,record:{...task,id:crypto.randomUUID(),visibility:'internal'}},client);assert.equal(clientTask.record.visibility,'client');assert.equal(clientTask.record.source,'Client review');
 const denied=await call('/api/review',{action:'save',projectId:p.id,record:updated.record},client);assert.equal(denied.status,403);
 const restricted=await call('/api/review',{action:'save',projectId:p.id,record:{...task,id:crypto.randomUUID(),sheetId:'sample-roof'}},client);assert.equal(restricted.status,403);
 const note=await call('/api/review',{action:'save',projectId:p.id,record:{id:crypto.randomUUID(),type:'comment',sheetId:'sample-ground',taskId:'sample-task-2',text:'Please revise seating',visibility:'client',author:'client',created:now}},client);assert.equal(note.status,200);
 const doc=await PDFDocument.create();doc.addPage([600,400]);doc.addPage([600,400]);const bytes=await doc.save();
 const form=new FormData();form.append('file',new File([bytes],'qa.pdf',{type:'application/pdf'}));
 const encoded=new Request('https://review.test/api/files',{method:'POST',body:form});const uploadRes=await mf.dispatchFetch('https://review.test/api/files?project='+p.id,{method:'POST',headers:{...owner,'Content-Type':encoded.headers.get('Content-Type')},body:await encoded.arrayBuffer()});const file=await uploadRes.json();assert.equal(uploadRes.status,200);
 const s={id:crypto.randomUUID(),type:'sheet',fileId:file.id,code:'QA.1',name:'QA drawing',revision:'R01',page:1,width:600,height:400,groupId:'qa-sheet',created:now};
 assert.equal((await call('/api/review',{action:'save',projectId:p.id,record:s})).status,200);
 const partial=await call('/api/shares',{projectId:p.id,role:'client',label:'Partial',sheetIds:[s.id]});assert.equal(partial.status,400);
 const s2={...s,id:crypto.randomUUID(),page:2,code:'QA.2',groupId:'qa-sheet2'};assert.equal((await call('/api/review',{action:'save',projectId:p.id,record:s2})).status,200);
 const fileLink=await call('/api/shares',{projectId:p.id,role:'client',label:'PDF review',sheetIds:[s.id,s2.id]});assert.equal(fileLink.status,200);
 const fileRes=await mf.dispatchFetch('https://review.test/api/files?project='+p.id+'&id='+file.id,{headers:{'x-review-token':fileLink.token}});assert.equal(fileRes.status,200);assert((await fileRes.arrayBuffer()).byteLength>100);
 const originalClientFile=await mf.dispatchFetch('https://review.test/api/files?project='+p.id+'&id='+file.id,{headers:client});assert.equal(originalClientFile.status,403);
 const mark={id:crypto.randomUUID(),type:'markup',sheetId:'sample-ground',kind:'pen',points:[{x:10,y:10},{x:100,y:200}],color:'#e4683d',width:3,visibility:'internal',author:'test',created:now};
 const m=await call('/api/review',{action:'save',projectId:p.id,record:mark});assert.equal(m.status,200);
 assert.equal((await call('/api/review',{projectId:p.id,id:m.record.id,version:1},owner,'DELETE')).status,200);
 await call('/api/shares',{action:'revoke',projectId:p.id,id:link.id});assert.equal((await call('/api/review',null,client)).status,403);
 const poly={...mark,id:crypto.randomUUID(),kind:'area',precision:4,points:[{x:0,y:0},{x:80,y:0},{x:80,y:20},{x:30,y:20},{x:30,y:70},{x:0,y:70}]};
 const polygon=await call('/api/review',{action:'save',projectId:p.id,record:poly});assert.equal(polygon.status,200);assert.equal(polygon.record.precision,4);assert.equal(polygon.record.points.length,6);
 const invalidPoly=await call('/api/review',{action:'save',projectId:p.id,record:{...poly,id:crypto.randomUUID(),points:[{x:0,y:0},{x:80,y:80},{x:0,y:80},{x:80,y:0}]}});assert.equal(invalidPoly.status,400);
 const second=await call('/api/review',{action:'save',projectId:p.id,record:{...mark,id:crypto.randomUUID()}});
 const staleErase=await call('/api/review',{projectId:p.id,items:[{id:polygon.record.id,version:7},{id:second.record.id,version:1}]},owner,'DELETE');assert.deepEqual(staleErase.conflicts,[polygon.record.id]);assert.deepEqual(staleErase.deleted,[second.record.id]);
 const newLink=await call('/api/shares',{projectId:p.id,role:'client',label:'Client tools',sheetIds:['sample-ground']});const anonClient={...guest2,'x-review-token':newLink.token};
 const ownMark=await call('/api/review',{action:'save',projectId:p.id,record:{...mark,id:crypto.randomUUID()}},anonClient);assert.equal(ownMark.record.editable,true);
 const ownEdit=await call('/api/review',{action:'save',projectId:p.id,record:{...ownMark.record,width:8}},anonClient);assert.equal(ownEdit.status,200);assert.equal(ownEdit.record.version,2);
 const otherClient={...guest,'x-review-token':newLink.token};assert.equal((await call('/api/review',{action:'save',projectId:p.id,record:ownEdit.record},otherClient)).status,403);
 assert.equal((await call('/api/review',{projectId:p.id,items:[{id:ownEdit.record.id,version:2}]},otherClient,'DELETE')).status,403);
 const clientView=await call('/api/review',null,otherClient);assert.equal(clientView.records.find(r=>r.id===ownMark.record.id).editable,false);
 const ownErase=await call('/api/review',{projectId:p.id,items:[{id:ownEdit.record.id,version:2}]},anonClient,'DELETE');assert.deepEqual(ownErase.deleted,[ownMark.record.id]);
 const erasedPoly=await call('/api/review',{projectId:p.id,items:[{id:polygon.record.id,version:1}]},owner,'DELETE');assert.deepEqual(erasedPoly.deleted,[polygon.record.id]);
 // Rectangle areas and explicit text size persist independently of stroke width.
 const rectangle=await call('/api/review',{action:'save',projectId:p.id,record:{...mark,id:crypto.randomUUID(),kind:'area',areaShape:'rectangle',points:[{x:20,y:30},{x:220,y:110}]}});assert.equal(rectangle.status,200);assert.equal(rectangle.record.points.length,2);
 const textNote=await call('/api/review',{action:'save',projectId:p.id,record:{...mark,id:crypto.randomUUID(),kind:'text',points:[{x:30,y:50}],text:'Inline note',textSize:48,width:1}});assert.equal(textNote.record.textSize,48);
 const projectOverview=await call('/api/projects');assert(projectOverview.projects.some(x=>x.id===p.id&&x.planCount===5));
 assert.equal((await call('/api/auth')).configured,false);
 assert.equal((await call('/api/auth',{action:'signin',email:'test@example.test',password:'example-test-only'})).status,503);
 // Membership is bound to a verified email and a project role, not an editable profile field.
 assert.equal((await call('/api/members',{projectId:p.id,email:'builder@example.test',name:'QA builder',profession:'builder',access:'editor'})).status,200);
 const builder={'oai-authenticated-user-id':'qa-builder','oai-authenticated-user-email':'builder@example.test'};
 const builderView=await call('/api/review?project='+p.id,null,builder);assert.equal(builderView.role,'editor');assert.equal(builderView.profession,'builder');
 const members=await call('/api/members?project='+p.id);const builderMember=members.members.find(m=>m.email==='builder@example.test');assert.equal(builderMember.joined,true);
 const restrictedMark=await call('/api/review',{action:'save',projectId:p.id,record:{...mark,id:crypto.randomUUID(),audience:['architect']}});
 assert(!(await call('/api/review?project='+p.id,null,builder)).records.some(r=>r.id===restrictedMark.record.id));
 assert.equal((await call('/api/review',{action:'save',projectId:p.id,record:restrictedMark.record},builder)).status,403);
 assert.equal((await call('/api/members',{projectId:p.id,email:'another@example.test',name:'No',profession:'architect',access:'editor'},builder)).status,403);
 const pdfSheet=(await call('/api/review?project='+p.id)).records.find(r=>r.id===s.id);
 assert.equal((await call('/api/review',{action:'setSheetAudience',projectId:p.id,id:s.id,version:pdfSheet.version,audience:['architect']})).status,200);
 const afterRestriction=await call('/api/review?project='+p.id);assert.deepEqual(afterRestriction.records.find(r=>r.id===s2.id).audience,['architect']);
 const builderAfter=await call('/api/review?project='+p.id,null,builder);assert(!builderAfter.records.some(r=>r.id===s.id||r.id===s2.id));
 assert.equal((await mf.dispatchFetch('https://review.test/api/files?project='+p.id+'&id='+file.id,{headers:builder})).status,403);
 // Every attachment inherits both the task and its message visibility.
 async function uploadAttachment(taskId,headers=owner,name='site-photo.png',data=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD5cAAAAASUVORK5CYII=','base64')){
  const form=new FormData();form.append('file',new File([data],name,{type:'image/png'}));const req=new Request('https://review.test/api/attachments',{method:'POST',body:form});const res=await mf.dispatchFetch('https://review.test/api/attachments?project='+p.id+'&task='+taskId,{method:'POST',headers:{...headers,'Content-Type':req.headers.get('Content-Type')},body:await req.arrayBuffer()});return {status:res.status,...await res.json()};
 }
 const photo=await uploadAttachment(created.record.id);assert.equal(photo.status,201);assert.equal(photo.attachment.mime,'image/png');
 const photoPath='/api/attachments?project='+p.id+'&id='+photo.attachment.id;
 assert.equal((await mf.dispatchFetch('https://review.test'+photoPath,{headers:owner})).status,403);
 const photoMessage=await call('/api/review',{action:'save',projectId:p.id,record:{id:crypto.randomUUID(),type:'comment',sheetId:'sample-ground',taskId:created.record.id,text:'',attachments:[{id:photo.attachment.id}],visibility:'internal',audience:['architect'],author:'test',created:now}});assert.equal(photoMessage.status,200);assert.equal(photoMessage.record.attachments[0].name,'site-photo.png');
 const imageResponse=await mf.dispatchFetch('https://review.test'+photoPath,{headers:owner});assert.equal(imageResponse.status,200);assert.equal(imageResponse.headers.get('Content-Type'),'image/png');
 assert.equal((await mf.dispatchFetch('https://review.test'+photoPath,{headers:builder})).status,403);
 assert.equal((await call('/api/review',{action:'save',projectId:p.id,record:{...photoMessage.record,id:crypto.randomUUID(),version:undefined,audience:[]}},builder)).status,403);
 const disguised=await uploadAttachment(created.record.id,owner,'unsafe.png',new TextEncoder().encode('<svg onload="alert(1)"></svg>'));assert.equal(disguised.attachment.mime,'application/octet-stream');
 assert.equal((await call('/api/review',{action:'save',projectId:p.id,record:{...photoMessage.record,id:crypto.randomUUID(),version:undefined,attachments:[{id:disguised.attachment.id}]}})).status,200);
 const safeFile=await mf.dispatchFetch('https://review.test/api/attachments?project='+p.id+'&id='+disguised.attachment.id,{headers:owner});assert(safeFile.headers.get('Content-Disposition').startsWith('attachment'));assert.equal(safeFile.headers.get('X-Content-Type-Options'),'nosniff');
 const clientPhoto=await uploadAttachment(clientTask.record.id,anonClient);assert.equal(clientPhoto.status,201);
 const clientPhotoMessage=await call('/api/review',{action:'save',projectId:p.id,record:{...photoMessage.record,id:crypto.randomUUID(),version:undefined,taskId:clientTask.record.id,attachments:[{id:clientPhoto.attachment.id}]}},anonClient);assert.equal(clientPhotoMessage.status,200);assert.deepEqual(clientPhotoMessage.record.audience,[]);assert.equal(clientPhotoMessage.record.visibility,'client');
 await call('/api/members',{action:'remove',projectId:p.id,id:builderMember.id});assert.equal((await call('/api/review?project='+p.id,null,builder)).status,403);
 console.log('PASS: rectangle areas, inline text sizes, project counts, membership binding/revocation, professional audiences, PDF page visibility, chat photos, attachment access and content-type isolation.');

 const html=await mf.dispatchFetch('https://review.test/',{headers:owner});assert.equal(html.status,200);assert((await html.text()).includes('octava'));
 console.log('PASS: irregular polygons and precision persistence, batch erasure/version conflicts, client edit/erase ownership, production Worker SSR, anonymous guest creation and persistence, guest/owner isolation, no-login client links, task/markup CRUD, conflict protection, client filtering and feedback, PDF upload/download, partial-PDF protection, link revocation.');
}finally{await mf.dispose()}
