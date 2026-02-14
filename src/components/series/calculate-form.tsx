"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CalculateFormProps {
  initialExpression?: string;
}

export function CalculateForm({ initialExpression }: CalculateFormProps) {
  const [expression, setExpression] = useState(initialExpression ?? "");
  const router = useRouter();
  const { universe } = useParams();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = expression.trim();
    if (!trimmed) return;
    router.push(
      `/udaman/${universe}/series/analyze?eval=${encodeURIComponent(trimmed)}`,
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
        placeholder="Enter expression, e.g. E_NF@HI.M + E_NF@MAU.M"
        className="flex-1 font-mono text-sm"
      />
      <Button type="submit" size="sm" variant="outline">
        <Calculator className="mr-1.5 h-4 w-4" />
        Calculate
      </Button>
    </form>
  );
}
