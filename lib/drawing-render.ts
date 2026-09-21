import type {DrawingData,DrawingSnapshot} from './document-drawings';
import {asMarkups,documentAssetPath} from './document-drawings';
import {textLayout,calloutPath} from './drawing-geometry';
import type {Point,Sheet} from './review-types';
export function strokePath(points:Point[]){if(!points.length)return '';if(points.length===1)return `M${points[0].x} ${points[0].y}l.01 .01`;let d=`M${points[0].x} ${points[0].y}`;for(let i=1;i<points.length-1;i++){const p=points[i],n=points[i+1];d+=`Q${p.x} ${p.y} ${(p.x+n.x)/2} ${(p.y+n.y)/2}`}const p=points.at(-1)!;return d+`L${p.x} ${p.y}`;}
export function paintDrawing(ctx:CanvasRenderingContext2D,data:DrawingData){
 const sheet={width:data.width,height:data.height} as Sheet;
 for(const m of asMarkups(data,'export')){const a=m.points[0],b=m.points.at(-1)!;if(!a)continue;ctx.save();ctx.lineWidth=m.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=m.color;ctx.fillStyle=m.color;ctx.beginPath();
  if(m.kind==='pen')ctx.stroke(new Path2D(strokePath(m.points)));
  else if(m.kind==='rect')ctx.strokeRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y));
  else if(m.kind==='ellipse'){ctx.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.abs(b.x-a.x)/2,Math.abs(b.y-a.y)/2,0,0,Math.PI*2);ctx.stroke();}
  else if(m.kind==='text'){const box=textLayout(m,sheet);if(box.callout){const path=new Path2D(calloutPath(box));ctx.fillStyle='#fffdf8';ctx.fill(path);ctx.lineWidth=Math.max(1,m.width*.7);ctx.stroke(path);}ctx.fillStyle=m.color;ctx.font=box.size+'px Arial, sans-serif';box.lines.forEach((line,i)=>ctx.fillText(line,box.textX,box.textY+i*box.lineHeight));}
  else{ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);if(m.kind==='arrow'){const angle=Math.atan2(b.y-a.y,b.x-a.x),l=Math.max(10,m.width*4);ctx.moveTo(b.x-l*Math.cos(angle-.45),b.y-l*Math.sin(angle-.45));ctx.lineTo(b.x,b.y);ctx.lineTo(b.x-l*Math.cos(angle+.45),b.y-l*Math.sin(angle+.45));}ctx.stroke();}ctx.restore();
 }
}
export async function drawingPng(data:DrawingData,pdfPage?:any,transparent=false){
 const canvas=document.createElement('canvas'),factor=Math.min(2,3000/Math.max(data.width,data.height));canvas.width=Math.ceil(data.width*factor);canvas.height=Math.ceil(data.height*factor);const ctx=canvas.getContext('2d')!;
 if(!transparent){ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);}
 if(pdfPage){const viewport=pdfPage.getViewport({scale:factor});await pdfPage.render({canvas,canvasContext:ctx,viewport}).promise;}
 ctx.save();ctx.scale(factor,factor);paintDrawing(ctx,data);ctx.restore();
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not export the drawing.')),'image/png'));return blob;
}
export async function snapshotPng(snapshot:DrawingSnapshot,projectId:string,headers:Record<string,string>){
 let doc:any;try{let data=snapshot.data,pdfPage:any;if(snapshot.target.source!=='sketch'){const r=await fetch(documentAssetPath(projectId,snapshot.target),{headers});if(!r.ok)throw Error('Could not load a report PDF.');const {openPdf}=await import('./pdf');doc=await openPdf(new Uint8Array(await r.arrayBuffer()));pdfPage=await doc.getPage(snapshot.page);const v=pdfPage.getViewport({scale:1});data=data||{width:v.width,height:v.height,marks:[]};}return await drawingPng(data||{width:1400,height:1000,marks:[]},pdfPage);}finally{await doc?.destroy();}
}
// Convert the PDF.js visible page coordinates back into the original PDF space.
// This preserves vector PDF content, crop boxes and pages rotated by 90/180/270 degrees.
export async function exportDrawingPdf(original:Uint8Array|null,pages:{page:number;data:DrawingData}[],pdfDoc?:any){
 const {PDFDocument,pushGraphicsState,popGraphicsState,concatTransformationMatrix,drawObject}=await import('pdf-lib');
 const pdf=original?await PDFDocument.load(original):await PDFDocument.create();
 if(!original)pdf.addPage([pages[0].data.width,pages[0].data.height]);
 for(const {page,data} of pages){if(!data.marks.length)continue;const p=pdf.getPage(page-1),image=await pdf.embedPng(await (await drawingPng(data,undefined,true)).arrayBuffer());
  if(!pdfDoc){p.drawImage(image,{x:0,y:0,width:data.width,height:data.height});continue;}
  const source=await pdfDoc.getPage(page),v=source.getViewport({scale:1}),[a,b,c,d,e,f]=v.transform,det=a*d-b*c;
  const ia=d/det,ib=-b/det,ic=-c/det,id=a/det,ie=(c*f-d*e)/det,iff=(b*e-a*f)/det;
  const name=p.node.newXObject('OctavaInk',image.ref);
  p.pushOperators(pushGraphicsState(),concatTransformationMatrix(ia*v.width,ib*v.width,-ic*v.height,-id*v.height,ic*v.height+ie,id*v.height+iff),drawObject(name),popGraphicsState());
 }
 return pdf.save();
}
