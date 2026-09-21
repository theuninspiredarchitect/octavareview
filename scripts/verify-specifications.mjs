import assert from 'node:assert/strict';
import {specTotals,parseSpecAmount,quotePaid} from '../lib/specifications.ts';
export async function verifySpecifications({mf,database,call,owner,png,singleBytes}){
 assert.equal(parseSpecAmount('1,250.50'),125050);assert.equal(parseSpecAmount('1.250,50'),125050);assert.equal(parseSpecAmount('1250,50'),125050);assert.throws(()=>parseSpecAmount('1,2,3'));
 const p=await call('/api/review',{action:'createProject',name:'Specifications QA',sample:true}),projectId=p.id,now=new Date().toISOString();
 const api=(body,headers=owner)=>call('/api/specifications',{projectId,...body},headers);
 const load=()=>call('/api/specifications?project='+projectId);
 const base=(name)=>({id:crypto.randomUUID(),name,description:'Bundled supplier scope',notes:'',groupId:null,photoId:null,referenceId:null,stage:'Quoting',purchasedBy:'Studio',quotes:[],selectedQuoteId:null,selectedRevisionId:null,payments:[],priceSourceId:null,archived:false,version:0,created:now,updated:now});
 const save=async entry=>{const r=await api({action:'save',entry});assert([200,201].includes(r.status),JSON.stringify(r));return r.entry};
 const quote=(provider,amount,currency='USD')=>({id:crypto.randomUUID(),provider,currency,revisions:[{id:crypto.randomUUID(),amount,created:now,date:'2026-09-21',leadTime:'6 weeks',scope:'Includes tax',fileId:null,url:''}]});
 async function upload(kind,name,bytes){const f=new FormData();f.append('kind',kind);f.append('file',new File([bytes],name));const r=new Request('https://review.test/api/documents',{method:'POST',body:f});const res=await mf.dispatchFetch('https://review.test/api/documents?project='+projectId,{method:'POST',headers:{...owner,'Content-Type':r.headers.get('Content-Type')},body:await r.arrayBuffer()});assert.equal(res.status,201);return (await res.json()).asset;}
 const photo=await upload('photo','render.png',png),pdf=await upload('file','quote.pdf',singleBytes);
 const group=await api({action:'group',name:'Lighting'});assert.equal(group.status,200);
 assert.equal((await api({action:'group',name:'lighting'})).status,409);
 let entry=await save({...base('Lighting package'),groupId:group.id,photoId:photo.id,referenceId:photo.id});
 const q1=quote('Supplier one',parseSpecAmount('1000.25')),q2=quote('Supplier two',125099);q1.revisions[0].fileId=pdf.id;
 entry=await save({...entry,quotes:[q1,q2],selectedQuoteId:q1.id,selectedRevisionId:q1.revisions[0].id,stage:'Selected'});
 const stale={...entry};entry=await save({...entry,notes:'Saved on device one'});
 assert.equal((await api({action:'save',entry:{...stale,notes:'Device two stale'}})).status,409);
 assert.equal((await load()).entries[0].notes,'Saved on device one');
 const payment={id:crypto.randomUUID(),quoteId:q1.id,amount:20025,date:'2026-09-21',payer:'Owner',note:'Deposit',receiptId:pdf.id,voided:false};
 entry=await save({...entry,payments:[payment,{...payment,id:crypto.randomUUID(),amount:10000,note:'Second payment'}]});
 assert.equal(quotePaid(entry),30025);assert.deepEqual(specTotals([entry]),[{currency:'USD',selected:100025,paid:30025,balance:70000,reference:0}]);
 assert.equal((await api({action:'save',entry:{...entry,payments:[]}})).status,400);
 assert.equal((await api({action:'save',entry:{...entry,payments:entry.payments.map(p=>({...p,amount:500}))}})).status,400);
 assert.equal((await api({action:'save',entry:{...entry,quotes:[{...q1,revisions:[{...q1.revisions[0],amount:99}]},q2]}})).status,400);
 const revision={...q1.revisions[0],id:crypto.randomUUID(),amount:90025};
 entry=await save({...entry,quotes:[{...q1,revisions:[q1.revisions[0],revision]},q2],selectedRevisionId:revision.id});
 entry=await save({...entry,payments:entry.payments.map((p,i)=>i?{...p,voided:true}:p)});assert.equal(quotePaid(entry),20025);
 const linked=await save({...base('Living room pendants'),priceSourceId:entry.id,groupId:group.id});
 const contractorQuote=quote('Contractor reference',70000),contractor=await save({...base('Contractor fixtures'),purchasedBy:'Contractor',quotes:[contractorQuote],selectedQuoteId:contractorQuote.id,selectedRevisionId:contractorQuote.revisions[0].id,stage:'Selected'});
 const eurQuote=quote('European supplier',12345,'EUR'),eur=await save({...base('Furniture'),quotes:[eurQuote],selectedQuoteId:eurQuote.id,selectedRevisionId:eurQuote.revisions[0].id,stage:'Selected'});
 assert.deepEqual(specTotals([entry,linked,contractor,eur]),[{currency:'USD',selected:90025,paid:20025,balance:70000,reference:70000},{currency:'EUR',selected:12345,paid:0,balance:12345,reference:0}]);
 assert.equal((await api({action:'save',entry:{...entry,archived:true}})).status,400);
 assert.equal((await api({action:'save',entry:{...base('Invalid attachment'),photoId:'foreign-photo'}})).status,404);
 const outsider={'oai-authenticated-user-id':'spec-outsider','oai-authenticated-user-email':'outsider@example.test'};
 assert.equal((await call('/api/specifications?project='+projectId,null,outsider)).status,403);
 const share=await call('/api/shares',{projectId,role:'client',label:'Review',scope:'project'}),viewer={'x-review-token':share.token};
 assert.equal((await call('/api/specifications?project='+projectId,null,viewer)).entries.length,4);
 assert.equal((await api({action:'save',entry},viewer)).status,403);
 const limited=await call('/api/shares',{projectId,role:'client',label:'One sheet',sheetIds:['sample-ground']});assert.equal((await call('/api/specifications?project='+projectId,null,{'x-review-token':limited.token})).status,403);
 // Full backup includes nested quotes, payments and all remapped file/group/package references.
 let backup=await call('/api/backups',{projectId,action:'create'});const backupId=backup.id;
 for(let n=0;backup.status!=='ready'&&n<10;n++)backup=await call('/api/backups',{projectId,action:'step',id:backupId});assert.equal(backup.status,'ready');
 async function restore(){let r=await call('/api/backups',{projectId,action:'restore',id:backupId});const id=r.id;for(let n=0;r.status!=='ready'&&n<10;n++)r=await call('/api/backups',{projectId,action:'restoreStep',id});assert.equal(r.status,'ready');return call('/api/specifications?project='+r.projectId);}
 const restored=await restore();assert.equal(restored.entries.length,4);const re=restored.entries.find(e=>e.name===entry.name),rl=restored.entries.find(e=>e.name===linked.name);
 assert.notEqual(re.id,entry.id);assert.equal(rl.priceSourceId,re.id);assert.equal(re.groupId,restored.groups[0].id);assert.notEqual(re.groupId,group.id);assert(restored.assets.some(a=>a.id===re.photoId));assert(restored.assets.some(a=>a.id===re.quotes[0].revisions[0].fileId));assert(restored.assets.some(a=>a.id===re.payments[0].receiptId));assert.deepEqual(specTotals(restored.entries),specTotals((await load()).entries));
 const bucket=await mf.getR2Bucket('BUCKET'),row=await database.prepare('SELECT manifest_key FROM backups WHERE id=?').bind(backupId).first(),manifest=await (await bucket.get(row.manifest_key)).json();
 assert(!('account_links' in manifest.tables));delete manifest.tables.specifications;delete manifest.tables.specification_groups;await bucket.put(row.manifest_key,JSON.stringify(manifest));
 const legacy=await restore();assert.deepEqual(legacy.entries,[]);assert.deepEqual(legacy.groups,[]);
 const renamed=await api({action:'group',id:group.id,version:1,name:'Electrical lighting'});assert.equal(renamed.status,200);
 assert.equal((await api({action:'removeGroup',id:group.id,version:1})).status,409);
 assert.equal((await api({action:'removeGroup',id:group.id,version:2})).status,200);const ungrouped=(await load()).entries;assert(ungrouped.every(e=>e.groupId===null));assert.equal(ungrouped.find(e=>e.id===entry.id).payments.length,2);
 console.log('PASS: specification groups, cross-device conflicts, immutable quote/payment history, revisions, payment voiding, separate currency totals, contractor scope, bundled quote single counting, permissions, attachments, full and legacy backup restore.');
}
