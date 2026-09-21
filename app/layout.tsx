import type { Metadata,Viewport } from "next";
import "./globals.css";
import "./appearance.css";
import "./specifications.css";
import {AppearanceProvider} from './appearance';
export const metadata: Metadata = {title:"Octava Review | Plan review, in place",description:"PDF markups, calibrated measurements, tasks and client feedback.",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,title:"Octava Review",statusBarStyle:"black-translucent"},icons:{icon:"/favicon.svg",apple:"/apple-touch-icon.png"}};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#292929"};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en" className="dark" suppressHydrationWarning><body><AppearanceProvider>{children}</AppearanceProvider></body></html>}
