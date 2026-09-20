import {db,getRecords,profession,type Access} from './server';
import type {ProjectAsset} from './review-types';

export async function projectAssets(a:Access):Promise<ProjectAsset[]>{
 const records=await getRecords(a),assets=new Map<string,ProjectAsset>();
 for(const r of records)if(r.type==='comment')for(const file of r.attachments||[])assets.set(file.id,{...file,kind:file.mime.startsWith('image/')?'photo':'file',source:'task',author:r.author,authorRole:profession(r.authorRole),creatorId:r.creatorId||'',taskId:r.taskId,sheetId:r.sheetId,liked:false,likeCount:0});
 // A sheet-scoped review link never exposes the project's general documents.
 if(!a.shareId){const rows=(await db().prepare('SELECT * FROM project_documents WHERE project_id=? ORDER BY created DESC').bind(a.project.id).all<any>()).results;
  for(const f of rows)assets.set(f.id,{id:f.id,name:f.name,mime:f.mime,size:f.size,created:f.created,kind:f.kind,source:'project',author:f.author,authorRole:profession(f.author_role),creatorId:f.creator,liked:false,likeCount:0});
 }
 const likes=(await db().prepare('SELECT photo_id,count(*) AS total,max(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS liked FROM photo_likes WHERE project_id=? GROUP BY photo_id').bind(a.user,a.project.id).all<any>()).results;
 for(const row of likes){const asset=assets.get(row.photo_id);if(asset?.kind==='photo'){asset.liked=!!row.liked;asset.likeCount=row.total}}
 return [...assets.values()].sort((a,b)=>b.created.localeCompare(a.created));
}
