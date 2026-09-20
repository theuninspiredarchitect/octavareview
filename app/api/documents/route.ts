import {z} from 'zod';
import {withSession} from '@/lib/supabase-server';
import {access,bucket,db,error,fail,json,origin} from '@/lib/server';
import {projectAssets} from '@/lib/project-assets';
import {detectFileType} from '@/lib/file-type';

export const GET=withSession(async(req)=>{try{
 const url=new URL(req.url),a=await access(req,url.searchParams.get('project')),assets=await projectAssets(a),id=url.searchParams.get('id');
 if(!id)return json({assets,userId:a.user,canUpload:!a.shareId});
 const file=assets.find(f=>f.id===id&&f.source==='project');if(!file)fail('File not available in this project.',404);
 const object=await bucket().get(a.project.id+'/documents/'+id);if(!object)fail('File not found.',404);
 const inline=!url.searchParams.has('download')&&(file.mime.startsWith('image/')||file.mime==='application/pdf');
 return new Response(object.body,{headers:{'Content-Type':file.mime,'Content-Disposition':(inline?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(file.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}catch(e){return error(e)}});

export const POST=withSession(async(req)=>{try{
 origin(req);const a=await access(req,new URL(req.url).searchParams.get('project'));if(a.shareId)fail('Sign in as a project participant to add project files. You can attach photos to review tasks.',403);
 if(Number(req.headers.get('content-length')||0)>42*1024*1024)fail('Choose a file smaller than 40 MB.',413);
 const form=await req.formData(),file=form.get('file'),kind=z.enum(['photo','file','specification']).parse(form.get('kind'));
 if(kind==='specification'&&a.role==='client')fail('Project editors upload specifications.',403);
 if(!(file instanceof File)||!file.size||file.size>40*1024*1024)fail('Choose a file smaller than 40 MB.');
 const bytes=await file.arrayBuffer(),mime=detectFileType(new Uint8Array(bytes));
 if(kind==='photo'&&!mime.startsWith('image/'))fail('Choose a JPEG, PNG, WebP, GIF, AVIF or HEIC photo.');
 if(kind==='specification'&&mime!=='application/pdf')fail('Upload specifications as PDF documents.');
 const asset={id:crypto.randomUUID(),name:file.name.replace(/[\u0000-\u001f]/g,'').slice(0,240)||'File',mime,size:file.size,created:new Date().toISOString(),kind,source:'project',author:a.name,authorRole:a.profession,creatorId:a.user,liked:false,likeCount:0};
 await bucket().put(a.project.id+'/documents/'+asset.id,bytes,{httpMetadata:{contentType:mime}});
 try{await db().prepare('INSERT INTO project_documents(id,project_id,kind,name,mime,size,creator,author,author_role,created) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(asset.id,a.project.id,kind,asset.name,mime,file.size,a.user,a.name,a.profession,asset.created).run()}catch(e){await bucket().delete(a.project.id+'/documents/'+asset.id);throw e}
 return json({asset},201);
}catch(e){if(e instanceof z.ZodError)return json({error:'Choose Photos, Files or Specifications.'},400);return error(e)}});

export const PATCH=withSession(async(req)=>{try{
 origin(req);const b=z.object({projectId:z.string(),id:z.string().max(100),liked:z.boolean()}).parse(await req.json()),a=await access(req,b.projectId);
 if(!(await projectAssets(a)).some(f=>f.id===b.id&&f.kind==='photo'))fail('Photo not available.',404);
 if(b.liked)await db().prepare('INSERT OR IGNORE INTO photo_likes(project_id,photo_id,user_id,created) VALUES(?,?,?,?)').bind(a.project.id,b.id,a.user,new Date().toISOString()).run();
 else await db().prepare('DELETE FROM photo_likes WHERE project_id=? AND photo_id=? AND user_id=?').bind(a.project.id,b.id,a.user).run();
 const count=await db().prepare('SELECT count(*) AS total FROM photo_likes WHERE project_id=? AND photo_id=?').bind(a.project.id,b.id).first<{total:number}>();
 return json({liked:b.liked,likeCount:count?.total||0});
}catch(e){if(e instanceof z.ZodError)return json({error:'Choose a photo to like.'},400);return error(e)}});
