import { describe, expect, test } from "bun:test";
import { queryBooleanSchema } from "./zod-query";

describe("queryBooleanSchema", () => {
  test("interpreta strings true/false de query params", () => {
    expect(queryBooleanSchema.parse("true")).toBe(true);
    expect(queryBooleanSchema.parse("false")).toBe(false);
    expect(queryBooleanSchema.parse("1")).toBe(true);
    expect(queryBooleanSchema.parse("0")).toBe(false);
  });

  test("mantém boolean nativo", () => {
    expect(queryBooleanSchema.parse(true)).toBe(true);
    expect(queryBooleanSchema.parse(false)).toBe(false);
  });
});
