"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Info } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function NavSearchInput() {
  const router = useRouter();
  const { universe } = useParams<{ universe: string }>();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    const trimmed = term.trim();
    if (trimmed) {
      router.push(`/udaman/${universe}/series?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push(`/udaman/${universe}/series`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg items-center justify-center self-end rounded-sm border"
    >
      <Button
        type="button"
        size={"icon"}
        variant="secondary"
        className="rounded-r-none"
        title={instructions}
      >
        <Info />
      </Button>
      <Input
        className="border-none shadow-none"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search series..."
      />
    </form>
  );
}

const instructions = `
title="Special operators:
^     match start of mnemonic (-)
~    (tilde) match anywhere in mnemonic (-)
-     (minus) omit matching from results
@   match geography (-)
.      match frequency (combine: .am .wd etc) (-)
#     match load statement
!      match load error
:      (colon) match source link URL (-)
;      (semicolon) match resource id numbers for Unit, etc (-)
&pub  public-facing series only (- for restricted)
&pct   percent field is set to true (-)
&sa   seasonally adjusted only
&ns   non-seasonally adjusted only
&nodata    series having no data
&noclock   series having a clockless Loader
&noclip   exclude series that are on the clipboard
/       change universe (/fc, /db, /coh, /ccom, /nta)
=      dynamic predictive search, or find series by name
&quot;       force term to be searched as a bareword

Useful formulas and hints:
^vap$    Match name prefix 'vap' exactly
^yl,yc  Separate alternatives with commas
~ns$      Match NS series based on name
Meta-geographies: @cnty, @hi5 (HI + @cnty), @hiall
145746  Find series by ID number (or comma-sep list of 'em!)
!bad !date !format    Match multiple words (same for #)`;
