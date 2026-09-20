"use client";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Audience,professionNames} from '@/lib/review-types';
export function Choice({value,onChange,options,label,disabled=false}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string;disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger className="choice" aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>}
export const professionOptions=Object.entries(professionNames).map(([value,label])=>({value,label}));
export function AudienceSelect({value,onChange,label='Visible roles',disabled=false}:{value?:Audience;onChange:(v:Audience)=>void;label?:string;disabled?:boolean}){return <Choice value={value?.length===1?value[0]:'all'} onChange={v=>onChange(v==='all'?[]:[v as Audience[number]])} label={label} disabled={disabled} options={[{value:'all',label:'All roles'},...professionOptions]}/>}
