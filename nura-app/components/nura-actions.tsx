"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays, FileUp, Plus, X, Clock3, MessageCircle, CheckCircle2 } from "lucide-react";

type Mode = "new"|"log"|"upload"|"reschedule"|null;
export function NuraActions({compact=false}:{compact?:boolean}){
 const [mode,setMode]=useState<Mode>(null);
 const close=()=>setMode(null);
 return <>
  <div className={compact?"action-stack compact":"action-stack"}>
   <button onClick={()=>setMode("new")}><span className="rail-icon"><MessageCircle/></span><span><b>Start a new Thread</b><small>Tell Nura what’s going on</small></span></button>
   <button onClick={()=>setMode("log")}><span className="rail-icon blue"><Plus/></span><span><b>Log an update</b><small>Add a symptom, thought or note</small></span></button>
   <button onClick={()=>setMode("upload")}><span className="rail-icon amber"><FileUp/></span><span><b>Upload a document</b><small>Letters, notes or results</small></span></button>
  </div>
  {mode&&<div className="modal-backdrop" onMouseDown={close}><section className="nura-modal" onMouseDown={e=>e.stopPropagation()}>
    <button className="modal-close" onClick={close}><X/></button>
    {mode==="new"&&<><span className="modal-icon"><MessageCircle/></span><h2>Start a new Thread</h2><p>Tell Nura what changed, what you’re worried about, or what you want help keeping track of.</p><textarea placeholder="e.g. I saw my GP today and need to monitor my headaches…"/><div className="modal-actions"><button className="secondary-cta" onClick={close}>Cancel</button><Link href="/workspace" className="primary-cta">Continue with Nura</Link></div></>}
    {mode==="log"&&<><span className="modal-icon blue"><Plus/></span><h2>Log an update</h2><label>Related Thread<select><option>Work Stress</option><option>Headaches</option><option>New Medication</option><option>Sleep</option></select></label><label>What happened?<textarea placeholder="Add a symptom, thought, measurement or note…"/></label><div className="modal-actions"><button className="secondary-cta" onClick={close}>Cancel</button><button className="primary-cta" onClick={close}>Save update</button></div></>}
    {mode==="upload"&&<><span className="modal-icon amber"><FileUp/></span><h2>Upload a document</h2><p>Add a GP letter, discharge note, medication instruction, therapy note or result. This prototype won’t upload anything yet.</p><div className="drop-zone"><FileUp/><b>Drop a file here</b><span>PDF, image or document</span><button className="secondary-cta">Choose file</button></div><div className="modal-actions"><button className="secondary-cta" onClick={close}>Cancel</button><Link href="/upload-review" className="primary-cta">Preview example</Link></div></>}
    {mode==="reschedule"&&<><span className="modal-icon"><CalendarDays/></span><h2>Reschedule check-in</h2><p>Choose when Nura should come back to this.</p><div className="time-options"><button className="selected"><Clock3/>Tonight · 7:30 PM</button><button><Clock3/>Tomorrow · 6:00 PM</button><button><CalendarDays/>Choose another time</button></div><div className="modal-actions"><button className="secondary-cta" onClick={close}>Cancel</button><button className="primary-cta" onClick={close}>Save time</button></div></>}
  </section></div>}
 </>
}
export function RescheduleButton(){const [open,setOpen]=useState(false);return <>{<button className="secondary-cta" onClick={()=>setOpen(true)}>Reschedule</button>}{open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><section className="nura-modal small" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setOpen(false)}><X/></button><span className="modal-icon"><CalendarDays/></span><h2>Reschedule check-in</h2><div className="time-options"><button className="selected"><Clock3/>Tonight · 7:30 PM</button><button><Clock3/>Tomorrow · 6:00 PM</button><button><CalendarDays/>Choose another time</button></div><div className="modal-actions"><button className="secondary-cta" onClick={()=>setOpen(false)}>Cancel</button><button className="primary-cta" onClick={()=>setOpen(false)}>Save time</button></div></section></div>}</>}
export function SuccessToast(){return <div className="success-toast"><CheckCircle2/><span><b>Saved</b><small>Your update is organised in this Thread.</small></span></div>}
