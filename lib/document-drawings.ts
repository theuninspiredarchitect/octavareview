import {z} from 'zod';
import type {Markup} from './review-types';
const id=z.string().min(1).max(100);
export const drawingTargetSchema=z.object({source:z.enum(['sketch','project','task']),targetId:id,meetingId:id.optional()});
export type DrawingTarget=z.infer<typeof drawingTargetSchema>;
export const drawingMarkSchema=z.object({id,kind:z.enum(['pen','line','arrow','rect','ellipse','text']),points:z.array(z.object({x:z.number().finite().min(0).max(30000),y:z.number().finite().min(0).max(30000)})).min(1).max(20000),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),width:z.number().min(.5).max(80),text:z.string().max(4000).optional(),textSize:z.number().min(8).max(160).optional(),textStyle:z.enum(['plain','callout']).optional(),author:z.string().max(200).optional(),created:z.string().max(60).optional(),creatorId:z.string().max(200).optional(),authorRole:z.enum(['internal','owner','builder','other']).optional()});
export const drawingDataSchema=z.object({width:z.number().positive().max(30000),height:z.number().positive().max(30000),marks:z.array(drawingMarkSchema).max(1500)}).superRefine((value,ctx)=>{
 if(new Set(value.marks.map(m=>m.id)).size!==value.marks.length)ctx.addIssue({code:'custom',message:'Drawing marks must be unique.'});
 if(value.marks.some(m=>m.kind!=='pen'&&m.kind!=='text'&&m.points.length!==2))ctx.addIssue({code:'custom',message:'Shapes need two corners.'});
 if(value.marks.reduce((n,m)=>n+m.points.length,0)>65000)ctx.addIssue({code:'custom',message:'This page is full. Start another sketch.'});
 if(value.marks.some(m=>m.points.some(p=>p.x>value.width||p.y>value.height)))ctx.addIssue({code:'custom',message:'Keep marks on the page.'});
});
export type DrawingData=z.infer<typeof drawingDataSchema>;
export type DrawingPage=DrawingData&{id:string;page:number;version:number;updated:string};
export type DrawingSnapshot={entryId:string;target:DrawingTarget;page:number;data:DrawingData|null};
export const drawingQuery=(projectId:string,target:DrawingTarget,page?:number)=>new URLSearchParams({project:projectId,source:target.source,target:target.targetId,...(target.meetingId?{meeting:target.meetingId}:{}),...(page?{page:String(page)}:{})}).toString();
export const asMarkups=(data:DrawingData|null|undefined,key:string):Markup[]=>(data?.marks||[]).map(m=>({...m,type:'markup',sheetId:key,visibility:'internal',author:m.author||'Reviewer',created:m.created||''}));
export const documentAssetPath=(projectId:string,target:DrawingTarget)=>'/api/'+(target.source==='task'?'attachments':'documents')+'?project='+encodeURIComponent(projectId)+'&id='+encodeURIComponent(target.targetId);

export async function flushOpenDrawings(){const saves:Promise<boolean>[]=[];document.dispatchEvent(new CustomEvent('octava:flush-drawings',{detail:{saves}}));return (await Promise.all(saves)).every(Boolean);}
