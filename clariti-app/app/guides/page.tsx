import type { Metadata } from "next";
import Link from "next/link";
import { ClaritiShell } from "@/components/clariti-shell";
import { GUIDES } from "@/lib/content/guides";
import "./guides.css";

export const metadata: Metadata = {
  title: "Guides to medical bills, EOBs, lab results and discharge summaries",
  description:
    "Plain-language guides to the health paperwork people find hardest to read, each with an invented worked example and questions to ask.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndex() {
  return (
    <ClaritiShell>
      <section className="guide-page">
        <p className="clariti-kicker">GUIDES</p>
        <h1>Read your health paperwork with confidence</h1>
        <p className="guide-lead">
          Each guide explains one kind of document line by line, with an invented example and the questions worth asking.
        </p>
        <ul className="guide-index">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link href={`/guides/${guide.slug}`}>
                <span className="clariti-kicker">{guide.kicker}</span>
                <b>{guide.metaTitle}</b>
                <small>{guide.metaDescription}</small>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ClaritiShell>
  );
}
