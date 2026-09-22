"use client";
import React,{useRef,useState,useEffect,forwardRef,useImperativeHandle} from 'react';
import {Sheet,Markup,Task,Point,uid} from '@/lib/review-types';
import {areaPoints,constrain,distance,hitMarkup,measureText,polygonCrosses,validArea,textLayout} from '@/lib/drawing-geometry';
import {canvasOffset,canvasPoint,zoomCanvasAt,wheelCanvasView,type CanvasView} from '@/lib/canvas-navigation';
import {openPdf} from '@/lib/pdf';
import SamplePlan from './sample-plan';
import PhotoPin from './photo-pin';
import MarkupShape from './markup-shapes';
import {Minus,Plus,Maximize,LoaderCircle,EyeOff,Check,X,CornerUpLeft,Magnet} from 'lucide-react';
import {toast} from 'sonner';
export type CanvasHandle={exportImage:()=>Promise<string>;fit:()=>void;zoom:(factor:number)=>void;cancelDraft:()=>boolean};
type Props={pdfDocument?:any;blank?:boolean;sheet:Sheet;markups:Markup[];tasks:Task[];tool:string;color:string;stroke:number;precision:number;areaMode:'rectangle'|'polyline';onAreaMode:(v:'rectangle'|'polyline')=>void;textSize:number;onTextSize:(n:number)=>void;onTextEditing?:(v:boolean)=>void;onPrecision:(n:number)=>void;visibility:'internal'|'client';name:string;fileUrl?:string;headers:Record<string,string>;selected?:string|null;hideMarks:boolean;onSelect:(id:string|null)=>void;onMarkup:(m:Markup)=>void;onErase:(ms:Markup[])=>Promise<string[]>;onEdit:(m:Markup)=>Promise<void>;onPin:(p:Point)=>void;onPhotoPin:(p:Point)=>void;onPhotoOpen:(m:Markup)=>void;onTask:(t:Task)=>void;onCalibrate:(a:Point,b:Point)=>void;children?:React.ReactNode};
type Gesture={id:number;kind:'draw'|'point'|'erase'|'pin'|'photo'|'photo-open'|'text'|'pan'|'edit';start:Point;screen:Point;pan:Point;hadAnchor?:boolean;vertex?:number;original?:Markup};
function Pin({point,scale=1,draft=false,number,status}:{point:Point;scale?:number;draft?:boolean;number?:number;status?:string}){return <g transform={`translate(${point.x},${point.y})`} pointerEvents={draft?'none':undefined}><g data-screen-scale transform={`scale(${1/scale})`} opacity={draft?.78:1}><path d="M0 0 -10 -17A13 13 0 1 1 10 -17Z" fill={draft?'#6b9dff':status==='done'?'#288774':status==='progress'?'#3477bd':'#e4683d'} stroke="white" strokeWidth="1.5"/><text y="-23" fill="white" fontFamily="Arial" fontWeight="bold" fontSize="10" textAnchor="middle">{draft?'+':String(number).padStart(2,'0')}</text>{draft&&<path d="M-9 0H9M0 -5V7" stroke="#6b9dff" strokeWidth="1.25"/>}</g></g>}
const DrawingCanvas=forwardRef<CanvasHandle,Props>(function DrawingCanvas(props,ref){
 const {sheet,markups,tasks,tool,color,stroke,precision,visibility,name,hideMarks}=props;
 const container=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),pdfCanvas=useRef<HTMLCanvasElement>(null),loupeCanvas=useRef<HTMLCanvasElement>(null);
 const [bounds,setBounds]=useState({w:900,h:700}),[view,setViewState]=useState<CanvasView>({zoom:1,pan:{x:0,y:0}}),[draft,setDraft]=useState<Markup|null>(null),[chain,setChain]=useState<Point[]>([]),[loading,setLoading]=useState(false),[pdfError,setPdfError]=useState(''),[space,setSpace]=useState(false),[axis,setAxis]=useState(false),[snap,setSnap]=useState(true),[snapped,setSnapped]=useState(false),[cursor,setCursor]=useState<Point|null>(null),[active,setActive]=useState(false),[activeVertex,setActiveVertex]=useState<number|null>(null),[pdfRevision,setPdfRevision]=useState(0),[eraseTick,setEraseTick]=useState(0);
 const viewRef=useRef(view),{zoom,pan}=view;
 // Update synchronously so rapid trackpad events cannot overwrite one another.
 function setView(next:CanvasView){viewRef.current=next;setViewState(next)}
 const [textDraft,setTextDraft]=useState<{point:Point;value:string;original?:Markup}|null>(null),textRef=useRef<typeof textDraft>(null);textRef.current=textDraft;
 useEffect(()=>()=>props.onTextEditing?.(false),[]);
 const draftRef=useRef<Markup|null>(null),chainRef=useRef<Point[]>([]),gesture=useRef<Gesture|null>(null),touches=useRef(new Map<number,Point>()),penActive=useRef(false),pinch=useRef<{distance:number;zoom:number;anchor:Point}|null>(null),erasing=useRef(new Map<string,Markup>()),pendingErase=useRef(new Set<string>()),eraseLast=useRef<Point|null>(null),lastTap=useRef(0);
 const fit=Math.max(.005,Math.min((bounds.w-(bounds.w<560?125:190))/sheet.width,(bounds.h-125)/sheet.height)),scale=fit*zoom;
 const geometry={bounds,sheet,fit},offset=canvasOffset(view,geometry);
 const selectedMark=markups.find(m=>m.id===props.selected),editable=selectedMark&&selectedMark.editable!==false&&['measure','area'].includes(selectedMark.kind);
 const precisionTool=['measure','area','calibrate','pin','photo'].includes(tool),clamp=(p:Point)=>({x:Math.max(0,Math.min(sheet.width,p.x)),y:Math.max(0,Math.min(sheet.height,p.y))}),inside=(p:Point)=>p.x>=0&&p.y>=0&&p.x<=sheet.width&&p.y<=sheet.height;
 function editText(point:Point,original?:Markup){const value={point,value:original?.text||'',original};textRef.current=value;setTextDraft(value);props.onSelect(original?.id||null);if(original)props.onTextSize(original.textSize||Math.max(14,original.width*5));props.onTextEditing?.(true)}
 function commitText(cancel=false){const value=textRef.current;if(!value)return;textRef.current=null;setTextDraft(null);props.onTextEditing?.(false);if(cancel||!value.value.trim())return;const item={...(value.original||markup('text',[value.point])),text:value.value.trim(),textStyle:'callout' as const,textSize:props.textSize,color};value.original?props.onEdit(item):props.onMarkup(item)}
 function textBlur(e:React.FocusEvent){if((e.relatedTarget as HTMLElement)?.closest('[data-text-ui]'))return;commitText()}
 function setPoints(ps:Point[]){chainRef.current=ps;setChain(ps)}
 function setDraftValue(m:Markup|null){draftRef.current=m;setDraft(m)}
 function cancelDraft(){const had=!!(draftRef.current||chainRef.current.length||gesture.current);setPoints([]);setDraftValue(null);gesture.current=null;erasing.current.clear();setEraseTick(t=>t+1);setActive(false);return had}
 useEffect(()=>{if(!container.current)return;const obs=new ResizeObserver(es=>{const r=es[0].contentRect;setBounds({w:r.width,h:r.height})});obs.observe(container.current);return()=>obs.disconnect()},[]);
 useEffect(()=>{cancelDraft();setActiveVertex(null);setSnapped(false);if(tool==='pin'||tool==='photo')setCursor(p=>p&&inside(p)?p:{x:sheet.width/2,y:sheet.height/2})},[tool,props.areaMode]);
 useEffect(()=>{setActiveVertex(null)},[props.selected]);
 const interactions=useRef({cancelDraft,finishArea:()=>{},backPoint:()=>{}});interactions.current={cancelDraft,finishArea,backPoint:()=>{setPoints(chainRef.current.slice(0,-1));setDraftValue(null)}};
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('input,textarea,select,button,[role="dialog"],[role="combobox"]'))return;if(e.code==='Space'){e.preventDefault();setSpace(true)}if(e.key==='Escape'&&interactions.current.cancelDraft()){e.preventDefault();e.stopImmediatePropagation()}if(chainRef.current.length&&['Enter','Backspace','Delete'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();e.key==='Enter'?interactions.current.finishArea():interactions.current.backPoint()}};const up=(e:KeyboardEvent)=>{if(e.code==='Space')setSpace(false)};const blur=()=>{setSpace(false);cancelDraft();touches.current.clear();pinch.current=null};window.addEventListener('keydown',down,true);window.addEventListener('keyup',up);window.addEventListener('blur',blur);return()=>{window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)}},[]);
 const renderScale=Math.min(8,Math.max(2,Math.ceil(scale*2)),8000/sheet.width,Math.sqrt(16000000/(sheet.width*sheet.height)));
 useEffect(()=>{if(!sheet.fileId||!props.fileUrl){setLoading(false);setPdfError('');return}let cancelled=false,doc:any,render:any;setLoading(true);setPdfError('');
 const timer=setTimeout(()=>{(async()=>{try{doc=props.pdfDocument||await openPdf(props.fileUrl!,props.headers);if(cancelled){if(!props.pdfDocument)doc.destroy();return}const page=await doc.getPage(sheet.page),viewport=page.getViewport({scale:renderScale});const c=pdfCanvas.current;if(!c)return;c.width=viewport.width;c.height=viewport.height;render=page.render({canvas:c,canvasContext:c.getContext('2d')!,viewport});await render.promise;if(!cancelled){setLoading(false);setPdfRevision(n=>n+1)}}catch(e){if(!cancelled){setPdfError('This PDF could not be displayed. Try uploading it again.');setLoading(false)}}})()},160);
 return()=>{cancelled=true;clearTimeout(timer);render?.cancel();if(!props.pdfDocument)doc?.destroy()};},[sheet.id,props.fileUrl,renderScale,props.pdfDocument]);
 const loupePoint=cursor&&(active||chain.length>0)&&!space&&(precisionTool||gesture.current?.kind==='edit')?cursor:null,loupeRadius=64/(scale*2.5);
 useEffect(()=>{const target=loupeCanvas.current,src=pdfCanvas.current;if(!target||!src||!loupePoint||!sheet.fileId)return;const ctx=target.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,256,256);ctx.drawImage(src,(loupePoint.x-loupeRadius)*src.width/sheet.width,(loupePoint.y-loupeRadius)*src.height/sheet.height,2*loupeRadius*src.width/sheet.width,2*loupeRadius*src.height/sheet.height,0,0,256,256)},[loupePoint?.x,loupePoint?.y,loupeRadius,pdfRevision]);
 function zoomAt(next:number,screen?:Point){setView(zoomCanvasAt(viewRef.current,geometry,next,screen||{x:bounds.w/2,y:bounds.h/2}))}
 const fitView=()=>setView({zoom:1,pan:{x:0,y:0}});
 function navigateWheel(e:WheelEvent){
  const r=container.current!.getBoundingClientRect(),screen={x:e.clientX-r.left,y:e.clientY-r.top};
  const next=wheelCanvasView(viewRef.current,geometry,e,screen);
  setView(next);setCursor(canvasPoint(next,geometry,screen));setSnapped(false);
 }
 const navigation=useRef({navigateWheel,zoomAt});navigation.current={navigateWheel,zoomAt};
 useEffect(()=>{
  const el=container.current;if(!el)return;
  let nativePinch:{zoom:number;screen:Point}|null=null;
  const overControl=(e:Event)=>e.target instanceof Element&&!!e.target.closest('[data-ui],button,input,textarea,select,[role="slider"]');
  const wheel=(e:WheelEvent)=>{
   if(overControl(e))return;
   e.preventDefault();
   if(nativePinch||gesture.current||touches.current.size)return;
   navigation.current.navigateWheel(e);
  };
  // Safari exposes trackpad pinches separately; touchscreen pinches stay with
  // the existing pointer handlers, avoiding duplicate navigation on iPad.
  const gestureStart=(e:Event)=>{
   if(overControl(e))return;e.preventDefault();
   if(gesture.current||touches.current.size)return;
   const event=e as Event&{clientX?:number;clientY?:number},r=el.getBoundingClientRect();
   nativePinch={zoom:viewRef.current.zoom,screen:{x:(event.clientX??r.left+r.width/2)-r.left,y:(event.clientY??r.top+r.height/2)-r.top}};
  };
  const gestureChange=(e:Event)=>{
   if(!nativePinch)return;e.preventDefault();
   const scale=(e as Event&{scale:number}).scale;
   if(Number.isFinite(scale)&&scale>0)navigation.current.zoomAt(nativePinch.zoom*scale,nativePinch.screen);
  };
  const gestureEnd=(e:Event)=>{if(nativePinch)e.preventDefault();nativePinch=null};
  const blur=()=>{nativePinch=null};
  el.addEventListener('wheel',wheel,{passive:false});
  el.addEventListener('gesturestart',gestureStart,{passive:false});
  el.addEventListener('gesturechange',gestureChange,{passive:false});
  el.addEventListener('gestureend',gestureEnd,{passive:false});
  window.addEventListener('blur',blur);
  return()=>{el.removeEventListener('wheel',wheel);el.removeEventListener('gesturestart',gestureStart);el.removeEventListener('gesturechange',gestureChange);el.removeEventListener('gestureend',gestureEnd);window.removeEventListener('blur',blur)};
 },[]);
 useImperativeHandle(ref,()=>({fit:fitView,zoom:(f)=>zoomAt(viewRef.current.zoom*f),cancelDraft,exportImage:async()=>{
 if(loading||pdfError)throw new Error('Wait for the drawing to finish loading.');
 const clone=svg.current!.cloneNode(true) as SVGSVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',String(sheet.width));clone.setAttribute('height',String(sheet.height));clone.style.cssText='';clone.querySelectorAll('[data-draft],[data-cursor],[data-selection]').forEach(n=>n.remove());clone.querySelectorAll('[data-screen-scale]').forEach(n=>n.setAttribute('transform','scale(1)'));
 if(sheet.fileId){const bg=document.createElementNS('http://www.w3.org/2000/svg','image');bg.setAttribute('href',pdfCanvas.current!.toDataURL('image/png'));bg.setAttribute('width',String(sheet.width));bg.setAttribute('height',String(sheet.height));clone.insertBefore(bg,clone.firstChild)}
 const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
 try{const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Unable to export the drawing.'));img.src=url});const canvas=document.createElement('canvas'),factor=Math.min(3,3000/sheet.width);canvas.width=Math.ceil(sheet.width*factor);canvas.height=Math.ceil(sheet.height*factor);const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png')}finally{URL.revokeObjectURL(url)}
 }}));
 function point(e:{clientX:number;clientY:number}):Point{const r=container.current!.getBoundingClientRect();return canvasPoint(viewRef.current,geometry,{x:e.clientX-r.left,y:e.clientY-r.top})}
 function exact(raw:Point,shift=false,anchor?:Point,exclude?:string){let p=clamp(raw),did=false;if(anchor&&(axis||shift))p=constrain(anchor,p);else if(snap&&!hideMarks){let best=9/scale;for(const m of markups){if(m.id===exclude||m.kind==='text'||m.kind==='pen')continue;for(const v of m.kind==='area'?areaPoints(m.points):m.points){const d=distance(v,p);if(d<best){best=d;p=v;did=true}}}if(chainRef.current.length>=3&&distance(p,chainRef.current[0])<12/scale){p=chainRef.current[0];did=true}}setSnapped(did);return p}
 function markup(kind:Markup['kind'],ps:Point[]):Markup{return{id:uid(),type:'markup',sheetId:sheet.id,kind,points:ps,color:tool==='calibrate'?'#199184':color,width:stroke,precision,visibility,author:name,created:new Date().toISOString()}}
 function sweep(p:Point){if(hideMarks)return;const from=eraseLast.current||p;let changed=false;for(const m of markups){if(m.editable===false||erasing.current.has(m.id)||pendingErase.current.has(m.id))continue;if(hitMarkup(m,sheet,from,p,12/scale,scale)){erasing.current.set(m.id,m);changed=true}}eraseLast.current=p;if(changed)setEraseTick(t=>t+1)}
 async function commitErase(){const items=[...erasing.current.values()];erasing.current.clear();eraseLast.current=null;if(!items.length)return;items.forEach(m=>pendingErase.current.add(m.id));setEraseTick(t=>t+1);try{await props.onErase(items)}finally{items.forEach(m=>pendingErase.current.delete(m.id));setEraseTick(t=>t+1)}}
 function start(e:React.PointerEvent<HTMLDivElement>){
 if((e.target as Element).closest('button,[data-ui]')||e.button>1)return;if(textRef.current)commitText();if(e.pointerType==='touch'&&penActive.current)return;if(e.pointerType==='pen')penActive.current=true;
 const raw=point(e);touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId);
 if(touches.current.size===2){const ts=[...touches.current.values()],r=container.current!.getBoundingClientRect(),center={x:(ts[0].x+ts[1].x)/2-r.left,y:(ts[0].y+ts[1].y)/2-r.top};pinch.current={distance:Math.max(1,distance(ts[0],ts[1])),zoom:viewRef.current.zoom,anchor:canvasPoint(viewRef.current,geometry,center)};gesture.current=null;setDraftValue(null);erasing.current.clear();setEraseTick(t=>t+1);setActive(false);return}
 const base={id:e.pointerId,start:raw,screen:{x:e.clientX,y:e.clientY},pan:viewRef.current.pan};
 if(!space&&e.button===0&&!hideMarks&&['hand','select'].includes(tool)){const photo=[...markups].reverse().find(m=>m.kind==='photo'&&hitMarkup(m,sheet,raw,raw,3/scale,scale));if(photo){props.onSelect(photo.id);gesture.current={...base,kind:'photo-open',original:photo};return}}
 if(tool==='hand'||space||e.button===1){gesture.current={...base,kind:'pan'};return}if(!inside(raw))return;
 if(tool==='select'){const m=hideMarks?undefined:[...markups].reverse().find(m=>hitMarkup(m,sheet,raw,raw,5/scale,scale));props.onSelect(m?.id||null);if(e.pointerType==='touch'&&!m)gesture.current={...base,kind:'pan'};return}
 if(tool==='eraser'){gesture.current={...base,kind:'erase'};setActive(true);eraseLast.current=raw;sweep(raw);setCursor(raw);return}
 const anchor=chainRef.current.at(-1),p=precisionTool&&!['pin','photo'].includes(tool)?exact(raw,e.shiftKey,anchor):clamp(raw);setCursor(p);setActive(true);
 if(tool==='pin'||tool==='photo'||tool==='text'){gesture.current={...base,kind:tool};return}
 if(tool==='area'&&props.areaMode==='rectangle'){gesture.current={...base,kind:'draw'};setDraftValue({...markup('area',[p]),areaShape:'rectangle'});return}
 if(['measure','calibrate','area'].includes(tool)){gesture.current={...base,kind:'point',hadAnchor:!!chainRef.current.length};return}
 gesture.current={...base,kind:'draw'};setDraftValue(markup(tool as Markup['kind'],[p]));
 }
 function move(e:React.PointerEvent<HTMLDivElement>){
 if(e.pointerType==='touch'&&penActive.current)return;
 if(touches.current.has(e.pointerId))touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pinch.current){if(touches.current.size===2){const ts=[...touches.current.values()],pin=pinch.current,r=container.current!.getBoundingClientRect(),z=Math.min(24,Math.max(.25,pin.zoom*distance(ts[0],ts[1])/pin.distance)),ns=fit*z,c={x:(ts[0].x+ts[1].x)/2-r.left,y:(ts[0].y+ts[1].y)/2-r.top};setView({zoom:z,pan:{x:c.x-pin.anchor.x*ns-(bounds.w-sheet.width*ns)/2-30,y:c.y-pin.anchor.y*ns-(bounds.h-sheet.height*ns)/2-12}})}return}
 const g=gesture.current,raw=point(e);if(g&&g.id!==e.pointerId)return;if(g?.kind==='photo-open'&&distance(g.screen,{x:e.clientX,y:e.clientY})>6)g.kind='pan';if(g?.kind==='pan'){setView({...viewRef.current,pan:{x:g.pan.x+e.clientX-g.screen.x,y:g.pan.y+e.clientY-g.screen.y}});return}
 const anchor=g?.kind==='edit'&&g.original?g.original.points[g.vertex===0?1:(g.vertex||1)-1]:chainRef.current.at(-1),p=((precisionTool&&!['pin','photo'].includes(tool))||g?.kind==='edit')?exact(raw,e.shiftKey,anchor,g?.original?.id):clamp(raw);setCursor(p);
 if(g?.kind==='erase'){sweep(p);return}
 if(g?.kind==='edit'&&draftRef.current){const m=draftRef.current;setDraftValue({...m,points:m.points.map((v,i)=>i===g.vertex?p:v)});return}
 if(g?.kind==='draw'&&draftRef.current){const m=draftRef.current,ps=m.kind==='pen'?[...m.points,...(e.nativeEvent.getCoalescedEvents?.()||[]).map(event=>clamp(point(event))),p].slice(0,19000):[m.points[0],e.shiftKey&&['line','arrow'].includes(m.kind)?constrain(m.points[0],p):p];setDraftValue({...m,points:ps});return}
 if(['measure','calibrate'].includes(tool)){const a=chainRef.current[0]||(g?.kind==='point'&&distance(g.screen,{x:e.clientX,y:e.clientY})>4?clamp(g.start):null);if(a)setDraftValue(markup('measure',[a,exact(raw,e.shiftKey,a)]))}
 }
 function addPoint(p:Point){if(tool==='area'){const ps=chainRef.current;if(ps.length>=3&&distance(p,ps[0])<12/scale){finishArea();return}if(ps.length&&distance(p,ps.at(-1)!)<2/scale)return;if(ps.length>=200){toast('Close this area before adding more corners.');return}if(polygonCrosses([...ps,p],false)){toast('Edges cannot cross. Place this corner on the outline.');return}setPoints([...ps,p]);setDraftValue(null);return}
 const a=chainRef.current[0];if(!a){setPoints([p]);return}if(distance(a,p)<.01)return;if(tool==='calibrate')props.onCalibrate(a,p);else props.onMarkup(markup('measure',[a,p]));setPoints([]);setDraftValue(null)
 }
 function finishArea(){const ps=chainRef.current;if(tool!=='area'||ps.length<3)return;if(!validArea(ps)){toast('Use a closed outline with no crossing edges.');return}props.onMarkup({...markup('area',ps),areaShape:'polygon'});setPoints([]);setDraftValue(null);setActive(false)}
 function end(e:React.PointerEvent<HTMLDivElement>){
 touches.current.delete(e.pointerId);if(e.pointerType==='pen')penActive.current=false;
 if(pinch.current){if(!touches.current.size)pinch.current=null;gesture.current=null;setDraftValue(null);setActive(false);return}
 const g=gesture.current;if(!g||g.id!==e.pointerId)return;gesture.current=null;setActive(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 const raw=point(e),p=(precisionTool&&!['pin','photo'].includes(tool))||g.kind==='edit'?exact(raw,e.shiftKey,chainRef.current.at(-1),g.original?.id):clamp(raw);
 if(g.kind==='erase'){sweep(p);commitErase();return}if(g.kind==='pan')return;
 if(g.kind==='photo-open'){if(g.original&&distance(g.screen,{x:e.clientX,y:e.clientY})<=6)props.onPhotoOpen(g.original);return}
 if(g.kind==='photo'){if(inside(raw))props.onPhotoPin(p);return}
 if(g.kind==='pin'){if(inside(raw))props.onPin(p);return}if(g.kind==='text'){if(inside(raw)){const existing=[...markups].reverse().find(m=>m.kind==='text'&&m.editable!==false&&hitMarkup(m,sheet,p,p,5/scale));editText(existing?.points[0]||p,existing)}return}
 if(g.kind==='point'){if(!inside(raw))return;if(tool!=='area'&&!g.hadAnchor&&distance(g.screen,{x:e.clientX,y:e.clientY})>4){setPoints([clamp(g.start)]);addPoint(exact(raw,e.shiftKey,clamp(g.start)))}else{const now=Date.now();if(tool==='area'&&now-lastTap.current<300&&chainRef.current.length>=3&&distance(p,chainRef.current.at(-1)!)<5/scale)finishArea();else addPoint(p);lastTap.current=now}return}
 const m=draftRef.current;setDraftValue(null);if(!m)return;
 if(g.kind==='edit'){if(m.kind==='area'&&!validArea(areaPoints(m.points))){toast('Area edges cannot cross.');return}if(m.kind==='measure'&&distance(m.points[0],m.points[1])<.01)return;if(JSON.stringify(m.points)!==JSON.stringify(g.original?.points))props.onEdit(m);return}
 if(m.kind==='area'&&!validArea(areaPoints(m.points)))return;
 if(m.kind!=='pen'&&distance(m.points[0],m.points.at(-1)!)<.01)return;props.onMarkup(m)
 }
 function beginVertex(e:React.PointerEvent,index:number){if(!selectedMark||selectedMark.editable===false||space)return;e.stopPropagation();container.current?.setPointerCapture(e.pointerId);touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const ps=selectedMark.kind==='area'&&selectedMark.points.length!==2?areaPoints(selectedMark.points):selectedMark.points;gesture.current={id:e.pointerId,kind:'edit',start:ps[index],screen:{x:e.clientX,y:e.clientY},pan,vertex:index,original:selectedMark};setActiveVertex(index);setCursor(ps[index]);setActive(true);setDraftValue({...selectedMark,points:ps})}
 async function nudge(e:React.KeyboardEvent,index:number){if(!selectedMark||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();const step=(e.shiftKey?10:1)/scale,ps=(selectedMark.kind==='area'&&selectedMark.points.length!==2?areaPoints(selectedMark.points):selectedMark.points).map((p,i)=>i===index?clamp({x:p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y:p.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)}):p);if(selectedMark.kind==='area'&&!validArea(areaPoints(ps)))return;await props.onEdit({...selectedMark,points:ps})}
 const visible=hideMarks?[]:markups.filter(m=>m.id!==textDraft?.original?.id&&!erasing.current.has(m.id)&&!pendingErase.current.has(m.id)&&!(draft&&gesture.current?.kind==='edit'&&m.id===draft.id));
 const editPoints=editable?(draft?.id===selectedMark.id?draft.points:selectedMark.kind==='area'&&selectedMark.points.length!==2?areaPoints(selectedMark.points):selectedMark.points):[];
 const areaPreview=tool==='area'&&chain.length?([...chain,...(cursor&&distance(cursor,chain.at(-1)!)>.01?[cursor]:[])]):[];
 const live=tool==='area'&&chain.length>=3?measureText(markup('area',chain),sheet):draft?.kind==='measure'?measureText(draft,sheet):'';
 const activeText:Markup|undefined=textDraft?{...(textDraft.original||markup('text',[textDraft.point])),text:textDraft.value,textStyle:'callout',textSize:props.textSize}:selectedMark?.kind==='text'?selectedMark:undefined;
 const textBox=activeText?textLayout(activeText,sheet):null,editorFont=Math.max(16,Math.min(64,props.textSize*scale));
 const editorWidth=Math.min(bounds.w-16,Math.max(190,Math.min(360,(textBox?.width||240)*scale))),editorHeight=Math.min(300,Math.max(46,(textBox?.lines.length||1)*editorFont*1.25+20));
 const editorX=Math.max(8,Math.min(bounds.w-editorWidth-8,offset.x+(textBox?.x||0)*scale)),editorY=Math.max(50,Math.min(bounds.h-editorHeight-85,offset.y+(textBox?.y||0)*scale));
 const textControlWidth=textDraft?262:164,controlX=Math.max(8,Math.min(bounds.w-textControlWidth-8,textDraft?editorX:offset.x+(textBox?.x||0)*scale));
 const noteBottom=textDraft?editorY+editorHeight:offset.y+((textBox?.y||0)+(textBox?.height||0))*scale;
 const controlY=Math.max(50,Math.min(bounds.h-110,noteBottom+46<bounds.h-75?noteBottom+8:(textDraft?editorY:offset.y+(textBox?.y||0)*scale)-44));
 const hint=tool==='area'?(props.areaMode==='rectangle'?'Drag opposite corners to measure a rectangle':'Tap corners · Close at the first point'):tool==='measure'||tool==='calibrate'?chain.length?'Place the second point':'Place the first point · Drag also works':tool==='eraser'?'Drag across markups to erase · Ctrl Z to restore':tool==='photo'?'Tap to place photo · Two fingers to pan':tool==='pin'?'Move the pin · Click to drop · Touch: drag and release':tool==='text'?'Tap to place a callout · Double-click a note to edit':tool==='pen'?'Draw to mark up · Two fingers to pan':'Two fingers to pan · Pinch to zoom';
 return <div ref={container} className={'drawing-stage tool-'+(space?'hand':tool)} onDoubleClick={e=>{if(tool!=='select'&&tool!=='text')return;const p=point(e),m=[...markups].reverse().find(m=>m.kind==='text'&&m.editable!==false&&hitMarkup(m,sheet,p,p,5/scale));if(m)editText(m.points[0],m)}} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={e=>{touches.current.delete(e.pointerId);if(e.pointerType==='pen')penActive.current=false;cancelDraft();if(!touches.current.size)pinch.current=null}} onPointerLeave={()=>{if(!gesture.current)setCursor(null)}} onContextMenu={e=>e.preventDefault()}>
 <div className="drawing-paper" style={{width:sheet.width,height:sheet.height,transform:`translate(${offset.x}px,${offset.y}px) scale(${scale})`}}>
 {sheet.fileId&&<canvas ref={pdfCanvas} className="pdf-layer" style={{width:sheet.width,height:sheet.height}}/>}
 <svg ref={svg} viewBox={`0 0 ${sheet.width} ${sheet.height}`} className="plan-svg" aria-label={sheet.name+' drawing with review annotations'}>
 {!sheet.fileId&&!props.blank&&<SamplePlan variant={sheet.sample}/>}
 {visible.map(m=>m.kind==='photo'?<g key={m.id} role="button" aria-label={'Open photo: '+(m.text||'Linked photo')} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();props.onSelect(m.id);props.onPhotoOpen(m)}}} style={{cursor:['hand','select'].includes(tool)?'pointer':undefined}}><MarkupShape m={m} s={sheet} scale={scale} selected={props.selected===m.id}/></g>:<MarkupShape key={m.id} m={m} s={sheet} selected={props.selected===m.id}/>)}
 {!hideMarks&&tasks.filter(t=>t.position).map(t=><g key={t.id} onPointerDown={e=>{if(tool!=='select')return;e.stopPropagation();props.onTask(t)}} role="button" aria-label={'Task '+t.number+': '+t.title} tabIndex={tool==='select'?0:-1} onKeyDown={e=>{if(e.key==='Enter'){e.stopPropagation();props.onTask(t)}}} style={{cursor:tool==='select'?'pointer':undefined,pointerEvents:tool==='select'?'auto':'none'}}><Pin point={t.position!} scale={scale} number={t.number} status={t.status}/></g>)}
 {draft&&<g data-draft pointerEvents="none"><MarkupShape m={draft} s={sheet}/></g>}
 {areaPreview.length>0&&<g data-draft pointerEvents="none"><polyline points={areaPreview.map(p=>`${p.x},${p.y}`).join(' ')} stroke={color} strokeWidth={stroke} fill={areaPreview.length>=3?color+'12':'none'}/>{areaPreview.length>2&&<path d={`M${areaPreview.at(-1)!.x} ${areaPreview.at(-1)!.y}L${chain[0].x} ${chain[0].y}`} stroke={color} strokeWidth={1/scale} strokeDasharray={`${5/scale} ${4/scale}`} fill="none"/>}{chain.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={(i===0?6:3)/scale} fill={i===0?color:'white'} stroke={color} strokeWidth={1.5/scale}/>)}</g>}
 {tool==='select'&&!hideMarks&&editPoints.map((p,i)=><circle data-selection key={i} cx={p.x} cy={p.y} r={7/scale} fill={activeVertex===i?'#6b9dff':'white'} stroke="#3976d1" strokeWidth={1.5/scale} role="button" aria-label={'Adjust '+(selectedMark!.kind==='area'?'corner ':'endpoint ')+(i+1)} tabIndex={0} onPointerDown={e=>beginVertex(e,i)} onKeyDown={e=>nudge(e,i)} style={{cursor:'crosshair',touchAction:'none'}}/>)}
 {cursor&&inside(cursor)&&!space&&<g data-cursor pointerEvents="none">{tool==='pen'&&<circle cx={cursor.x} cy={cursor.y} r={stroke/2} fill={color} opacity=".65"/>}{tool==='eraser'&&<circle cx={cursor.x} cy={cursor.y} r={12/scale} fill="#ffffff22" stroke="#909090" strokeWidth={1/scale}/>} {tool==='photo'&&<PhotoPin point={cursor} scale={scale} draft/>}{tool==='pin'&&<Pin point={cursor} scale={scale} draft/>}{(['measure','area','calibrate'].includes(tool)||gesture.current?.kind==='edit')&&<g transform={`translate(${cursor.x},${cursor.y}) scale(${1/scale})`} stroke={snapped?'#38bda5':'#4284e5'} fill="none" strokeWidth="1"><path d="M-12 0H-4M4 0H12M0 -12V-4M0 4V12"/><circle r={snapped?5:2}/></g>}</g>}
 {textDraft&&activeText&&<g data-draft pointerEvents="none"><MarkupShape m={activeText} s={sheet}/></g>}
 </svg></div>
 {textDraft&&<div className="inline-callout-editor" data-ui data-text-ui style={{left:editorX,top:editorY,width:editorWidth,height:editorHeight,borderColor:color,color}}><textarea autoFocus aria-label="Text on drawing" placeholder="Write a callout…" maxLength={2000} value={textDraft.value} style={{fontSize:editorFont,lineHeight:1.25,color}} onChange={e=>{const value={...textDraft,value:e.target.value};textRef.current=value;setTextDraft(value)}} onBlur={textBlur} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();commitText(true)}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();commitText()}}}/></div>}
 {loading&&<div className="canvas-message"><LoaderCircle className="spin"/> Opening drawing…</div>}{pdfError&&<div className="canvas-message error">{pdfError}</div>}{hideMarks&&<div className="marks-hidden"><EyeOff size={15}/> Markups and pins hidden</div>}
 {props.children}
 {activeText&&(textDraft||selectedMark?.editable!==false)&&<div className="text-options anchored-text-options" data-ui data-text-ui style={{left:controlX,top:controlY,right:'auto',maxWidth:bounds.w-16}}><span>Text size</span><input type="number" aria-label="Text size in pixels" min={8} max={160} step={1} value={props.textSize} onBlur={e=>{if(textRef.current){textBlur(e);return}if(selectedMark?.kind==='text'&&selectedMark.editable!==false&&selectedMark.textSize!==props.textSize)props.onEdit({...selectedMark,textSize:props.textSize})}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}} onChange={e=>props.onTextSize(Math.max(8,Math.min(160,Number(e.target.value)||8)))}/><span>px</span>{textDraft&&<><button aria-label="Save text" onPointerDown={e=>e.preventDefault()} onClick={()=>commitText()}><Check size={16}/> Done</button><button aria-label="Cancel text" onPointerDown={e=>e.preventDefault()} onClick={()=>commitText(true)}><X size={16}/></button></>}</div>}
 {tool==='area'&&<div className="area-mode-options" data-ui role="group" aria-label="Area measurement shape"><button aria-pressed={props.areaMode==='rectangle'} className={props.areaMode==='rectangle'?'active':''} onClick={()=>props.onAreaMode('rectangle')}>Rectangle</button><button aria-pressed={props.areaMode==='polyline'} className={props.areaMode==='polyline'?'active':''} onClick={()=>props.onAreaMode('polyline')}>Polyline</button></div>}
 {(['measure','area','calibrate'].includes(tool)||editable)&&<div className="measure-options" data-ui><button className={axis?'active':''} aria-label="Constrain horizontal or vertical" aria-pressed={axis} onClick={()=>setAxis(v=>!v)}>90°</button><button className={snap?'active':''} aria-label="Snap to markup endpoints" aria-pressed={snap} title="Snap to existing markup endpoints" onClick={()=>setSnap(v=>!v)}><Magnet size={15}/></button><label><span>Decimals</span><select aria-label="Measurement decimal precision" value={editable?(selectedMark.precision??2):precision} onChange={e=>{const n=Number(e.target.value);props.onPrecision(n);if(editable)props.onEdit({...selectedMark,precision:n})}}>{[2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div>}
 {chain.length>0&&<div className="point-actions" data-ui><span>{tool==='area'?chain.length+' corners':'Start set'}{live&&' · '+live}</span>{tool==='area'&&<button aria-label="Remove last area corner" onClick={()=>{setPoints(chain.slice(0,-1));setDraftValue(null)}}><CornerUpLeft size={16}/></button>}{tool==='area'&&<button className="finish-area" disabled={chain.length<3} onClick={finishArea}><Check size={15}/> Close area</button>}<button aria-label="Cancel measurement" onClick={cancelDraft}><X size={15}/></button></div>}
 {loupePoint&&<div className="precision-loupe" style={{left:Math.max(105,Math.min(bounds.w-143,offset.x+loupePoint.x*scale+30)),top:Math.max(78,Math.min(bounds.h-175,offset.y+loupePoint.y*scale-155))}} aria-hidden="true">{sheet.fileId?<canvas ref={loupeCanvas} width="256" height="256"/>:<svg viewBox={`${loupePoint.x-loupeRadius} ${loupePoint.y-loupeRadius} ${loupeRadius*2} ${loupeRadius*2}`}><SamplePlan variant={sheet.sample}/></svg>}<svg className="loupe-crosshair" viewBox="0 0 128 128"><path d="M48 64H60M68 64H80M64 48V60M64 68V80" stroke="#397ee8" fill="none" strokeWidth="1"/><circle cx="64" cy="64" r="2" fill="#397ee8"/></svg><span>{snapped?'Endpoint snap':live||'Precision view'}</span></div>}
 <div className="canvas-bottom" data-ui><span>{hint}</span><div className="zoom-control"><button aria-label="Zoom out" onClick={()=>zoomAt(zoom/1.2)}><Minus size={16}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>zoomAt(zoom*1.2)}><Plus size={16}/></button><i/><button aria-label="Fit drawing" onClick={fitView}><Maximize size={16}/></button></div></div>
 </div>
});
export default DrawingCanvas;
