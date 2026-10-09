import { describe, expect, test } from "bun:test";

import { fuzzyScore } from "./fuzzy-match";

const jane = ["Jane Doe", "jane.doe@hawaii.edu", 42];
const john = ["John Smith", "jsmith@hawaii.edu", 7];

describe("fuzzyScore", () => {
  test("no match scores zero", () => {
    expect(fuzzyScore("zzz", jane)).toBe(0);
    expect(fuzzyScore("", jane)).toBe(0);
  });

  test("ranks exact > prefix > word-start > substring > subsequence", () => {
    const exact = fuzzyScore("42", jane);
    const prefix = fuzzyScore("jan", jane);
    const wordStart = fuzzyScore("doe", jane);
    const substring = fuzzyScore("ane", jane);
    const subseq = fuzzyScore("jdoe", jane);
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(subseq);
    expect(subseq).toBeGreaterThan(0);
  });

  test("matches email local part after a separator", () => {
    expect(fuzzyScore("doe@", jane)).toBeGreaterThan(0);
    expect(fuzzyScore("hawaii", jane)).toBe(60);
  });

  test("tolerates dropped letters", () => {
    expect(fuzzyScore("smth", john)).toBeGreaterThan(0);
    expect(fuzzyScore("jhn", john)).toBeGreaterThan(0);
  });

  test("every token must match some field", () => {
    expect(fuzzyScore("john smith", john)).toBeGreaterThan(0);
    expect(fuzzyScore("john doe", john)).toBe(0);
  });

  test("is case-insensitive", () => {
    expect(fuzzyScore("JANE", jane)).toBe(fuzzyScore("jane", jane));
  });
});
