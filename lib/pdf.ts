let loader:Promise<any>|null=null;
export async function pdfjs(){if(!loader)loader=import('pdfjs-dist').then(m=>{m.GlobalWorkerOptions.workerSrc='/pdf/pdf.worker.min.mjs';return m});return loader}
export async function openPdf(data:string|Uint8Array,headers?:Record<string,string>){const p=await pdfjs();return p.getDocument({...(typeof data==='string'?{url:data,httpHeaders:headers}:{data}),cMapUrl:'/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf/standard_fonts/',wasmUrl:'/pdf/wasm/',isEvalSupported:false}).promise}
