"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  ClipboardList,
  FileHeart,
  FileText,
  FlaskConical,
  Hospital,
  Pill,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";
import { getClaritiKindMeta, isClaritiAnalysisKind } from "@/lib/domain/clariti-document-kinds";
import type { ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";

type DocumentRow = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  type: string;
  status: string;
  tone: string;
  sessionId: string | null;
  icon: typeof ReceiptText;
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/documents")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!alive) return;
        setDocuments(payload?.ok ? payload.documents.map(toDocumentRow) : []);
      })
      .catch(() => {
        if (alive) setDocuments([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <ClaritiShell>
      <main className="documents-page-v2">
        <section className="documents-hero-v2">
          <div>
            <p className="clariti-kicker">YOUR HEALTH FILES</p>
            <h1>Documents</h1>
            <p>Keep the health documents you’ve shared with Clariti organised and easy to revisit.</p>
          </div>
          <Link href="/" className="documents-add-primary"><Plus /> <span>Add document</span></Link>
        </section>

        <label className="documents-search-v2">
          <Search />
          <input aria-label="Search documents" placeholder="Search your documents..." />
        </label>

        <section className="documents-upload-card">
          <span className="documents-upload-icon"><UploadCloud /></span>
          <span>
            <strong>Explain a new health document</strong>
            <small>Upload a bill, EOB, radiology report or other health document.</small>
          </span>
          <Link href="/">Upload</Link>
        </section>

        <section className="documents-library-v2">
          <div className="documents-section-head-v2">
            <h2>Recent documents</h2>
            <button type="button">View all</button>
          </div>

          {loading ? (
            <div className="documents-empty-v2">Loading documents...</div>
          ) : documents.length > 0 ? (
            <div className="documents-list-v2">
              {documents.map(({ id, title, subtitle, meta, type, status, tone, sessionId, icon: Icon }) => (
                <Link href={sessionId ? `/workspace?sessionId=${sessionId}` : "/"} className="document-row-v2" key={id}>
                  <span className={`document-art-v2 document-art-${tone}`}><Icon /></span>
                  <span className="document-row-main-v2">
                    <span className="document-type-line-v2"><span>{type}</span><em>{status}</em></span>
                    <strong title={title}>{title}</strong>
                    <span className="document-subtitle-v2" title={subtitle}>{subtitle}</span>
                    <small>{meta}</small>
                  </span>
                  <ChevronRight className="document-chevron-v2" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="documents-empty-v2">
              <strong>No documents yet</strong>
              <span>Attach a health document from the Ask Clariti screen to save it here.</span>
              <Link href="/">Ask Clariti</Link>
            </div>
          )}
        </section>
      </main>

      <style jsx global>{`
        .documents-page-v2{max-width:980px;margin:0 auto;padding:44px 28px 110px}.documents-hero-v2{display:flex;align-items:end;justify-content:space-between;gap:24px}.documents-hero-v2 h1{font:500 40px/1.05 Georgia,"Times New Roman",serif;letter-spacing:-.035em;margin:8px 0 10px;color:#21332f}.documents-hero-v2>div>p:last-child{max-width:600px;margin:0;color:#6e7d78;font-size:14px;line-height:1.65}.documents-add-primary{display:inline-flex;align-items:center;gap:8px;text-decoration:none;background:#4d8d83;color:#fff;border-radius:12px;padding:11px 14px;font-size:12px;font-weight:800;box-shadow:0 8px 22px rgba(47,110,102,.12)}.documents-add-primary svg{width:16px}.documents-search-v2{height:50px;margin:28px 0 18px;border:1px solid #dfe6e3;background:#fff;border-radius:14px;display:flex;align-items:center;gap:10px;padding:0 14px;box-shadow:0 4px 14px rgba(35,63,55,.025)}.documents-search-v2 svg{width:19px;color:#75837e}.documents-search-v2 input{flex:1;border:0;outline:0;background:transparent;font-size:14px;color:#243531}.documents-upload-card{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:13px;align-items:center;padding:15px;border-radius:16px;background:linear-gradient(145deg,#f5faf8,#edf6f2);border:1px solid #d7e6e0;margin-bottom:30px}.documents-upload-icon{width:46px;height:46px;border-radius:13px;background:#fff;color:#3e8277;display:grid;place-items:center;box-shadow:0 4px 12px rgba(38,77,67,.05)}.documents-upload-icon svg{width:22px}.documents-upload-card strong,.documents-upload-card small{display:block}.documents-upload-card strong{font-size:13px;color:#233530}.documents-upload-card small{margin-top:4px;color:#74827d;font-size:10px;line-height:1.45}.documents-upload-card>a{text-decoration:none;padding:9px 12px;border-radius:10px;background:#fff;border:1px solid #cfe0da;color:#2f6e66;font-size:10px;font-weight:800}.documents-section-head-v2{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}.documents-section-head-v2 h2{font-size:17px;margin:0;letter-spacing:-.01em}.documents-section-head-v2 button{border:0;background:transparent;color:#2f786c;font-size:12px;font-weight:800}.documents-list-v2{display:grid;gap:12px}.document-row-v2{display:grid;grid-template-columns:70px minmax(0,1fr) 20px;gap:16px;align-items:center;min-width:0;overflow:hidden;text-decoration:none;background:#fff;border:1px solid #e0e6e3;border-radius:18px;padding:16px;box-shadow:0 5px 20px rgba(35,63,55,.035)}.document-row-v2:hover{border-color:#c7d8d2;transform:translateY(-1px);box-shadow:0 10px 26px rgba(35,63,55,.06)}.document-art-v2{width:70px;height:70px;border-radius:17px;display:grid;place-items:center}.document-art-v2 svg{width:29px;height:29px;stroke-width:1.7}.document-art-sage{background:#edf7f3;color:#388679}.document-art-blue{background:#eef5fb;color:#4d82b7}.document-art-violet{background:#f4f0fb;color:#7c62b8}.document-art-amber{background:#fbf5e8;color:#a57a2f}.document-art-rose{background:#faf0f1;color:#a45d6a}.document-art-slate{background:#eef2f4;color:#5d6f7a}.document-row-main-v2{display:block;min-width:0;max-width:100%;overflow:hidden}.document-type-line-v2{display:flex;align-items:center;gap:7px;min-width:0;max-width:100%;overflow:hidden;margin-bottom:6px}.document-type-line-v2>span{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#67817a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.document-type-line-v2 em{flex:0 0 auto;font-style:normal;padding:4px 7px;border-radius:999px;background:#edf6f2;color:#3d806f;font-size:8px}.document-row-v2 strong{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#21332f;font-size:15px;line-height:1.35}.document-subtitle-v2{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#53645e;font-size:11px;margin-top:4px}.document-row-v2 small{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8a9692;font-size:9px;margin-top:7px}.document-chevron-v2{width:17px;color:#84918d}.documents-empty-v2{border:1px solid #dfe6e3;border-radius:18px;background:#fff;padding:28px;text-align:center;color:#71807b;display:grid;gap:8px}.documents-empty-v2 strong{color:#21332f;font-size:17px}.documents-empty-v2 span{font-size:13px}.documents-empty-v2 a{width:max-content;margin:8px auto 0;text-decoration:none;background:#4d8d83;color:#fff;border-radius:11px;padding:10px 13px;font-size:12px;font-weight:800}
        @media(max-width:760px){.documents-page-v2{padding:30px 18px 104px}.documents-hero-v2{display:block}.documents-hero-v2 h1{font-size:31px;margin-top:7px}.documents-hero-v2>div>p:last-child{font-size:13px;line-height:1.55;max-width:330px}.documents-add-primary{margin-top:18px;padding:10px 13px;border-radius:11px}.documents-search-v2{height:48px;margin:20px 0 14px;border-radius:13px}.documents-upload-card{grid-template-columns:42px minmax(0,1fr) auto;padding:13px;gap:11px;margin-bottom:25px}.documents-upload-icon{width:42px;height:42px;border-radius:12px}.documents-upload-card strong{font-size:12px}.documents-upload-card small{font-size:9px}.documents-upload-card>a{padding:8px 10px;font-size:9px}.documents-section-head-v2 h2{font-size:16px}.document-row-v2{grid-template-columns:58px minmax(0,1fr) 16px;gap:13px;padding:14px;border-radius:16px;align-items:start}.document-art-v2{width:58px;height:58px;border-radius:15px}.document-art-v2 svg{width:25px;height:25px}.document-row-v2 strong{font-size:14px}.document-subtitle-v2{font-size:10.5px}.document-chevron-v2{margin-top:22px;width:16px}.document-type-line-v2{margin-bottom:5px}}
      `}</style>
    </ClaritiShell>
  );
}

function toDocumentRow(document: { id: string; file_name: string; kind: string; status: string; created_at: string; session_id?: string | null }): DocumentRow {
  const kind = (isClaritiAnalysisKind(document.kind) ? document.kind : "unknown") as ClaritiAnalysisKind;
  const meta = getClaritiKindMeta(kind);
  const iconMap: Record<ClaritiAnalysisKind, typeof ReceiptText> = {
    medical_bill: ReceiptText,
    insurance_eob: ShieldCheck,
    radiology_report: FileHeart,
    lab_results: FlaskConical,
    discharge_summary: Hospital,
    medication_context: Pill,
    pathology_report: FileHeart,
    referral_letter: ClipboardList,
    visit_notes: ClipboardList,
    prior_authorization: ShieldCheck,
    unknown: FileText,
  };

  return {
    id: document.id,
    title: document.file_name,
    subtitle: meta.title,
    meta: `${new Date(document.created_at).toLocaleDateString()} · Saved analysis`,
    type: meta.tag,
    status: document.status === "extracted" ? "Explained" : document.status,
    tone: meta.tone,
    sessionId: document.session_id ?? null,
    icon: iconMap[kind],
  };
}
