import assert from 'node:assert/strict';
import {newUploadItems,runUploadBatch,isPdf} from '../lib/upload-batch.ts';

const a=new File(['a'],'Architecture.pdf',{type:'application/pdf',lastModified:1});
const b=new File(['b'],'Electrical.PDF',{lastModified:2});
const c=new File(['c'],'Mechanical.pdf',{type:'application/pdf',lastModified:3});
assert.equal(newUploadItems([a,a,b,c]).length,3);
assert(isPdf(b));
assert(!isPdf(new File(['text'],'notes.txt')));
const attempts=[],snapshots=[];
const queue=await runUploadBatch(newUploadItems([a,b,c]),async(item,progress)=>{
 attempts.push(item.file.name);progress(30);progress(150);
 if(item.file===b){item.assetId='already-uploaded';throw Error('Meeting save interrupted');}
},items=>snapshots.push(items));
assert.deepEqual(queue.map(i=>i.status),['done','error','done']);
assert.deepEqual(attempts,[a.name,b.name,c.name]);
assert.equal(queue[1].error,'Meeting save interrupted');
assert(snapshots.every(items=>items.every(i=>i.progress>=0&&i.progress<=100)));
assert.equal(snapshots[0][0].status,'uploading','Earlier progress snapshots must not mutate');
const retried=await runUploadBatch(queue,async(item,progress)=>{
 attempts.push(item.file.name);
 assert.equal(item.assetId,'already-uploaded','Retry must preserve a file saved before its meeting note');
 progress(100);
},()=>{});
assert.deepEqual(attempts,[a.name,b.name,c.name,b.name],'Retry must skip completed files');
assert(retried.every(i=>i.status==='done'&&i.progress===100&&!i.error));
console.log('PASS: batch continues after failure, retries only failed files, preserves saved file IDs, deduplicates selection, and keeps independent progress snapshots.');
