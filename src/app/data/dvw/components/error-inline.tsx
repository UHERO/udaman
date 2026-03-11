import { CircleX } from "lucide-react";

export default function ErrorTagInline({
  text = "Selection not available",
}: {
  text?: string;
}) {
  return (
    <div className="flex size-fit items-center justify-center gap-1 rounded-md bg-red-400/20 px-2 py-1 text-xs font-semibold text-red-400">
      <CircleX size={15} />
      <span>{text}</span>
    </div>
  );
}
