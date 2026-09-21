"use client";
import {useEffect,useState} from 'react';
import {ThemeProvider,useTheme} from 'next-themes';
import {Check,Moon,Sun} from 'lucide-react';

function ThemeChrome(){const {resolvedTheme}=useTheme();useEffect(()=>{document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolvedTheme==='light'?'#f7f6f3':'#292929')},[resolvedTheme]);return null}
export function AppearanceProvider({children}:{children:React.ReactNode}){return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={['dark','light']} storageKey="octava.appearance" disableTransitionOnChange><ThemeChrome/>{children}</ThemeProvider>}
export function AppearanceSettings(){
 const {theme,setTheme}=useTheme(),[mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 return <section className="appearance-settings" aria-labelledby="appearance-heading"><div><h3 id="appearance-heading">Appearance</h3><p>Saved on this device.</p></div><div className="appearance-options" role="group" aria-label="Color scheme">{[{id:'dark',name:'Dark',icon:Moon},{id:'light',name:'Light',icon:Sun}].map(option=><button key={option.id} type="button" className={'appearance-choice appearance-'+option.id} aria-pressed={mounted&&theme===option.id} onClick={()=>setTheme(option.id)}><span className="appearance-preview" aria-hidden="true"><span/><span><i/><i/><i/></span></span><span className="appearance-label"><option.icon size={16}/>{option.name}{mounted&&theme===option.id&&<Check size={15}/>}</span></button>)}</div></section>
}
