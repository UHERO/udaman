import { Universe } from "types/shared";

/** One day I'd like to make universes a dtaabase table so that they're easy to create/destroy
 * but until then they're hard coded.
 */
export function isValidUniverse(u: string): u is Universe {
  const universes: Universe[] = ["UHERO", "FC", "COH", "CCOM", "DBEDT", "NTA"];
  return universes.includes(u.toUpperCase() as Universe);
}
