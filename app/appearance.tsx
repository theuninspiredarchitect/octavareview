"use client";
import {ThemeProvider} from 'next-themes';

export function AppearanceProvider({children}:{children:React.ReactNode}){
 return <ThemeProvider attribute="class" forcedTheme="light" defaultTheme="light" enableSystem={false} themes={['light']} storageKey="octava.appearance" disableTransitionOnChange>{children}</ThemeProvider>;
}
