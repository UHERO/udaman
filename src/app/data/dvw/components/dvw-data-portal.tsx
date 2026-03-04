"use client";

import Link from "next/link";

import { Card, CardContent, CardTitle } from "@/components/ui/card";

import { DIMENSION_ICONS, DIMENSION_MAP, modules } from "../utils";
import AboutText, { peripheralTxt } from "./about";

export default function DvwDataPortal() {
  return (
    <main className="mx-5 mt-5 flex size-full flex-col">
      <header className="my-5">
        <h1 className="text-dvw text-center text-3xl font-bold uppercase">
          {peripheralTxt.main_title}
        </h1>
        <h3 className="text-center text-lg font-semibold text-gray-600">
          {peripheralTxt.subtitle}
        </h3>
      </header>
      <div className="mb-5 flex w-full flex-wrap justify-center gap-4 text-center">
        {modules.map((mod, i) => {
          const Icon = DIMENSION_ICONS[mod];
          return (
            <Link key={`${mod}-${i}`} href={`/data/dvw/${mod}`}>
              <Card className="tems-center hover:border-dvw flex h-[150px] w-[280px] flex-col justify-center p-4 shadow-none transition-transform duration-200 ease-in-out hover:-translate-y-1 hover:shadow-lg">
                {Icon && (
                  <CardContent className="flex justify-center pt-2">
                    <Icon size={40} className="text-dvw" />
                  </CardContent>
                )}
                <CardTitle className="text-base font-semibold">
                  {DIMENSION_MAP[mod]}
                </CardTitle>
                {mod === "trend" && (
                  <p className="text-xs text-gray-500">
                    (Arrivals, Days, EXPND, LOS, PPPD, PPPT)
                  </p>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
      <AboutText />
    </main>
  );
}
