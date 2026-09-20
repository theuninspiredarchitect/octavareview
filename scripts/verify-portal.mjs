import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export async function verifyPortal({mf,database,call,owner,other,p,png,singleBytes,projectPhoto,photo,created}){
 const upload=async(category,name,data,metadata={},headers=owner)=>{
  const s=await call('/api/uploads',{action:'start',projectId:p.id,category,name,size:data.length,metadata},headers);assert.equal(s.status,200,JSON.stringify(s));
  assert.equal((await call('/api/uploads',{action:'complete',projectId:p.id,id:s.id},headers)).status,400);
  for(let offset=0,part=1;offset<data.length;offset+=s.chunkSize,part++){
   const r=await mf.dispatchFetch('https://review.test/api/uploads?project='+p.id+'&id='+s.id+'&part='+part,{method:'PUT',headers,body:data.slice(offset,offset+s.chunkSize)});assert.equal(r.status,200,await r.text());
  }
  const completed=await call('/api/uploads',{action:'complete',projectId:p.id,id:s.id},headers);assert.equal(completed.status,200,JSON.stringify(completed));assert.deepEqual(await call('/api/uploads',{action:'complete',projectId:p.id,id:s.id},headers),completed);return completed;
 };
 const group=(await call('/api/photo-groups',{projectId:p.id,action:'create',name:'Site visits'})).groups[0];assert(group);
 assert.equal((await call('/api/photo-groups',{projectId:p.id,action:'create',name:'site visits'})).status,400);
 assert.equal((await call('/api/photo-groups',{projectId:p.id,action:'move',photoIds:[projectPhoto.asset.id,photo.attachment.id],groupId:group.id})).status,200);
 assert.equal((await call('/api/photo-groups',{projectId:p.id,action:'create',name:'Denied'},other)).status,403);
 const deck=await upload('document','Design.pdf',singleBytes,{kind:'presentation'});assert.match(deck.asset.name,/^\d{4}-\d{2}-\d{2} QA plan review\.pdf$/);
 assert.equal((await call('/api/documents',{projectId:p.id,id:deck.asset.id,name:'Concept presentation'},owner,'PATCH')).name,'Concept presentation.pdf');
 assert.equal((await call('/api/documents',{projectId:p.id,id:deck.asset.id,name:'Denied'},other,'PATCH')).status,403);
 const large=new Uint8Array(41*1024*1024+123);large.set(new TextEncoder().encode('QA large document'));large[large.length-1]=98;
 const largeFile=await upload('document','large.dat',large,{kind:'file'});
 const download=await mf.dispatchFetch('https://review.test/api/documents?project='+p.id+'&id='+largeFile.asset.id,{headers:owner});assert.equal((await download.arrayBuffer()).byteLength,large.length);
 assert.equal((await call('/api/uploads',{action:'start',projectId:p.id,category:'document',name:'too-big.pdf',size:201*1024*1024,metadata:{kind:'file'}})).status,400);
 const imported=await upload('plan','chunked.pdf',singleBytes,{name:'Chunked plan',code:'C.01',revision:'R01',pages:[{width:700,height:450}]});assert.equal(imported.sheets.length,1);
 const attachment=await upload('attachment','new.png',png,{taskId:created.record.id});assert.equal(attachment.attachment.mime,'image/png');
 const thumbnail=await mf.dispatchFetch('https://review.test/api/thumbnails?project='+p.id+'&id='+projectPhoto.asset.id,{method:'POST',headers:owner,body:png});assert.equal(thumbnail.status,200);
 const thumbs=await mf.dispatchFetch('https://review.test/api/thumbnails?project='+p.id+'&id='+projectPhoto.asset.id,{headers:owner});assert.equal(thumbs.status,200);assert.deepEqual(new Uint8Array(await thumbs.arrayBuffer()),new Uint8Array(png));
 const share=await call('/api/shares',{projectId:p.id,role:'client',label:'Project portal',scope:'project'});assert.equal(share.status,200);
 const shared={'x-review-token':share.token};const all=(await call('/api/documents?project='+p.id,null,shared));assert(all.assets.some(f=>f.id===deck.asset.id));assert(all.assets.some(f=>f.groupId===group.id));assert.equal(all.canOrganize,false);
 const limited=await call('/api/shares',{projectId:p.id,role:'client',label:'One sheet',sheetIds:['sample-ground']});assert(!(await call('/api/documents?project='+p.id,null,{'x-review-token':limited.token})).assets.some(f=>f.id===deck.asset.id));
 assert.equal((await mf.dispatchFetch('https://review.test/api/thumbnails?project='+p.id+'&id='+projectPhoto.asset.id,{headers:{'x-review-token':limited.token}})).status,404);
 assert.equal((await call('/api/backups?project='+p.id,null,shared)).status,403);
 assert.equal((await call('/api/backups',{projectId:p.id,action:'create'},other)).status,403);
 const before=(await call('/api/review?project='+p.id)).records;let backup=await call('/api/backups',{projectId:p.id,action:'create'});assert.equal(backup.status,'copying');
 const backupId=backup.id;for(let n=0;backup.status!=='ready'&&n<100;n++){backup=await call('/api/backups',{projectId:p.id,action:'step',id:backupId});assert(!backup.error,JSON.stringify(backup))}assert.equal(backup.status,'ready');
 const objectStore=await mf.getR2Bucket('BUCKET'),backupRecord=await database.prepare('SELECT * FROM backups WHERE id=?').bind(backupId).first(),manifest=await (await objectStore.get(backupRecord.manifest_key)).json();
 for(const item of manifest.objects){const a=await objectStore.get(item.key),b=await objectStore.get(item.backupKey);assert.equal(createHash('sha256').update(new Uint8Array(await a.arrayBuffer())).digest('hex'),createHash('sha256').update(new Uint8Array(await b.arrayBuffer())).digest('hex'))}
 let restore=await call('/api/backups',{projectId:p.id,action:'restore',id:backupId});const restoreId=restore.id;
 for(let n=0;restore.status!=='ready'&&n<100;n++){restore=await call('/api/backups',{projectId:p.id,action:'restoreStep',id:restoreId});assert(!restore.error,JSON.stringify(restore))}assert.equal(restore.status,'ready');
 assert.notEqual(restore.projectId,p.id);const restored=await call('/api/review?project='+restore.projectId);assert.equal(restored.records.length,before.length);assert.equal(restored.records.filter(r=>r.type==='markup').length,before.filter(r=>r.type==='markup').length);assert.equal(restored.records.filter(r=>r.type==='comment').length,before.filter(r=>r.type==='comment').length);
 const tasks=new Set(restored.records.filter(r=>r.type==='task').map(r=>r.id));assert(restored.records.filter(r=>r.type==='comment').every(r=>tasks.has(r.taskId)));assert(restored.records.every(r=>r.type==='sheet'||restored.records.some(s=>s.type==='sheet'&&s.id===r.sheetId)));
 assert.equal((await call('/api/review?project='+restore.projectId,null,other)).status,403);
 const restoredAssets=await call('/api/documents?project='+restore.projectId);assert(restoredAssets.assets.some(f=>f.name==='Concept presentation.pdf'));assert(restoredAssets.assets.some(f=>f.kind==='photo'&&f.groupId));
 const restoredDeck=restoredAssets.assets.find(f=>f.name==='Concept presentation.pdf');assert.equal((await mf.dispatchFetch('https://review.test/api/documents?project='+restore.projectId+'&id='+restoredDeck.id,{headers:owner})).status,200);
 const archive=await mf.dispatchFetch('https://review.test/api/backups?project='+p.id+'&id='+backupId,{headers:owner});assert.equal(archive.status,200);const tar=new Uint8Array(await archive.arrayBuffer());let offset=0,entries=[];
 while(offset+512<=tar.length&&tar[offset]){const name=new TextDecoder().decode(tar.slice(offset,offset+100)).split('\0')[0],size=parseInt(new TextDecoder().decode(tar.slice(offset+124,offset+136)),8);entries.push(name);if(name==='manifest.json')assert.equal(JSON.parse(new TextDecoder().decode(tar.slice(offset+512,offset+512+size))).tables.records.length,before.length);offset+=512+Math.ceil(size/512)*512}assert.equal(entries.length,manifest.objects.length+1);
 assert.equal((await call('/api/photo-groups',{projectId:p.id,action:'remove',id:group.id})).status,200);assert((await call('/api/documents?project='+p.id)).assets.some(f=>f.id===projectPhoto.asset.id&&!f.groupId));
 await call('/api/shares',{projectId:p.id,action:'revoke',id:share.id});assert.equal((await call('/api/documents?project='+p.id,null,shared)).status,403);
 console.log('PASS: photo groups, presentation defaults/renames, scoped sharing and revocation, 41 MB chunk upload, plan/attachment uploads, thumbnail access, complete backup byte hashes, tar export, isolated restore of files/markups/tasks/comments/folders/likes.');
}
