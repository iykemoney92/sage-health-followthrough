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
    <form className="threads-toolbar">
      <input type="hidden" name="tab" value={tab} />
      <label className="searchbox">
        <Search />
        <input
          type="search"
          name="q"
          defaultValue={searchTerm}
          placeholder="Search threads"
          aria-label="Search threads"
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
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">All categories</option>
        <option value="wellbeing">Wellbeing</option>
        <option value="health">Health</option>
        <option value="medication">Medication</option>
      </select>
      <Link href="/workspace" className="primary-cta"><Plus /> New thread</Link>
    </form>
  );
}
