import { Frequency, Universe } from "../types/shared";

export const frequencies: Frequency[] = ["A", "S", "Q", "M", "W", "D"];
export const universes: Universe[] = [
  "UHERO",
  "FC",
  "COH",
  "CCOM",
  "DBEDT",
  "NTA",
];

export function isValidUniverse(u: string): u is Universe {
  return universes.includes(u.toUpperCase() as Universe);
}
