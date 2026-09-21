export type Point = {x:number;y:number};
export type Profession='internal'|'owner'|'builder'|'other';
export const professionNames:Record<Profession,string>={internal:'Internal',owner:'Owner',builder:'Builder',other:'Other'};
export type Audience=Profession[];
export type Attachment={id:string;name:string;mime:string;size:number;created:string};
export type ProjectAsset=Attachment&{kind:'photo'|'file'|'specification'|'presentation';source:'project'|'task';author:string;authorRole:Profession;creatorId:string;taskId?:string;sheetId?:string;groupId?:string;thumbnail?:boolean;liked:boolean;likeCount:number};
export type PhotoGroup={id:string;name:string;created:string};
export type Member={id:string;email:string;name:string;profession:Profession;access:'editor'|'client';joined:boolean;owner?:boolean};
export type PlanFolder={id:string;name:string;version:number;created:string};
export type Sheet = {id:string;type:'sheet';code:string;name:string;revision:string;page:number;width:number;height:number;fileId?:string;groupId:string;folderId?:string;sample?:string;calibration?:number;unit?:string;audience?:Audience;created:string;version?:number};
export type Markup = {id:string;type:'markup';sheetId:string;kind:'pen'|'line'|'arrow'|'rect'|'ellipse'|'measure'|'area'|'text'|'photo';points:Point[];color:string;width:number;photoId?:string;text?:string;textSize?:number;textStyle?:'plain'|'callout';areaShape?:'rectangle'|'polygon';precision?:number;editable?:boolean;visibility:'internal'|'client';audience?:Audience;authorRole?:Profession;creatorId?:string;author:string;created:string;version?:number};
export type Comment = {id:string;type:'comment';sheetId:string|null;taskId:string;text:string;author:string;authorRole?:Profession;creatorId?:string;attachments?:Attachment[];audience?:Audience;created:string;visibility:'internal'|'client';version?:number};
export type TaskPhoto=Pick<ProjectAsset,'id'|'name'|'mime'|'size'|'created'|'source'>;
export type Task = {id:string;type:'task';sheetId:string|null;location?:string;photos?:TaskPhoto[];number:number;title:string;description:string;status:'open'|'progress'|'done';priority:'low'|'medium'|'high';assignee:string;due:string;source:'Internal review'|'Client review'|'Site visit';visibility:'internal'|'client';audience?:Audience;authorRole?:Profession;creatorId?:string;position:Point|null;author:string;created:string;version?:number};
export type RecordItem=Sheet|Markup|Task|Comment;
export type Project={id:string;name:string;created:string;planCount?:number;taskCount?:number;role?:'owner'|'editor'|'client';cover?:Sheet};
export type ReviewData={canCreateProjects?:boolean;canManageUsers?:boolean;accountRole?:'admin'|'user';project:Project;records:RecordItem[];role:'owner'|'editor'|'client';profession?:Profession;userId?:string;name:string;guest?:boolean;projects:Project[];folders:PlanFolder[]};
export const uid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
export const statusNames={open:'Open',progress:'In progress',done:'Resolved'};
export const inkPalette=[
 {name:'Pink',color:'#F59DFF',contrast:'#151515'},
 {name:'Purple',color:'#694AFF',contrast:'#FFFFFF'},
 {name:'Green',color:'#06DF74',contrast:'#151515'},
 {name:'Orange',color:'#FF5F01',contrast:'#151515'},
 {name:'Blue',color:'#2377FF',contrast:'#FFFFFF'},
 {name:'Cyan',color:'#00C9EA',contrast:'#151515'},
 {name:'Red',color:'#FF3B4F',contrast:'#151515'},
 {name:'Yellow',color:'#FFD43B',contrast:'#151515'},
 {name:'Black',color:'#151515',contrast:'#FFFFFF'},
 {name:'White',color:'#FFFFFF',contrast:'#151515'},
] as const;
export const colors:string[]=inkPalette.map(ink=>ink.color);
export function sampleRecords():RecordItem[]{
const created=new Date().toISOString();
return [
{id:'sample-ground',type:'sheet',code:'A.101',name:'Ground floor plan',revision:'R02',page:1,width:1200,height:850,groupId:'ground',sample:'ground',calibration:0.025,unit:'m',created},
{id:'sample-roof',type:'sheet',code:'A.201',name:'Roof plan',revision:'R01',page:1,width:1200,height:850,groupId:'roof',sample:'roof',calibration:0.025,unit:'m',created},
{id:'sample-site',type:'sheet',code:'A.001',name:'Site plan',revision:'R01',page:1,width:1200,height:850,groupId:'site',sample:'site',calibration:0.05,unit:'m',created},
{id:'sample-task-1',type:'task',sheetId:'sample-ground',number:1,title:'Widen the kitchen opening',description:'Review the clear opening between the kitchen and terrace. Aim for a more generous connection to the outside.',status:'open',priority:'high',assignee:'Architecture',due:'',source:'Internal review',visibility:'internal',position:{x:585,y:365},author:'Studio Octava',created},
{id:'sample-task-2',type:'task',sheetId:'sample-ground',number:2,title:'Confirm the island layout',description:'Is there enough space for three stools? Please review the seating and circulation around the island.',status:'progress',priority:'medium',assignee:'Interiors',due:'',source:'Client review',visibility:'client',position:{x:720,y:480},author:'Client',created},
{id:'sample-task-3',type:'task',sheetId:'sample-ground',number:3,title:'Check bedroom window alignment',description:'Coordinate the window centerline with the bed and the exterior elevation.',status:'open',priority:'medium',assignee:'Architecture',due:'',source:'Internal review',visibility:'internal',position:{x:335,y:226},author:'Studio Octava',created},
{id:'sample-task-4',type:'task',sheetId:'sample-ground',number:4,title:'Keep the covered terrace open',description:'Column positions have been coordinated with the structure.',status:'done',priority:'low',assignee:'Architecture',due:'',source:'Site visit',visibility:'client',position:{x:790,y:650},author:'Studio Octava',created},
{id:'sample-markup-1',type:'markup',sheetId:'sample-ground',kind:'ellipse',points:[{x:522,y:309},{x:642,y:424}],color:colors[0],width:3,visibility:'internal',author:'Studio Octava',created},
{id:'sample-markup-2',type:'markup',sheetId:'sample-ground',kind:'arrow',points:[{x:850,y:425},{x:759,y:470}],color:colors[1],width:2.5,visibility:'client',author:'Studio Octava',created},
{id:'sample-markup-3',type:'markup',sheetId:'sample-ground',kind:'text',points:[{x:850,y:413}],text:'3 stools?',color:colors[1],width:3,visibility:'client',author:'Studio Octava',created}
] as RecordItem[];
}
