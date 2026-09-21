import {bucket,db,fail,type Access} from './server';
export const backupTables=['records','files','attachments','plan_folders','project_documents','photo_groups','photo_group_items','photo_likes','project_members','specification_groups','specifications','meetings','meeting_reports'] as const;
export type BackupManifest={format:'octava-review-backup';version:1;created:string;project:any;tables:Record<string,any[]>;objects:{key:string;backupKey:string;archivePath:string}[]};
export async function backupRow(a:Access,id:string){
 if(a.role!=='owner'||a.shareId)fail('Only the project administrator can manage backups.',403);
 const row=await db().prepare('SELECT * FROM backups WHERE id=? AND project_id=?').bind(id,a.project.id).first<any>();if(!row)fail('Backup not found.',404);return row;
}
export async function manifestFor(row:any):Promise<BackupManifest>{const file=await bucket().get(row.manifest_key);if(!file)fail('Backup manifest is missing.',409);return await file.json<BackupManifest>()}
export async function createBackup(a:Access){
 if(a.role!=='owner'||a.shareId)fail('Only the project administrator can create backups.',403);
 const pending=await db().prepare("SELECT * FROM backups WHERE project_id=? AND status='copying' ORDER BY created DESC LIMIT 1").bind(a.project.id).first<any>();if(pending)return pending;
 const id=crypto.randomUUID(),created=new Date().toISOString(),manifestKey=a.project.id+'/backups/'+id+'/manifest.json';
 // D1 batch reads are one transaction: annotations, tasks and their conversations form one snapshot.
 const result=await db().batch([db().prepare('SELECT * FROM projects WHERE id=?').bind(a.project.id),...backupTables.map(t=>db().prepare('SELECT * FROM '+t+' WHERE project_id=?').bind(a.project.id))]);
 const tables=Object.fromEntries(backupTables.map((t,i)=>[t,result[i+1].results])) as Record<string,any[]>;
 const objects:BackupManifest['objects']=[];
 for(const [table,folder] of [['files','plans'],['attachments','attachments'],['project_documents','documents']])for(const file of tables[table]){
  const leaf=folder==='plans'?file.id+'.pdf':file.id,key=a.project.id+'/'+(folder==='plans'?'':folder+'/')+leaf;
  objects.push({key,backupKey:a.project.id+'/backups/'+id+'/objects/'+objects.length,archivePath:folder+'/'+leaf});
 }
 const manifest:BackupManifest={format:'octava-review-backup',version:1,created,project:result[0].results[0],tables,objects};
 await bucket().put(manifestKey,JSON.stringify(manifest),{httpMetadata:{contentType:'application/json'}});
 await db().prepare('INSERT INTO backups(id,project_id,creator,created,status,cursor,total,manifest_key) VALUES(?,?,?,?,?,0,?,?)').bind(id,a.project.id,a.user,created,'copying',objects.length,manifestKey).run();return {id,created,status:'copying',cursor:0,total:objects.length};
}
export async function copyVerified(source:string,target:string){
 const file=await bucket().get(source);if(!file)fail('A file is missing. The backup has not been marked complete.',409);
 // Originals have immutable keys. Copy as a stream to avoid loading large photos/PDFs into memory.
 const copied=await bucket().put(target,file.body,{httpMetadata:file.httpMetadata});
 if(!copied||copied.size!==file.size)fail('File verification failed. Retry to continue.',409);
 const verified=await bucket().head(target);if(!verified||verified.size!==file.size||verified.etag!==copied.etag)fail('The stored copy could not be verified.',409);
}
export async function stepBackup(a:Access,id:string){
 const row=await backupRow(a,id);if(row.status==='ready')return row;const manifest=await manifestFor(row),item=manifest.objects[row.cursor];
 if(item)await copyVerified(item.key,item.backupKey);
 const cursor=row.cursor+(item?1:0),status=cursor>=manifest.objects.length?'ready':'copying';
 await db().prepare('UPDATE backups SET cursor=?,status=? WHERE id=? AND cursor=?').bind(cursor,status,id,row.cursor).run();return {id,cursor,total:manifest.objects.length,status,created:row.created};
}
function rewrite(value:any,map:Record<string,string>):any{if(typeof value==='string')return map[value]||value;if(Array.isArray(value))return value.map(v=>rewrite(v,map));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v,map)]));return value}
export async function startRestore(a:Access,id:string){
 const backup=await backupRow(a,id);if(backup.status!=='ready')fail('Finish the backup first.');const m=await manifestFor(backup);
 const existing=await db().prepare("SELECT * FROM restores WHERE backup_id=? AND creator=? AND status='copying' ORDER BY created DESC LIMIT 1").bind(id,a.user).first<any>();if(existing)return {id:existing.id,cursor:existing.cursor,total:m.objects.length,status:existing.status};
 const restoreId=crypto.randomUUID(),projectId=crypto.randomUUID(),map:Record<string,string>={[m.project.id]:projectId};
 for(const table of ['records','files','attachments','plan_folders','project_documents','photo_groups','specification_groups','specifications','meetings','meeting_reports'])for(const row of m.tables[table]||[])if(!map[row.id])map[row.id]=crypto.randomUUID();
 await db().prepare('INSERT INTO restores(id,backup_id,project_id,creator,mapping,cursor,status,created) VALUES(?,?,?,?,?,0,?,?)').bind(restoreId,id,projectId,a.user,JSON.stringify(map),'copying',new Date().toISOString()).run();return {id:restoreId,cursor:0,total:m.objects.length,status:'copying'};
}
export async function stepRestore(a:Access,id:string){
 const row=await db().prepare('SELECT * FROM restores WHERE id=? AND creator=?').bind(id,a.user).first<any>();if(!row)fail('Restore not found.',404);
 const backup=await backupRow(a,row.backup_id);if(row.status==='ready')return {status:'ready',projectId:row.project_id};
 const manifest=await manifestFor(backup),map=JSON.parse(row.mapping),item=manifest.objects[row.cursor];
 if(item){let key=item.key;for(const [old,value]of Object.entries(map))key=key.replace(old,value as string);await copyVerified(item.backupKey,key)}
 const cursor=row.cursor+(item?1:0);
 if(cursor<manifest.objects.length){await db().prepare('UPDATE restores SET cursor=? WHERE id=? AND cursor=?').bind(cursor,id,row.cursor).run();return {id,cursor,total:manifest.objects.length,status:'copying'}}
 const project={...manifest.project,id:row.project_id,owner:a.user,name:manifest.project.name+' · Restored '+new Date().toISOString().slice(0,10),created:new Date().toISOString()};
 const statements=[db().prepare('INSERT OR IGNORE INTO projects(id,owner,owner_profession,name,created,next_task) VALUES(?,?,?,?,?,?)').bind(project.id,project.owner,project.owner_profession,project.name,project.created,project.next_task)];
 // Access grants and review tokens are deliberately not reactivated in a restored copy.
 const allowed:Record<string,string[]>={records:['id','project_id','type','sheet_id','data','creator','version','created'],files:['id','project_id','name','page_count','created'],attachments:['id','project_id','task_id','name','mime','size','creator','created'],plan_folders:['id','project_id','name','version','created'],project_documents:['id','project_id','kind','name','mime','size','creator','author','author_role','created'],photo_groups:['id','project_id','name','created'],photo_group_items:['project_id','photo_id','group_id'],photo_likes:['project_id','photo_id','user_id','created'],specification_groups:['id','project_id','name','version','created'],specifications:['id','project_id','data','creator','version','created','updated'],meetings:['id','project_id','data','creator','version','created','updated'],meeting_reports:['id','project_id','meeting_id','revision','data','created']};
 for(const [table,columns]of Object.entries(allowed))for(const original of manifest.tables[table]||[]){
  const value=rewrite(original,map);if(['records','specifications','meetings','meeting_reports'].includes(table))value.data=JSON.stringify(rewrite(JSON.parse(original.data),map));
  statements.push(db().prepare('INSERT OR IGNORE INTO '+table+'('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')').bind(...columns.map(c=>value[c]??null)));
 }
 statements.push(db().prepare("UPDATE restores SET status='ready',cursor=? WHERE id=?").bind(cursor,id));
 await db().batch(statements);return {id,cursor,total:manifest.objects.length,status:'ready',projectId:row.project_id};
}
