"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const NAME_REGEX =
  /^(([%$\w]+?)(&([0-9Q]+)([FH])(\d+|F))?)@(\w+?)\.([ASQMWD])$/i;

const ALLOWED_OPERATORS = new Set(["+", "-", "*", "/", "(", ")"]);
const METHOD_CALL_REGEX = /^\.\w+$/;

interface CalculateFormProps {
  initialExpression?: string;
}

function validateExpression(expr: string): string | null {
  const tokens = expr
    .replace(/([+*\/(),-])/g, " $1 ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    // Skip allowed operators
    if (ALLOWED_OPERATORS.has(token)) continue;
    // Skip numeric literals
    if (/^-?\d+(\.\d+)?$/.test(token)) continue;
    // Skip quoted strings (method arguments like "quarter", "average")
    if (/^["'].*["']$/.test(token)) continue;
    // Skip commas (method argument separators)
    if (token === ",") continue;
    // Skip method calls like .shift_by, .aggregate
    if (METHOD_CALL_REGEX.test(token)) continue;

    // Anything with @ should be a valid series name
    if (token.includes("@")) {
      if (!NAME_REGEX.test(token)) {
        return `"${token}" is not a valid series name`;
      }
      continue;
    }

    // If it looks like a word (alphanumeric+underscore), it might be a series missing @
    if (/^\w+$/.test(token)) {
      return `"${token}" is not a valid series name`;
    }

    // Anything else is a disallowed character
    return `"${token}" — operation not permitted`;
  }

  return null;
}

export function CalculateForm({ initialExpression }: CalculateFormProps) {
  const [expression, setExpression] = useState(initialExpression ?? "");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { universe } = useParams();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = expression.trim();
    if (!trimmed) return;

    const validationError = validateExpression(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    router.push(
      `/udaman/${universe}/series/calculate?eval=${encodeURIComponent(trimmed)}`,
    );
  };

  return (
    <div className="space-y-1.5">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={expression}
          onChange={(e) => {
            setExpression(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter expression, e.g. E_NF@HI.M + E_NF@MAU.M"
          className="flex-1 font-mono text-sm"
        />
        <Button type="submit" size="sm" variant="outline">
          <Calculator className="mr-1.5 h-4 w-4" />
          Calculate
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
