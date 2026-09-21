import {z} from 'zod';
import {uid,type ProjectAsset,type Task} from './review-types';
const id=z.string().min(1).max(100);
export const meetingKinds={site:'Site visit',selection:'Material selections',review:'Design review'} as const;
export const meetingEntrySchema=z.object({
 id,kind:z.enum(['observation','task','selection','note','decision']),title:z.string().max(200),text:z.string().max(10000),
 location:z.string().max(200).default(''),photoIds:z.array(id).max(8).default([]),include:z.boolean().default(true),
 taskId:id.nullable().default(null),specificationId:id.nullable().default(null),
 vendor:z.string().max(200).default(''),model:z.string().max(200).default(''),color:z.string().max(120).default(''),finish:z.string().max(120).default(''),
 quantity:z.string().max(80).default(''),size:z.string().max(200).default(''),price:z.string().max(40).default(''),currency:z.enum(['USD','CRC','EUR','GBP','CAD','AUD','MXN','CHF']).default('USD'),
 selectionStatus:z.enum(['Considering','Selected','To confirm']).default('Considering'),
 presentationId:id.nullable().default(null),page:z.number().int().min(1).max(2000).default(1),
});
export const meetingSchema=z.object({id,kind:z.enum(['site','selection','review']),title:z.string().trim().min(1).max(200),
 date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),
 location:z.string().max(200),participants:z.string().max(3000),summary:z.string().max(5000),
 entries:z.array(meetingEntrySchema).max(250),version:z.number().int().nonnegative(),created:z.string(),updated:z.string(),photoGroupId:id.nullable().default(null),
});
export type MeetingEntry=z.infer<typeof meetingEntrySchema>;
export type Meeting=z.infer<typeof meetingSchema>;
export type MeetingReport={id:string;meetingId:string;revision:number;issued:string;issuedBy:string;projectName:string;meeting:Meeting;tasks:Task[];assets:ProjectAsset[]};
export const blankEntry=(kind:MeetingEntry['kind']):MeetingEntry=>meetingEntrySchema.parse({id:uid(),kind,title:'',text:''});
