export type Point = {x:number;y:number};
export type Sheet = {id:string;type:'sheet';code:string;name:string;revision:string;page:number;width:number;height:number;fileId?:string;groupId:string;sample?:string;calibration?:number;unit?:string;created:string;version?:number};
export type Markup = {id:string;type:'markup';sheetId:string;kind:'pen'|'line'|'arrow'|'rect'|'ellipse'|'measure'|'area'|'text';points:Point[];color:string;width:number;text?:string;precision?:number;editable?:boolean;visibility:'internal'|'client';author:string;created:string;version?:number};
export type Comment = {id:string;type:'comment';sheetId:string;taskId:string;text:string;author:string;created:string;visibility:'internal'|'client';version?:number};
export type Task = {id:string;type:'task';sheetId:string;number:number;title:string;description:string;status:'open'|'progress'|'done';priority:'low'|'medium'|'high';assignee:string;due:string;source:'Internal review'|'Client review'|'Site visit';visibility:'internal'|'client';position:Point|null;author:string;created:string;version?:number};
export type RecordItem=Sheet|Markup|Task|Comment;
export type Project={id:string;name:string;created:string};
export type ReviewData={project:Project;records:RecordItem[];role:'owner'|'editor'|'client';name:string;guest?:boolean;projects:Project[]};
export const uid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
export const statusNames={open:'Open',progress:'In progress',done:'Resolved'};
export const colors=['#e4683d','#3477bd','#199184','#9a6ed0','#d49a21','#303d46'];
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
