"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

interface HhdbSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function HhdbSearch({
  value,
  onChange,
  placeholder = "Search...",
}: HhdbSearchProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  };

  return (
    <div className="relative w-full max-w-sm">
      <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
      <Input
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}
