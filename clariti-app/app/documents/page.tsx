import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";

const docs = [
  ["Medical bill", "City Hospital · 23 Jul 2026", "Bill"],
  ["Radiology report", "MRI lumbar spine · 18 Jul 2026", "Report"],
  ["Insurance EOB", "BlueCross claim 8472 · 15 Jul 2026", "EOB"],
];

export default function DocumentsPage() {
  return (
    <ClaritiShell>
      <section className="clariti-library clariti-documents-page">
        <div className="clariti-library-head">
          <div className="clariti-library-copy">
            <p className="clariti-kicker">YOUR DOCUMENTS</p>
            <h1>Documents</h1>
            <p className="clariti-library-lead">Everything you’ve asked Clariti to explain, organised in one place.</p>
          </div>
          <Link href="/" className="canvas-primary clariti-add-document">
            <Plus size={18} />
            <span>Add document</span>
          </Link>
        </div>

        <div className="clariti-grid">
          {docs.map(([title, meta, type]) => (
            <Link href="/workspace" className="clariti-library-card" key={title}>
              <span className="clariti-document-icon"><FileText /></span>
              <div className="clariti-document-copy">
                <h3>{title}</h3>
                <p>{meta}</p>
                <small>{type} · Explained by Clariti</small>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </ClaritiShell>
  );
}