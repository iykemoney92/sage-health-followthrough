import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";

const docs=[
  ["Medical bill","City Hospital · 23 Jul 2026","Bill"],
  ["Radiology report","MRI lumbar spine · 18 Jul 2026","Report"],
  ["Insurance EOB","BlueCross claim 8472 · 15 Jul 2026","EOB"],
];

export default function DocumentsPage(){return <ClaritiShell><section className="clariti-library"><div className="clariti-library-head"><div><p className="clariti-kicker">YOUR DOCUMENTS</p><h1>Documents</h1><p>Everything you’ve asked Clariti to explain, organised in one place.</p></div><Link href="/" className="canvas-primary" style={{width:'auto',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:8,padding:'11px 15px'}}><Plus size={16}/> Add document</Link></div><div className="clariti-grid">{docs.map(([title,meta,type])=><Link href="/workspace" className="clariti-library-card" key={title}><FileText/><h3>{title}</h3><p>{meta}</p><small>{type} · Explained by Clariti</small></Link>)}</div></section></ClaritiShell>}
