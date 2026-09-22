/* Tailwind requires colors be named somewhere in the codebase in order to use so using
this implementation to get started, may switch to using hex codes as keys to tailwind 
colors for better colors.

These colors are used by DataSources to signify different types of loaders.*/
export const getColor = (color: string | null | undefined) => {
  if (color === null || color === undefined) return "bg-muted";
  const colors: Record<string, string> = {
    // Purples
    B2A1EA: "bg-[#B2A1EA]",
    CDC8FE: "bg-[#CDC8FE]",
    A885EF: "bg-[#A885EF]",
    // Oranges
    FFA94E: "bg-[#FFA94E]",
    FFA500: "bg-[#FFA500]",
    // blues
    A9BEF2: "bg-[#A9BEF2]",
    C3DDF9: "bg-[#C3DDF9]",
    "6495ED": "bg-[#6495ED]",
    // yellow
    F9FF8B: "bg-[#F9FF8B]",
    FBFFBD: "bg-[#FBFFBD]",
    F0E67F: "bg-[#F0E67F]",
    // browns
    CAAF8C: "bg-[#CAAF8C]",
    DFC3AA: "bg-[#DFC3AA]",
    B78E5C: "bg-[#B78E5C]",
    // salmon:
    FEB4AA: "bg-[#FEB4AA]",
    // greens:
    "9FDD8C": "bg-[#9FDD8C]",
    D0F0C0: "bg-[#D0F0C0]",
    "88D3B2": "bg-[#88D3B2]",
    "74C365": "bg-[#74C365]",
  };
  return colors[color];
};
