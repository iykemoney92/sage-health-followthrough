"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";

export function ThreadSearchToolbar({
  tab,
  searchTerm,
  category,
}: {
  tab: string;
  searchTerm: string;
  category: string;
}) {
  return (
    <form className="threads-toolbar journeys-toolbar" method="get" action="/plans">
      <input type="hidden" name="tab" value={tab} />
      <label className="searchbox">
        <Search aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={searchTerm}
          placeholder="Search Care plans"
          aria-label="Search Care plans"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
      </label>
      <select
        className="category-select"
        name="category"
        defaultValue={category}
        aria-label="Filter by category"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">All categories</option>
        <option value="clinic">Clinic</option>
        <option value="symptoms">Symptoms</option>
        <option value="medication">Medication</option>
        <option value="wellbeing">Wellbeing</option>
        <option value="recovery">Recovery</option>
        <option value="health">Health</option>
      </select>
      <Link href="/workspace" className="primary-cta">
        <Plus /> New Care plan
      </Link>
    </form>
  );
}
