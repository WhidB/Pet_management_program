import test from "node:test";
import assert from "node:assert/strict";
import {
  readDemoToken,
  newDemoToken,
  demoOwner,
  demoCookie,
} from "../lib/demo-session.mjs";
test("anonymous sessions use distinct random bearer tokens and stable isolated owners", async () => {
  const a = newDemoToken(),
    b = newDemoToken();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b);
  assert.notEqual(await demoOwner(a), await demoOwner(b));
  assert.equal(await demoOwner(a), await demoOwner(a));
  assert.notEqual(await demoOwner(a), "demo_" + a);
});
test("malformed cookies and legacy login headers cannot select a demo owner", async () => {
  assert.equal(readDemoToken("__sites_local_auth=test_alice"), null);
  assert.equal(readDemoToken("pawday_demo_session=demo_shared"), null);
  assert.equal(readDemoToken("pawday_demo_session=" + "a".repeat(65)), null);
  await assert.rejects(demoOwner("test_alice"));
  const token = newDemoToken();
  assert.equal(
    readDemoToken("other=value; pawday_demo_session=" + token),
    token,
  );
});
test("production demo cookies are HTTP-only, secure, and same-site", () => {
  const value = demoCookie(newDemoToken(), true);
  for (const flag of [
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=2592000",
  ])
    assert.ok(value.includes(flag));
});
