"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode, flagEmoji, splitStoredPhone } from "@/lib/country-codes";

const SORTED_COUNTRIES = [...COUNTRY_CODES].sort((a, b) => a.name.localeCompare(b.name));

function countryKey(c: CountryCode) {
  return `${c.iso2}-${c.dialCode}`;
}

function CountryCodePicker({
  country,
  onSelect,
  id,
}: {
  country: CountryCode;
  onSelect: (country: CountryCode) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const matches = q
    ? SORTED_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q))
    : SORTED_COUNTRIES;

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="phone-code-picker" ref={rootRef}>
      <button
        id={id}
        type="button"
        className="phone-code-trigger"
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
      >
        {flagEmoji(country.iso2)} +{country.dialCode} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="phone-code-dropdown">
          <input
            ref={searchRef}
            type="text"
            className="phone-code-search"
            placeholder="Search country or code"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className="phone-code-list">
            {matches.map((c) => (
              <li key={countryKey(c)}>
                <button
                  type="button"
                  className={countryKey(c) === countryKey(country) ? "selected" : ""}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                >
                  {flagEmoji(c.iso2)} {c.name} <span>+{c.dialCode}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="phone-code-empty">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PhoneNumberInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (digits: string) => void;
  id?: string;
}) {
  const [{ country, national }, setParts] = useState<{ country: CountryCode; national: string }>(() =>
    value ? splitStoredPhone(value) : { country: DEFAULT_COUNTRY, national: "" },
  );

  function emit(nextCountry: CountryCode, nextNational: string) {
    setParts({ country: nextCountry, national: nextNational });
    const trimmedNational = nextNational.replace(/^0+/, "");
    onChange(trimmedNational ? `${nextCountry.dialCode}${trimmedNational}` : "");
  }

  return (
    <div className="phone-input-group">
      <CountryCodePicker id={id ? `${id}-code` : undefined} country={country} onSelect={(c) => emit(c, national)} />
      <input
        id={id}
        type="tel"
        inputMode="tel"
        className="phone-number-field"
        placeholder="7000 000000"
        value={national}
        onChange={(event) => emit(country, event.target.value.replace(/[^\d\s]/g, ""))}
      />
    </div>
  );
}
