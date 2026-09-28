import test from "node:test";
import assert from "node:assert/strict";
import {
  occurrences,
  validateSchedule,
  localParts,
  zonedInstant,
} from "../lib/recurrence.mjs";
const rule = {
  mode: "daily",
  start: "2026-09-26",
  until: "2026-10-02",
  times: ["08:00", "20:00"],
  timezone: "Asia/Seoul",
  interval: 1,
  weekdays: [1],
  count: null,
};
test("7일 하루 두 번 = 14회, 시작일과 종료일 포함", () => {
  const list = occurrences(rule, "2026-09-25T00:00Z", "2026-10-04T00:00Z");
  assert.equal(list.length, 14);
  assert.equal(localParts(list[0], rule.timezone).time, "08:00");
  assert.equal(localParts(list.at(-1), rule.timezone).date, "2026-10-02");
});
test("특정 회차 ID는 다음 회차와 다르다", () => {
  const list = occurrences(rule, "2026-09-25T00:00Z", "2026-10-04T00:00Z");
  const complete = new Set([`petA|${list[0]}`]);
  assert.equal(list.filter((at) => !complete.has(`petA|${at}`)).length, 13);
  assert(!complete.has(`petB|${list[0]}`));
});
test("일광절약시간 전환: 고정 시각과 12시간 간격은 다름", () => {
  const r = {
    ...rule,
    start: "2026-10-31",
    until: "2026-11-02",
    timezone: "America/New_York",
  };
  const fixed = occurrences(r, "2026-10-30T00:00Z", "2026-11-04T00:00Z");
  const hours = occurrences(
    { ...r, mode: "hours", interval: 12, times: ["08:00"] },
    "2026-10-30T00:00Z",
    "2026-11-04T00:00Z",
  );
  assert.notDeepEqual(fixed, hours);
  assert.equal(localParts(hours[2], r.timezone).time, "07:00");
});
test("월 반복은 말일 보정 이후 원래 날짜 복귀", () => {
  const r = {
    ...rule,
    mode: "months",
    start: "2026-01-31",
    until: "2026-03-31",
    times: ["08:00"],
  };
  assert.deepEqual(
    occurrences(r, "2026-01-01T00:00Z", "2026-04-01T00:00Z").map(
      (x) => localParts(x, r.timezone).date,
    ),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
});
test("총 회차 수 제한은 조회 창과 무관", () => {
  const r = { ...rule, until: null, count: 4 };
  assert.equal(
    occurrences(r, "2026-09-28T00:00Z", "2026-10-04T00:00Z").length,
    0,
  );
});
test("N주 요일 반복", () => {
  const r = {
    ...rule,
    mode: "weeks",
    interval: 2,
    start: "2026-09-28",
    until: "2026-10-18",
    times: ["08:00"],
    weekdays: [1, 3],
  };
  assert.equal(
    occurrences(r, "2026-09-27T00:00Z", "2026-10-20T00:00Z").length,
    4,
  );
});
test("복약 필수 정보 누락은 거부", () => {
  assert.throws(
    () =>
      validateSchedule({
        petId: "p",
        title: "약",
        kind: "medicine",
        rule,
        reminder: 0,
        medication: { name: "약", dose: "", unit: "mg", route: "경구" },
      }),
    /투약량/,
  );
  assert.throws(
    () =>
      validateSchedule({
        petId: "p",
        title: "약",
        kind: "medicine",
        rule: { ...rule, until: null },
        reminder: 0,
        medication: { name: "약", dose: "1", unit: "mg", route: "경구" },
      }),
    /종료일/,
  );
});
test("DST 없는 시각은 null, 중복 시각은 첫 번째", () => {
  assert.equal(zonedInstant("2026-03-08", "02:30", "America/New_York"), null);
  assert.equal(
    new Date(
      zonedInstant("2026-11-01", "01:30", "America/New_York"),
    ).toISOString(),
    "2026-11-01T05:30:00.000Z",
  );
});
test("이후 회차 분할은 이전 시각을 중복 생성하지 않고 총 횟수를 지킴", () => {
  const r = {
    ...rule,
    until: null,
    count: 3,
    notBefore: "2026-09-26T11:00:00.000Z",
  };
  const x = occurrences(r, "2026-09-25T00:00Z", "2026-10-04T00:00Z");
  assert.equal(x.length, 3);
  assert.equal(x[0], r.notBefore);
});
