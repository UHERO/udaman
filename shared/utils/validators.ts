import { Universe } from "types/shared";
import { Frequency } from "types/shared";
/** One day I'd like to make universes a dtaabase table so that they're easy to create/destroy
 * but until then they're hard coded.
 */

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
