import { notFound } from "next/navigation";

import { fetchDimensionsWithOptions } from "@/actions/data-portal/dvw";

import Selections from "../components/selections";
import { Module } from "../types";
import { modules } from "../utils";

export default async function ModulePage({
  params,
}: {
  params: { module: Module };
}) {
  const { module } = await params;

  if (!module || !modules.includes(module)) return notFound();
  const dimensions = await fetchDimensionsWithOptions(module);

  return <Selections results={dimensions} module={module} />;
}
