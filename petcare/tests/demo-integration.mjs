import assert from "node:assert/strict";
const base = process.env.PUBLIC_DEMO_TEST_URL || "http://localhost:5174";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Tests must use a local server",
);
let checks = 0;
async function call(
  route,
  { cookie, body, method = "GET", status = 200, headers = {} } = {},
) {
  const response = await fetch(base + "/api/" + route, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  assert.equal(response.status, status, JSON.stringify({ route, data }));
  checks++;
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const a = await call("demo", {
  method: "POST",
  body: { language: "ko", timezone: "Asia/Seoul" },
});
const b = await call("demo", {
  method: "POST",
  body: { language: "zh", timezone: "Asia/Shanghai" },
});
assert.notEqual(a.cookie, b.cookie);
const first = (await call("data", { cookie: a.cookie })).data;
const second = (await call("data", { cookie: b.cookie })).data;
assert.equal(first.pets.length, 2);
assert.equal(first.schedules.length, 3);
assert.equal(second.pets.length, 2);
assert.notEqual(first.pets[0].id, second.pets[0].id);
assert.equal(second.profile.timezone, "Asia/Shanghai");
const again = await call("demo", {
  method: "POST",
  cookie: a.cookie,
  body: {},
});
assert.equal(again.cookie, a.cookie);
assert.equal((await call("data", { cookie: a.cookie })).data.pets.length, 2);
await call("data", { status: 401 });
await call("data", {
  status: 401,
  cookie: "__sites_local_auth=test_alice",
  headers: {
    "oai-authenticated-user-id": "test_alice",
    "oai-authenticated-user-email": "demo@example.com",
  },
});
await call("data", { status: 401, cookie: "pawday_demo_session=demo_shared" });
await call("pets", {
  method: "POST",
  cookie: b.cookie,
  body: { ...first.pets[0], name: "Not allowed" },
  status: 404,
});
const pet = first.pets[0];
await call("pets", {
  method: "POST",
  cookie: a.cookie,
  body: { ...pet, name: "Visitor A edit" },
});
assert.equal(
  (await call("data", { cookie: a.cookie })).data.pets.find(
    (p) => p.id === pet.id,
  ).name,
  "Visitor A edit",
);
assert.ok(
  !(await call("data", { cookie: b.cookie })).data.pets.some(
    (p) => p.name === "Visitor A edit",
  ),
);
await call("demo", {
  method: "POST",
  body: {},
  headers: { Origin: "https://other.example" },
  status: 403,
});
await call("notifications", { cookie: a.cookie });
console.log(
  `${checks} anonymous demo API checks passed: no login, samples, persistence, visitor separation, legacy-header rejection, and cross-origin protection.`,
);
