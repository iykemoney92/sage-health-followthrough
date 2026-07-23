import { Bell, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";

const settings=[
  [UserRound,"Profile","Name, email and account preferences"],
  [LockKeyhole,"Privacy & data","Control saved documents, exports and deletion"],
  [Bell,"Notifications","Choose when Clariti can send updates"],
  [ShieldCheck,"Safety & support","Understand Clariti’s limits and get help"],
] as const;

export default function SettingsPage(){return <ClaritiShell><section className="clariti-library"><div className="clariti-library-head"><div><p className="clariti-kicker">ACCOUNT & CONTROL</p><h1>Settings</h1><p>Keep your Clariti experience private, transparent and under your control.</p></div></div><div className="clariti-grid" style={{gridTemplateColumns:'repeat(2,1fr)'}}>{settings.map(([Icon,title,copy])=><button className="clariti-library-card" key={title} style={{textAlign:'left'}}><Icon/><h3>{title}</h3><p>{copy}</p><small>Open settings →</small></button>)}</div></section></ClaritiShell>}
