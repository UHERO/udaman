"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { universe } = useParams();
  const href = universe ? `/udaman/${universe}/series` : "/";

  return (
    <main className="flex h-full flex-col items-center justify-center gap-2">
      <h1 className="font-mono text-7xl font-bold text-gray-700">404</h1>
      <h2 className="font-mono text-2xl font-semibold text-gray-700">
        Not Found
      </h2>
      <p className="text-xl text-gray-700">
        It appears this series does not exist.
      </p>
      <Button asChild>
        <Link href={href}>Go back</Link>
      </Button>
    </main>
  );
}
