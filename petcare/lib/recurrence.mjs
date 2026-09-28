const DAY = 86400000,
  formatters = new Map();
export function localParts(instant, zone) {
  if (!formatters.has(zone))
    formatters.set(
      zone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  const p = Object.fromEntries(
    formatters
      .get(zone)
      .formatToParts(new Date(instant))
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function zonedInstant(date, time, zone) {
  const target = Date.parse(`${date}T${time}:00Z`);
  let guess = target;
  for (let i = 0; i < 5; i++) {
    const p = localParts(guess, zone),
      delta = target - Date.parse(`${p.date}T${p.time}:00Z`);
    if (!delta) break;
    guess += delta;
  }
  const matches = [];
  for (const offset of [-7200000, -3600000, 0, 3600000, 7200000]) {
    const t = guess + offset,
      p = localParts(t, zone);
    if (p.date === date && p.time === time) matches.push(t);
  }
  return matches.length ? Math.min(...matches) : null;
}
export function addDays(date, days) {
  return new Date(Date.parse(date + "T12:00:00Z") + days * DAY)
    .toISOString()
    .slice(0, 10);
}
export function validateRule(r) {
  const dateOK = (d) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d;
  if (
    !r ||
    !["once", "daily", "weekly", "days", "weeks", "months", "hours"].includes(
      r.mode,
    )
  )
    throw Error("반복 방식을 선택하세요.");
  if (!dateOK(r.start)) throw Error("올바른 시작일을 입력하세요.");
  try {
    localParts(Date.now(), r.timezone);
  } catch {
    throw Error("올바른 IANA 시간대를 선택하세요.");
  }
  if (
    !Array.isArray(r.times) ||
    !r.times.length ||
    r.times.length > 24 ||
    r.times.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))
  )
    throw Error("실행 시각을 입력하세요.");
  if (new Set(r.times).size !== r.times.length)
    throw Error("중복된 시각입니다.");
  if (["once", "hours"].includes(r.mode) && r.times.length !== 1)
    throw Error("시작 시각은 하나만 입력하세요.");
  if (!Number.isInteger(r.interval) || r.interval < 1 || r.interval > 365)
    throw Error("반복 간격은 1~365 정수입니다.");
  if (
    ["weekly", "weeks"].includes(r.mode) &&
    (!Array.isArray(r.weekdays) ||
      !r.weekdays.length ||
      r.weekdays.some((x) => !Number.isInteger(x) || x < 0 || x > 6))
  )
    throw Error("요일을 선택하세요.");
  if (r.until && (!dateOK(r.until) || r.until < r.start))
    throw Error("종료일은 시작일 이후여야 합니다.");
  if (
    r.count != null &&
    (!Number.isInteger(r.count) || r.count < 1 || r.count > 10000)
  )
    throw Error("횟수는 1~10000회입니다.");
  if (r.until && r.count) throw Error("종료일 또는 횟수 중 하나를 선택하세요.");
  if (zonedInstant(r.start, r.times[0], r.timezone) === null)
    throw Error("일광절약시간 전환으로 존재하지 않는 시작 시각입니다.");
  return r;
}
export function occurrences(r, from, to, cap = 10000) {
  validateRule(r);
  const lo = +new Date(from),
    hi = +new Date(to),
    out = [];
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo)
    throw Error("조회 기간 오류");
  const count = r.count || Infinity,
    end = r.until
      ? zonedInstant(addDays(r.until, 1), "00:00", r.timezone)
      : Infinity;
  let seen = 0;
  const accept = (t) => {
    if (
      t == null ||
      t >= end ||
      seen >= count ||
      (r.notBefore && t < Date.parse(r.notBefore))
    )
      return;
    seen++;
    if (t >= lo && t < hi) out.push(new Date(t).toISOString());
  };
  let anchor = zonedInstant(r.start, r.times[0], r.timezone);
  if (r.mode === "hours" && r.notBefore) {
    const step = r.interval * 3600000;
    anchor +=
      Math.max(0, Math.ceil((Date.parse(r.notBefore) - anchor) / step)) * step;
  }
  if (r.mode === "once") {
    accept(anchor);
    return out;
  }
  if (r.mode === "hours") {
    const step = r.interval * 3600000,
      first = Math.max(0, Math.ceil((lo - anchor) / step));
    for (
      let n = first;
      n < count && anchor + n * step < Math.min(hi, end);
      n++
    ) {
      out.push(new Date(anchor + n * step).toISOString());
      if (out.length >= cap) throw Error("조회 기간을 줄이세요.");
    }
    return out;
  }
  const finish = localParts(hi + DAY, r.timezone).date,
    [sy, sm, sd] = r.start.split("-").map(Number),
    startDay = new Date(r.start + "T12:00:00Z").getUTCDay();
  for (
    let date = r.start, n = 0;
    date <= finish && (!r.until || date <= r.until) && seen < count;
    date = addDays(date, 1), n++
  ) {
    if (n > 366 * 150) throw Error("계산 범위를 초과했습니다.");
    const d = new Date(date + "T12:00:00Z");
    let match = false;
    if (r.mode === "daily") match = true;
    if (r.mode === "days") match = n % r.interval === 0;
    if (["weekly", "weeks"].includes(r.mode))
      match =
        r.weekdays.includes(d.getUTCDay()) &&
        Math.floor((n + ((startDay + 6) % 7)) / 7) %
          (r.mode === "weekly" ? 1 : r.interval) ===
          0;
    if (r.mode === "months") {
      const diff = (d.getUTCFullYear() - sy) * 12 + d.getUTCMonth() + 1 - sm,
        last = new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
        ).getUTCDate();
      match = diff % r.interval === 0 && d.getUTCDate() === Math.min(sd, last);
    }
    if (match)
      for (const time of [...r.times].sort())
        accept(zonedInstant(date, time, r.timezone));
    if (out.length >= cap) throw Error("조회 기간을 줄이세요.");
  }
  return out;
}
export function validateSchedule(d) {
  if (
    !d.petId ||
    typeof d.title !== "string" ||
    !d.title.trim() ||
    d.title.length > 120
  )
    throw Error("반려동물과 일정 제목이 필요합니다.");
  if (
    ![
      "meal",
      "walk",
      "bath",
      "groom",
      "vaccine",
      "checkup",
      "visit",
      "medicine",
      "other",
    ].includes(d.kind)
  )
    throw Error("일정 종류를 선택하세요.");
  validateRule(d.rule);
  if (!Number.isInteger(d.reminder) || d.reminder < 0 || d.reminder > 10080)
    throw Error("사전 알림은 0~10080분입니다.");
  if (d.kind === "medicine") {
    const m = d.medication;
    if (
      !m ||
      !m.name?.trim() ||
      !m.dose?.trim() ||
      !m.unit?.trim() ||
      !m.route?.trim() ||
      [m.name, m.dose, m.unit, m.route].some((x) =>
        /^(확인 필요|unknown|needs review|n\/a|불명|미확인)$/i.test(x.trim()),
      )
    )
      throw Error("약 이름, 투약량, 단위, 투여 방법을 확인하세요.");
    if (!d.rule.until && !d.rule.count && d.rule.mode !== "once")
      throw Error("복약 종료일 또는 총 횟수를 입력하세요.");
  }
  return d;
}
