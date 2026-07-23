import Link from "next/link";
import { ArrowUp, FileText, Paperclip, ShieldCheck, Sparkles } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";

const starters = [
  "Explain this medical bill",
  "Help me understand my radiology report",
  "What does this insurance EOB mean?",
];

export default function Home() {
  return (
    <ClaritiShell>
      <section className="clariti-empty-page">
        <div className="clariti-empty-inner">
          <div className="clariti-orb"><Sparkles /></div>
          <p className="clariti-kicker">YOUR HEALTH DOCUMENT COPILOT</p>
          <h1>Health documents are confusing.<br/><span>Clariti makes them clear.</span></h1>
          <p className="clariti-lead">Upload a medical bill, insurance EOB, radiology report, discharge note or other health document. Clariti explains what it says, what matters, and what you can do next.</p>

          <div className="clariti-composer-card">
            <textarea aria-label="Ask Clariti" placeholder="Ask Clariti about a health document…" />
            <div className="clariti-composer-actions">
              <div>
                <button type="button"><Paperclip/> Attach document</button>
                <span>PDF, JPG or PNG</span>
              </div>
              <Link href="/workspace" className="clariti-send" aria-label="Start Clariti demo"><ArrowUp/></Link>
            </div>
          </div>

          <div className="clariti-starters">
            {starters.map((starter)=><Link href="/workspace" key={starter}><FileText/>{starter}</Link>)}
          </div>

          <div className="clariti-trust"><ShieldCheck/><span>Clariti explains and organises your information. It does not diagnose or replace a healthcare professional.</span></div>
        </div>
      </section>
    </ClaritiShell>
  );
}
