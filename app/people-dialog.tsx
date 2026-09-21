"use client";
import {useEffect,useRef,useState} from 'react';
import {Check,Copy,FolderOpen,KeyRound,Link2,LoaderCircle,LockKeyhole,Plus,Search,ShieldCheck,UserRound} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Switch} from '@/components/ui/switch';
import {Choice,professionOptions} from './review-controls';
import {professionNames,type Profession} from '@/lib/review-types';
import {toast} from 'sonner';
import './people-dialog.css';

type Requester=(path:string,options?:RequestInit)=>Promise<any>;
type Membership={id:string;memberId:string;enabled:boolean;accountRole:'admin'|'user'};
type Person={email:string;name:string;profession:Profession;access:'editor'|'client';accountRole:'admin'|'user'|'mixed';joined:boolean;self:boolean;owner:boolean;projects:Membership[]};
type PeopleData={projects:{id:string;name:string}[];users:Person[];owner:{name:string;email:string;self:boolean};canManageAccounts:boolean;accountLinksReady:boolean};
type Profile={name:string;email:string;profession:string;access:string;accountRole:string};
const empty:Profile={name:'',email:'',profession:'internal',access:'editor',accountRole:'user'};
export default function PeopleDialog({open,onOpenChange,projectId,request,onChanged}:{open:boolean;onOpenChange:(v:boolean)=>void;projectId:string;request:Requester;onChanged:()=>void}){
 const [data,setData]=useState<PeopleData|null>(null),[selected,setSelected]=useState(''),[adding,setAdding]=useState(false),[draft,setDraft]=useState<Profile>(empty),[chosen,setChosen]=useState<string[]>([]),[query,setQuery]=useState(''),[projectQuery,setProjectQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[accountLink,setAccountLink]=useState<any>(null);
 const api=useRef(request);api.current=request;
 const person=data?.users.find(p=>p.email===selected),protectedPerson=!!person&&(person.self||person.owner);
 async function refresh(){const r:PeopleData=await api.current('/api/people?project='+encodeURIComponent(projectId));setData(r);return r}
 function choose(p:Person){setSelected(p.email);setAdding(false);setDraft({name:p.name,email:p.email,profession:p.profession,access:p.access,accountRole:p.accountRole});setAccountLink(null);setError('');setProjectQuery('')}
 useEffect(()=>{if(!open)return;let active=true;setError('');setData(null);setSelected('');setAdding(false);setAccountLink(null);setQuery('');setProjectQuery('');api.current('/api/people?project='+encodeURIComponent(projectId)).then((r:PeopleData)=>{if(!active)return;setData(r);if(r.users.length)choose(r.users[0])}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[open,projectId]);
 function add(){setAdding(true);setSelected('');setDraft(empty);setChosen([projectId]);setAccountLink(null);setError('');setProjectQuery('')}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
  await request('/api/people',{method:'POST',body:JSON.stringify({action:adding?'add':'profile',projectId,...draft,projects:chosen})});
  const r=await refresh(),saved=r.users.find(p=>p.email===draft.email.toLowerCase().trim());if(saved)choose(saved);onChanged();toast.success(adding?'User added. Copy an invitation link to send.':'User updated');
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function toggle(id:string,enabled:boolean){if(!person)return;setBusy(true);setError('');try{
  await request('/api/people',{method:'POST',body:JSON.stringify({action:'toggle',projectId,email:person.email,targetProjectId:id,enabled})});
  setAccountLink(null);await refresh();onChanged();toast.success(enabled?'Project access enabled':'Project access removed');
 }catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function generate(purpose:'invite'|'recovery'){
  const member=person?.projects.find(p=>p.enabled&&p.id===projectId)||person?.projects.find(p=>p.enabled);if(!member)return;
  setBusy(true);setError('');setAccountLink(null);try{
   const result=await request('/api/account-links',{method:'POST',body:JSON.stringify({action:'generate',projectId:member.id,memberId:member.memberId,purpose})});setAccountLink({...result,projectId:member.id,memberId:member.memberId});
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 const enabled=person?.projects.filter(p=>p.enabled).length||0;
 const projects=data?.projects.filter(p=>p.name.toLowerCase().includes(projectQuery.toLowerCase()))||[];
 return <Dialog open={open} onOpenChange={v=>{if(!busy)onOpenChange(v)}}><DialogContent className="user-access-dialog"><DialogHeader><DialogTitle>Users & project access</DialogTitle><DialogDescription>People can open only their enabled projects. Admins can manage users and settings within those projects.</DialogDescription></DialogHeader>
 {!data&&!error&&<div className="user-access-loading"><LoaderCircle className="spin" size={20}/>Loading users</div>}
 {data&&<div className="user-access-layout"><aside className="user-access-directory">
  <label className="searchbox"><Search size={15}/><input aria-label="Search users" placeholder="Search users" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <button className="button outline user-add" disabled={busy} onClick={add}><Plus size={15}/>Add user</button>
  <div className="user-access-owner"><ShieldCheck size={17}/><span><strong>{data.owner.name}{data.owner.self?' (you)':''}</strong><small>Workspace owner · Admin</small></span><LockKeyhole size={13}/></div>
  <div className="user-access-list">{data.users.filter(p=>(p.name+' '+p.email).toLowerCase().includes(query.toLowerCase())).map(p=><button className={'user-access-person '+(selected===p.email&&!adding?'selected':'')} key={p.email} onClick={()=>choose(p)} disabled={busy} aria-pressed={selected===p.email&&!adding}>
   <span className="person-avatar">{p.name.slice(0,2).toUpperCase()}</span><span><strong>{p.name}{p.self?' (you)':''}</strong><small>{p.accountRole==='admin'?'Admin':p.accountRole==='mixed'?'Mixed roles':'User'} · {p.projects.filter(m=>m.enabled).length} projects</small></span>
  </button>)}{!data.users.length&&<p className="user-access-hint">Add your team and clients, then choose their projects.</p>}{data.users.length>0&&!data.users.some(p=>(p.name+' '+p.email).toLowerCase().includes(query.toLowerCase()))&&<p className="user-access-hint">No matching users.</p>}</div>
 </aside><section className="user-access-details">
 {adding||person?<><div className="user-access-detail-title"><div><h3>{adding?'Add user':person!.name}</h3><p>{adding?'Choose their access before sending an invitation.':person!.joined?'Account connected':'Awaiting sign-in'}</p></div>{!adding&&<span className="user-access-count">{enabled} / {data.projects.length} projects</span>}</div>
 <form onSubmit={save} className="form-stack user-access-form"><div className="form-grid"><label>Name<input required maxLength={120} value={draft.name} disabled={protectedPerson||busy} onChange={e=>setDraft(v=>({...v,name:e.target.value}))}/></label><label>Email<input required type="email" value={draft.email} readOnly={!adding} disabled={protectedPerson||busy} onChange={e=>setDraft(v=>({...v,email:e.target.value}))}/></label></div>
 <div className="form-grid"><label>Account role<Choice label="Account role" value={draft.accountRole} disabled={protectedPerson||busy} onChange={accountRole=>setDraft(v=>({...v,accountRole}))} options={[{value:'user',label:'User'},{value:'admin',label:'Admin'},...(draft.accountRole==='mixed'?[{value:'mixed',label:'Different by project'}]:[])]}/></label><label>Role tag<Choice label="User role tag" value={draft.profession} disabled={protectedPerson||busy} onChange={profession=>setDraft(v=>({...v,profession,access:adding?(profession==='internal'?'editor':'client'):v.access}))} options={professionOptions}/></label></div>
 {draft.accountRole!=='admin'&&<label>Editing permission<Choice label="Editing permission" value={draft.access} disabled={protectedPerson||busy} onChange={access=>setDraft(v=>({...v,access}))} options={[{value:'editor',label:'Edit plans and tasks'},{value:'client',label:'Comment and add own markups'}]}/></label>}
 {!adding&&!protectedPerson&&<button className="button outline user-profile-save" disabled={busy||draft.accountRole==='mixed'}><Check size={15}/>Save user details</button>}
 {protectedPerson&&<p className="user-access-hint">{person?.owner?'The workspace owner always has admin access.':'Another admin can change your access.'}</p>}
 <div className="user-project-heading"><h4>Project access</h4><span>{adding?'Choose projects':'Changes save immediately'}</span></div>
 {data.projects.length>5&&<label className="searchbox"><Search size={15}/><input aria-label="Search project access" placeholder="Search projects" value={projectQuery} onChange={e=>setProjectQuery(e.target.value)}/></label>}
 <div className="user-project-switches">{projects.map(p=>{const member=person?.projects.find(m=>m.id===p.id),on=adding?chosen.includes(p.id):!!member?.enabled;return <label className="user-project-switch" key={p.id}><FolderOpen size={17}/><span><strong>{p.name}</strong>{!adding&&<small>{on?(member?.accountRole==='admin'?'Admin access':'User access'):'No access'}</small>}</span><Switch checked={on} disabled={busy||protectedPerson} aria-label={'Access to '+p.name} onCheckedChange={value=>adding?setChosen(ids=>value?[...ids,p.id]:ids.filter(id=>id!==p.id)):void toggle(p.id,value)}/></label>})}{!projects.length&&<p className="user-access-hint">No matching projects.</p>}</div>
 {adding&&<button className="button primary" disabled={busy||!chosen.length}>{busy?<LoaderCircle className="spin" size={16}/>:<Plus size={16}/>}Add user</button>}
 </form>
 {!adding&&person&&!protectedPerson&&<section className="user-invite-actions"><h4>Account links</h4><div><button className="button outline" disabled={busy||!enabled||!data.canManageAccounts} onClick={()=>void generate('invite')}><Link2 size={15}/>Invite link</button><button className="button outline" disabled={busy||!enabled||!data.canManageAccounts} onClick={()=>void generate('recovery')}><KeyRound size={15}/>Reset password</button></div>
 {!enabled?<p className="user-access-hint">Enable a project before creating an account link.</p>:!data.accountLinksReady?<p className="user-access-hint">Account invitations need the server account connection to be activated.</p>:!data.canManageAccounts?<p className="user-access-hint">The account administrator creates invitation and password reset links.</p>:<p className="user-access-hint">The invited person chooses their own password.</p>}
 </section>}
 {accountLink&&<section className="account-link-result"><strong>{accountLink.existing?'Sign-in link':accountLink.purpose==='recovery'?'Password reset link':'Invitation link'}</strong><p>{accountLink.existing?accountLink.message:'Send this private link to '+person?.email+'. It expires in 30 minutes. No email is sent automatically.'}</p><div><input aria-label="Link to send" readOnly value={accountLink.url} onFocus={e=>e.target.select()}/><button className="button primary" onClick={async()=>{try{await navigator.clipboard.writeText(accountLink.url);toast.success('Link copied')}catch{toast.error('Select and copy the link above.')}}}><Copy size={15}/>Copy</button></div>{!accountLink.existing&&<button className="text-button" disabled={busy} onClick={async()=>{setBusy(true);try{await request('/api/account-links',{method:'POST',body:JSON.stringify({action:'revoke',projectId:accountLink.projectId,memberId:accountLink.memberId})});setAccountLink(null);toast.success('Link revoked')}catch(e:any){setError(e.message)}finally{setBusy(false)}}}>Revoke link</button>}</section>}
 </>:<div className="user-access-empty"><UserRound size={30}/><h3>Select a user</h3><p>Set their role and switch project access on or off.</p><button className="button outline" onClick={add}><Plus size={16}/>Add user</button></div>}
 </section></div>}
 {error&&<p className="form-error" role="alert">{error}</p>}
 </DialogContent></Dialog>
}
