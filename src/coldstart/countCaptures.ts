import { filterActiveCaptures, listAllCaptures } from "../consolidate/listCaptures.js";

export function countExistingCaptures(repoRoot: string): number {
  return filterActiveCaptures(listAllCaptures(repoRoot)).length;
}
