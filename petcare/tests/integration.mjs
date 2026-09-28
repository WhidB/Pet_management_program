import assert from "node:assert/strict";
import { localParts, addDays } from "../lib/recurrence.mjs";
const base = "http://localhost:5173",
  suffix = Date.now(),
  today = localParts(Date.now(), "Asia/Seoul").date;
let checks = 0;
const ok = (condition, message) => {
  assert(condition, message);
  checks++;
  console.log("PASS " + message);
};
async function request(
  path,
  method = "GET",
  body,
  actor = "test_alice",
  expected = 200,
) {
  const response = await fetch(base + "/api/" + path, {
    method,
    headers: {
      ...(actor ? { Cookie: `__sites_local_auth=${actor}` } : {}),
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      Origin: base,
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("json")
    ? await response.json()
    : await response.text();
  assert.equal(response.status, expected, JSON.stringify({ path, data }));
  return data;
}
const petA = await request("pets", "POST", {
    name: "테스트 두부 " + suffix,
    species: "dog",
    weight: "4.2",
  }),
  petB = await request("pets", "POST", {
    name: "테스트 나비 " + suffix,
    species: "cat",
    weight: "3.1",
  });
const rule = {
  mode: "daily",
  start: today,
  until: addDays(today, 6),
  times: ["08:00", "20:00"],
  timezone: "Asia/Seoul",
  interval: 1,
  weekdays: [1],
  count: null,
};
const schedule = {
  petId: petA.id,
  title: "테스트 복약",
  kind: "medicine",
  rule,
  medication: { name: "테스트약", dose: "1", unit: "정", route: "경구" },
  notify: true,
  reminder: 0,
};
const saved = await request("schedules", "POST", schedule),
  walk = await request("schedules", "POST", {
    ...schedule,
    petId: petB.id,
    title: "테스트 산책",
    kind: "walk",
    medication: null,
  });
const from = new Date(Date.now() - 86400000).toISOString(),
  to = new Date(Date.now() + 86400000 * 9).toISOString();
const query = `occurrences?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
let list = await request(query),
  mine = list.filter((x) => x.scheduleId === saved.id);
ok(mine.length === 14, "복약 7일 하루 2회 14회");
ok(
  list.find((x) => x.scheduleId === walk.id).petName.includes("나비") &&
    mine[0].petName.includes("두부"),
  "반려동물 두 마리 구분",
);
await request("occurrences", "POST", {
  scheduleId: saved.id,
  at: mine[0].originalAt,
  status: "complete",
});
list = await request(query);
ok(
  list.filter((x) => x.scheduleId === saved.id && x.status === "complete")
    .length === 1 &&
    list.filter((x) => x.scheduleId === saved.id && x.status === "pending")
      .length === 13,
  "한 회차만 완료, 나머지 13회 유지",
);
const changed = mine[1],
  newAt = new Date(Date.now() - 60000).toISOString();
await request("schedules", "PATCH", {
  id: saved.id,
  version: 1,
  scope: "one",
  at: changed.originalAt,
  newAt,
  data: { ...schedule, title: "수정된 복약" },
});
list = await request(query);
ok(
  list.find(
    (x) => x.originalAt === changed.originalAt && x.scheduleId === saved.id,
  ).title === "수정된 복약",
  "개별 회차 수정",
);
let notices = await request("notifications");
const due = notices.items.find(
  (x) => x.schedule_id === saved.id && x.at === changed.originalAt,
);
ok(!!due && due.title.includes("수정된 복약"), "수정된 알림 내용 동기화");
const claim1 = await request("notifications", "POST", {
    id: due.id,
    action: "claim",
  }),
  claim2 = await request("notifications", "POST", {
    id: due.id,
    action: "claim",
  });
ok(claim1.claimed && !claim2.claimed, "중복 기기 알림 원자적 차단");
await request("schedules", "DELETE", { id: saved.id });
notices = await request("notifications");
ok(
  !notices.items.some((x) => x.schedule_id === saved.id),
  "삭제된 일정 알림 취소",
);
await request(
  "schedules",
  "POST",
  { ...schedule, medication: { ...schedule.medication, dose: "" } },
  "test_alice",
  400,
);
ok(true, "불명확한 투약량 일정 생성 차단");
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/wS0AAAAASUVORK5CYII=",
    "base64",
  ),
);
function upload() {
  const form = new FormData();
  form.set("petId", petA.id);
  form.set(
    "file",
    new File([png], "test-prescription.png", { type: "image/png" }),
  );
  return form;
}
const doc = await request("documents", "POST", upload());
const duplicate = await request("documents", "POST", upload());
ok(
  doc.id === duplicate.id && duplicate.duplicate,
  "중복 문서는 동일 원본 재사용",
);
await request(
  `documents/${doc.id}/schedule`,
  "POST",
  { reviewed: true, schedule },
  "test_alice",
  409,
);
ok(true, "검토 전 일정 자동 생성 차단");
await request(`documents/${doc.id}/analyze`, "POST");
let d = (await request("data")).documents.find((x) => x.id === doc.id);
ok(
  d.mode === "manual" &&
    Object.values(d.fields).every((x) => x.uncertain && !x.value),
  "AI 미연결은 추측 없는 수동 확인 필요",
);
await request(`documents/${doc.id}/confirm`, "POST", {
  reviewed: true,
  fields: d.fields,
});
await request(
  `documents/${doc.id}/schedule`,
  "POST",
  {
    reviewed: true,
    schedule: {
      ...schedule,
      medication: { name: "", dose: "", unit: "", route: "" },
    },
  },
  "test_alice",
  400,
);
ok(true, "읽지 못한 복약 정보로 일정 생성 차단");
const ds = await request(`documents/${doc.id}/schedule`, "POST", {
  reviewed: true,
  schedule,
});
const ds2 = await request(`documents/${doc.id}/schedule`, "POST", {
  reviewed: true,
  schedule,
});
ok(ds.id === ds2.id && ds2.duplicate, "문서 일정 중복 생성 차단");
await request(`files/${doc.id}`, "GET", undefined, "test_bob", 404);
await request(
  `documents/${doc.id}/confirm`,
  "POST",
  { reviewed: true, fields: {} },
  "test_bob",
  404,
);
await request(
  "schedules",
  "POST",
  { ...schedule, petId: petA.id },
  "test_bob",
  404,
);
const bob = await request("data", "GET", undefined, "test_bob");
ok(
  !bob.pets.some((x) => x.id === petA.id) &&
    !bob.records.some((x) => x.document_id === doc.id),
  "다른 사용자의 반려동물·문서·건강 기록 접근 차단",
);
await request("data", "GET", undefined, null, 401);
ok(true, "미인증 접근 차단");
const reload = await request("data");
ok(
  reload.pets.some((x) => x.id === petA.id) &&
    reload.records.some((x) => x.document_id === doc.id),
  "재요청 후 저장 데이터 유지",
);
const bad = new FormData();
bad.set("petId", petA.id);
bad.set(
  "file",
  new File(["<script>bad</script>"], "fake.png", { type: "image/png" }),
);
await request("documents", "POST", bad, "test_alice", 400);
ok(true, "파일 확장자 위조 차단");
console.log(
  `\n${checks} integration checks passed. Test identities are local-only; no production records created.`,
);
