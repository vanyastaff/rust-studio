// Tests for the status-line auto-installer decision logic. Behavior-asserting.
import { test, expect, describe } from "bun:test";
import { installDecision } from "./statusline-install.ts";

describe("installDecision", () => {
  test("disabled flag → never touch settings", () => {
    expect(installDecision({ enabled: false, markerExists: false, hasStatusLine: false })).toBe("disabled");
  });

  test("fresh project, flag on → install", () => {
    expect(installDecision({ enabled: true, markerExists: false, hasStatusLine: false })).toBe("install");
  });

  test("marker present → skip (one-time only, never re-edit)", () => {
    expect(installDecision({ enabled: true, markerExists: true, hasStatusLine: false })).toBe("skip-marker");
  });

  test("user already has a statusLine → never clobber it", () => {
    expect(installDecision({ enabled: true, markerExists: false, hasStatusLine: true })).toBe("skip-existing");
  });

  test("marker takes precedence over an existing statusLine", () => {
    expect(installDecision({ enabled: true, markerExists: true, hasStatusLine: true })).toBe("skip-marker");
  });
});
