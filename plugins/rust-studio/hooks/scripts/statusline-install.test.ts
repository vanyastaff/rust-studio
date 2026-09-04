// Tests for the status-line auto-installer decision logic. Behavior-asserting.
import { test, expect, describe } from "bun:test";
import { installDecision, isOurStatusLine, reconcileStatusLine, MANAGED_KEYS } from "./statusline-install.ts";

const OURS = "/home/u/.claude/rust-studio/statusline.ts";

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

describe("installDecision — drift reconciliation", () => {
  test("our statusLine missing a managed key → reconcile, even past the marker", () => {
    expect(
      installDecision({ enabled: true, markerExists: true, hasStatusLine: true, isOurs: true, needsReconcile: true }),
    ).toBe("reconcile");
  });

  test("our statusLine already complete → stay out of settings", () => {
    expect(
      installDecision({ enabled: true, markerExists: true, hasStatusLine: true, isOurs: true, needsReconcile: false }),
    ).toBe("skip-marker");
  });

  test("someone else's statusLine is never reconciled, however incomplete", () => {
    expect(
      installDecision({ enabled: true, markerExists: true, hasStatusLine: true, isOurs: false, needsReconcile: true }),
    ).toBe("skip-marker");
  });

  test("the disabled flag still wins over reconciliation", () => {
    expect(
      installDecision({ enabled: false, markerExists: true, hasStatusLine: true, isOurs: true, needsReconcile: true }),
    ).toBe("disabled");
  });
});

describe("isOurStatusLine", () => {
  test("recognizes our stable script inside the bun command", () => {
    expect(isOurStatusLine({ command: `bun "${OURS}"` }, OURS)).toBe(true);
  });

  test("matches across Windows path separators", () => {
    expect(isOurStatusLine({ command: 'bun "C:\\Users\\u\\.claude\\rust-studio\\statusline.ts"' }, "C:/Users/u/.claude/rust-studio/statusline.ts")).toBe(true);
  });

  test("rejects a different script", () => {
    expect(isOurStatusLine({ command: "~/.claude/my-own-line.sh" }, OURS)).toBe(false);
  });

  test("rejects an empty or absent entry", () => {
    expect(isOurStatusLine(undefined, OURS)).toBe(false);
    expect(isOurStatusLine({ command: "" }, OURS)).toBe(false);
  });
});

describe("reconcileStatusLine", () => {
  test("adds a missing managed key and reports the change", () => {
    const r = reconcileStatusLine({ type: "command", command: `bun "${OURS}"` });
    expect(r.changed).toBe(true);
    expect(r.next.refreshInterval).toBe(MANAGED_KEYS.refreshInterval);
  });

  test("never overwrites a value the user chose", () => {
    const r = reconcileStatusLine({ type: "command", command: `bun "${OURS}"`, refreshInterval: 3 });
    expect(r.changed).toBe(false);
    expect(r.next.refreshInterval).toBe(3);
  });

  test("carries unrelated keys through untouched", () => {
    const r = reconcileStatusLine({ type: "command", command: `bun "${OURS}"`, padding: 2 });
    expect(r.next.padding).toBe(2);
    expect(r.next.command).toBe(`bun "${OURS}"`);
  });
});
