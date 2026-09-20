export function detectFileType(bytes:Uint8Array){
 const h=Array.from(bytes.slice(0,12)).map(v=>v.toString(16).padStart(2,'0')).join(''),ascii=new TextDecoder().decode(bytes.slice(0,24));
 if(h.startsWith('89504e470d0a1a0a'))return 'image/png';
 if(h.startsWith('ffd8ff'))return 'image/jpeg';
 if(ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a'))return 'image/gif';
 if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')return 'image/webp';
 if(ascii.slice(4,8)==='ftyp'&&['avif','avis'].includes(ascii.slice(8,12)))return 'image/avif';
 if(ascii.slice(4,8)==='ftyp'&&['heic','heix','hevc','hevx','mif1'].includes(ascii.slice(8,12)))return 'image/heic';
 if(ascii.startsWith('%PDF-'))return 'application/pdf';
 return 'application/octet-stream';
}
