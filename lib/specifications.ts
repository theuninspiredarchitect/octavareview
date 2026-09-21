import {z} from 'zod';

export const specificationStages=['Quoting','Selected','Ordered','Part delivered','Delivered'] as const;
export const purchaseModes=['Studio','Owner','Contractor','Reference only'] as const;
export const specificationCurrencies=['USD','CRC','EUR','GBP','CAD','AUD','MXN','CHF'] as const;
const id=z.string().min(1).max(100);
const amount=z.number().int().safe().min(0).max(1_000_000_000_000);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Enter a valid date.');
const revisionSchema=z.object({id,amount,created:z.string().datetime(),date:day,leadTime:z.string().max(200),scope:z.string().max(3000),fileId:id.nullable(),url:z.union([z.literal(''),z.string().url().max(2000).refine(v=>/^https?:\/\//i.test(v))])});
const quoteSchema=z.object({id,provider:z.string().trim().min(1).max(180),currency:z.enum(specificationCurrencies),revisions:z.array(revisionSchema).min(1).max(100)});
const paymentSchema=z.object({id,quoteId:id,amount:amount.refine(v=>v>0),date:day,payer:z.string().trim().min(1).max(160),note:z.string().max(1000),receiptId:id.nullable(),voided:z.boolean()});
export const specificationSchema=z.object({id,name:z.string().trim().min(1).max(200),description:z.string().max(5000),notes:z.string().max(5000),groupId:id.nullable(),photoId:id.nullable(),referenceId:id.nullable(),stage:z.enum(specificationStages),purchasedBy:z.enum(purchaseModes),quotes:z.array(quoteSchema).max(40),selectedQuoteId:id.nullable(),selectedRevisionId:id.nullable(),payments:z.array(paymentSchema).max(500),priceSourceId:id.nullable(),archived:z.boolean(),version:z.number().int().nonnegative(),created:z.string().datetime(),updated:z.string().datetime()});
export type Specification=z.infer<typeof specificationSchema>;
export type SupplierQuote=Specification['quotes'][number];
export type QuoteRevision=SupplierQuote['revisions'][number];
export type SpecPayment=Specification['payments'][number];
export type SpecGroup={id:string;name:string;version:number;created:string};
export type SpecNavigation={projectId:string;groups:(SpecGroup&{count:number})[];canEdit:boolean;ungrouped:number;archived:number};
export function selectedOffer(entry:Specification){const quote=entry.quotes.find(q=>q.id===entry.selectedQuoteId),revision=quote?.revisions.find(r=>r.id===entry.selectedRevisionId);return quote&&revision?{quote,revision}:null}
export function directlyPurchased(entry:Specification){return entry.purchasedBy==='Studio'||entry.purchasedBy==='Owner'}
export function quotePaid(entry:Specification,quoteId:string|null=entry.selectedQuoteId){return entry.payments.filter(p=>!p.voided&&p.quoteId===quoteId).reduce((sum,p)=>sum+p.amount,0)}
export function specMoney(amount:number,currency:string){return new Intl.NumberFormat(undefined,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(amount/100)}
export function parseSpecAmount(value:string){
 const raw=value.trim().replace(/[ \u00a0\u202f]/g,''),lastDot=raw.lastIndexOf('.'),lastComma=raw.lastIndexOf(',');let normalized=raw;
 if(lastDot>=0&&lastComma>=0){const decimal=lastDot>lastComma?'.':',',thousands=decimal==='.'?',':'.',parts=raw.split(decimal);if(parts.length!==2||!/^\d{1,2}$/.test(parts[1])||!new RegExp('^\\d{1,3}(\\'+thousands+'\\d{3})*$').test(parts[0]))throw Error('Use a format such as 1,250.00 or 1.250,00.');normalized=parts[0].split(thousands).join('')+'.'+parts[1];}
 else if(lastComma>=0){if(/^\d+,\d{1,2}$/.test(raw))normalized=raw.replace(',','.');else if(/^\d{1,3}(,\d{3})+$/.test(raw))normalized=raw.replace(/,/g,'');else throw Error('Enter a valid price with up to two decimals.');}
 if(!/^\d+(\.\d{1,2})?$/.test(normalized))throw Error('Enter a positive amount with up to two decimals.');const n=Math.round(Number(normalized)*100);if(!Number.isSafeInteger(n)||n>1_000_000_000_000)throw Error('This amount is too large.');return n;
}
export function specTotals(entries:Specification[]){const totals=new Map<string,{selected:number;paid:number;balance:number;reference:number}>();const currencyTotal=(currency:string)=>{if(!totals.has(currency))totals.set(currency,{selected:0,paid:0,balance:0,reference:0});return totals.get(currency)!};for(const entry of entries){if(entry.archived||entry.priceSourceId)continue;const offer=selectedOffer(entry);if(offer){const t=currencyTotal(offer.quote.currency);if(directlyPurchased(entry)){t.selected+=offer.revision.amount;t.balance+=Math.max(0,offer.revision.amount-quotePaid(entry));}else t.reference+=offer.revision.amount;}if(directlyPurchased(entry))for(const p of entry.payments)if(!p.voided){const q=entry.quotes.find(q=>q.id===p.quoteId);if(q)currencyTotal(q.currency).paid+=p.amount;}}return [...totals].map(([currency,values])=>({currency,...values}))}
