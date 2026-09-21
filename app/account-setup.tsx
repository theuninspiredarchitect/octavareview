"use client";
import {useEffect,useRef,useState} from 'react';
import {LoaderCircle,ShieldCheck} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
type Requester=(path:string,options?:RequestInit)=>Promise<any>;
export function AdministratorSetup({token,request,onClose}:{token:string;request:Requester;onClose:()=>void}){
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <Dialog open onOpenChange={v=>!v&&!busy&&onClose()}><DialogContent className="account-dialog"><DialogHeader><DialogTitle>Set up your administrator account</DialogTitle><DialogDescription>Choose your password to use Octava Review on any device.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={async e=>{e.preventDefault();setError('');if(password!==confirmation){setError('The passwords do not match.');return}setBusy(true);try{await request('/api/auth',{method:'POST',body:JSON.stringify({action:'activateAdmin',token,password})});window.location.assign('/')}catch(e:any){setError(e.message);setBusy(false)}}}>
  <p className="form-note">Projects in this browser will be saved to your account.</p>
  <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
  <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
  <span className="form-note">Use at least 8 characters.</span>{error&&<p className="form-error" role="alert">{error}</p>}
  <button className="button primary full" disabled={busy||!token}>{busy?<LoaderCircle size={16} className="spin"/>:<ShieldCheck size={16}/>}Save password & open workspace</button>
 </form></DialogContent></Dialog>
}
export default function AccountSetup({token,request,onClose}:{token:string;request:Requester;onClose:()=>void}){
 const [info,setInfo]=useState<any>(null),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),api=useRef(request);api.current=request;
 useEffect(()=>{let active=true;api.current('/api/account-links',{method:'POST',body:JSON.stringify({action:'inspect',token})}).then(v=>{if(active)setInfo(v)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[token]);
 return <Dialog open onOpenChange={v=>!v&&!busy&&onClose()}><DialogContent className="account-dialog"><DialogHeader><DialogTitle>{info?.purpose==='recovery'?'Reset your password':'Welcome to Octava Review'}</DialogTitle><DialogDescription>{info?info.projectName:'Checking your account link…'}</DialogDescription></DialogHeader>{info&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();setError('');if(password!==confirmation){setError('The passwords do not match.');return}setBusy(true);try{const result=await request('/api/account-links',{method:'POST',body:JSON.stringify({action:'complete',token,password})});window.location.assign('/?project='+encodeURIComponent(result.projectId))}catch(e:any){setError(e.message);setBusy(false)}}}>
  <p className="account-link-recipient"><strong>{info.name}</strong><span>{info.email}</span></p>
  <p className="form-note">Choose your password to sign in and open the project.</p>
  <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
  <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
  <span className="form-note">Use at least 8 characters.</span>{error&&<p className="form-error" role="alert">{error}</p>}
  <button className="button primary full" disabled={busy}>{busy?<LoaderCircle size={16} className="spin"/>:<ShieldCheck size={16}/>}Save password & open project</button>
 </form>}{!info&&(error?<p className="form-error" role="alert">{error}</p>:<LoaderCircle className="spin"/>)}</DialogContent></Dialog>
}
