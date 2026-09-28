"use client";
import FileInput from "./file-input";
import NotificationControls from "./notification-controls";
import LanguageSelect from "./language-select";
import {
  t,
  errorText,
  useLocalizedValidation,
  useLanguage,
  getLocale,
  dayLabels,
} from "../lib/i18n";
import { useState, useEffect } from "react";
import {
  FileText,
  Upload,
  Camera,
  Bell,
  Check,
  ArrowUpRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { api, Field } from "./pet-app";
import { localParts, addDays } from "../lib/recurrence.mjs";
const labels: Record<string, string> = {
  petName: "반려동물 이름",
  hospital: "병원 이름",
  visitDate: "방문일",
  finding: "병명 또는 소견",
  medicineName: "약 이름",
  dose: "1회 투약량",
  unit: "단위",
  route: "투여 방법",
  frequency: "복용 빈도",
  duration: "복용 기간",
  nextVisit: "다음 방문·접종 예정일",
  warnings: "주의사항",
};
export function useNotificationBridge() {
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        if (!active) return;
        await api("notifications");
        if (
          localStorage.getItem("pawday-device") === "on" &&
          "serviceWorker" in navigator &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          const registration = await navigator.serviceWorker.register("/sw.js");
          registration.active?.postMessage({
            type: "CHECK_NOTIFICATIONS",
            language: getLocale(),
          });
        }
      } catch {
        /* Settings exposes connectivity failures; no claim of successful delivery. */
      }
    }
    poll();
    const timer = setInterval(poll, 30000);
    window.addEventListener("focus", poll);
    window.addEventListener("care-changed", poll);
    window.addEventListener("pawday-language-changed", poll);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", poll);
      window.removeEventListener("care-changed", poll);
      window.removeEventListener("pawday-language-changed", poll);
    };
  }, []);
  return null;
}
export function ExtraPages({
  page,
  data,
  filter,
  zone,
  run,
  busy,
  setModal,
}: any) {
  const [language, changeLanguage] = useLanguage();
  const [name, setName] = useState(data.profile?.name || data.user.name),
    [tz, setTz] = useState(zone),
    [notices, setNotices] = useState<any>(null),
    [error, setError] = useState(""),
    [uploadPet, setUploadPet] = useState(
      filter === "all" ? data.pets[0]?.id : filter,
    ),
    [file, setFile] = useState<File | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (["settings", "notifications", "documents"].includes(page))
      api("notifications")
        .then(setNotices)
        .catch((e) => setError(e.message));
  }, [page, data]);
  const filtered = (collection: any[]) =>
      collection.filter((x: any) => filter === "all" || x.pet_id === filter),
    petName = (id: string) =>
      data.pets.find((p: any) => p.id === id)?.name || t("반려동물");
  if (page === "settings" || page === "notifications")
    return (
      <div className="extra-grid">
        {page === "settings" ? (
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api("data", "POST", { name, timezone: tz }));
            }}
          >
            <h2>{t("내 프로필")}</h2>
            <Field label={t("언어")}>
              <LanguageSelect />
            </Field>
            <p className="muted">
              {t(
                "이 기기에 저장되며 다음 접속에도 유지됩니다. 입력한 이름과 문서 원문은 번역하지 않습니다.",
              )}
            </p>
            <p className="subtext">{data.user.email}</p>
            <Field label={t("이름")}>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label={t("시간대 (IANA)")}>
              <input
                required
                value={tz}
                onChange={(e) => setTz(e.target.value)}
              />
            </Field>
            <p className="muted">
              {t(
                "시간대 변경은 화면 표시와 새 일정의 기본값에 적용됩니다. 기존 일정은 등록 당시 시간대를 유지합니다.",
              )}
            </p>
            <button className="primary wide" disabled={busy}>
              {t("프로필 저장")}
            </button>
          </form>
        ) : (
          <section className="panel">
            <h2>{t("앱 내부 알림")}</h2>
            <p className="subtext">
              {t("앱을 열면 최근 7일의 알림을 동기화합니다.")}
            </p>
            {!notices ? (
              <p>{t("불러오는 중…")}</p>
            ) : !notices.items.length ? (
              <div className="empty">
                <Bell />
                <h3>{t("새로운 알림이 없어요")}</h3>
                <p>{t("일정 시간이 되면 여기에 표시됩니다.")}</p>
              </div>
            ) : (
              notices.items.map((n: any) => (
                <article className="notification" key={n.id}>
                  <Bell size={19} />
                  <div>
                    <strong>{n.title}</strong>
                    <p>
                      {new Date(n.due).toLocaleString(getLocale(), {
                        timeZone: zone,
                      })}
                    </p>
                  </div>
                  {n.state === "read" ? (
                    <Check size={18} />
                  ) : (
                    <button
                      onClick={async () => {
                        if (
                          await run(() =>
                            api("notifications", "POST", {
                              id: n.id,
                              action: "read",
                            }),
                          )
                        )
                          setNotices(await api("notifications"));
                      }}
                    >
                      {t("읽음")}
                    </button>
                  )}
                </article>
              ))
            )}
          </section>
        )}
        <section className="panel">
          <h2>{t("기기 알림 설정")}</h2>
          <NotificationControls />
          <div className="rule-note">
            <strong>{t("앱을 닫은 상태의 알림")}</strong>
            {notices?.pushConfigured
              ? t(
                  "웹 푸시 키 설정됨. 별도 정기 발송 서비스가 실행되어야 수신됩니다.",
                )
              : t("미연결 · 웹 푸시 키와 정기 발송 서비스 연결이 필요합니다.")}
            <br />
            {t(
              "iPhone/iPad는 홈 화면에 추가한 웹앱에서 권한을 허용해야 합니다. 소리·진동은 운영체제 설정을 따르며, 정시 알람이나 반복 울림을 보장하지 않습니다.",
            )}
          </div>
          <p className="muted">
            {t("알림 발송 상태와 실제 기기 수신은 다릅니다. 문서 분석:")}
            {notices?.aiConfigured
              ? t("API 키 설정됨 (실제 분석은 문서별 실행)")
              : t("AI 미연결 · 수동 입력 사용")}
          </p>
          {message && <p className="success">{t(message)}</p>}
          {error && <p className="error">{errorText(error)}</p>}
        </section>
      </div>
    );
  if (page === "documents")
    return (
      <>
        <div className="upload-panel panel">
          <div>
            <span className="upload-icon">
              <Upload size={28} />
            </span>
            <h2>{t("진료 기록을 안전하게 보관하세요")}</h2>
            <p className="subtext">
              {t("진단서 · 처방전 · 예방접종 기록")}
              <br />
              {t("JPEG, PNG, WebP, PDF · 최대 10MB")}
            </p>
            <span className="connection">
              <ShieldCheck size={16} />
              {t("본인만 원본에 접근할 수 있습니다")}
            </span>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!file) return;
              const fd = new FormData();
              fd.set("file", file);
              fd.set("petId", uploadPet);
              fd.set("purpose", "document");
              await run(async () => {
                const d = await api("documents", "POST", fd);
                setMessage(
                  d.duplicate
                    ? t("이미 보관한 문서입니다. 기존 문서를 확인하세요.")
                    : t(
                        "원본을 저장했습니다. 분석 또는 직접 검토를 선택하세요.",
                      ),
                );
                setFile(null);
              });
            }}
          >
            <Field label={t("누구의 문서인가요?")}>
              <select
                required
                value={uploadPet || ""}
                onChange={(e) => setUploadPet(e.target.value)}
              >
                <option value="">{t("반려동물 선택")}</option>
                {data.pets.map((p: any) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("파일 선택")}>
              <FileInput
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
            <label className="camera-button">
              <Camera size={17} />
              {t("카메라로 촬영")}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            {file && (
              <p className="muted">
                {t("선택됨:")}
                {file.name}
              </p>
            )}
            <button
              className="primary wide"
              disabled={busy || !file || !uploadPet}
            >
              {busy ? t("업로드 중…") : t("원본 업로드")}
            </button>
          </form>
        </div>
        <div className="notice">
          {notices?.aiConfigured
            ? t(
                "AI 연결 설정이 있습니다. 분석 시 문서가 OpenAI API로 전송됩니다.",
              )
            : t(
                "AI 미연결: 자동 추출 결과를 만들지 않습니다. 원본을 보며 직접 입력할 수 있습니다.",
              )}
        </div>
        {message && <p className="success">{t(message)}</p>}
        <div className="document-grid">
          {filtered(data.documents).map((d: any) => (
            <article className="panel document-card" key={d.id}>
              <FileText size={27} />
              <span className="tag">
                {
                  (
                    {
                      uploaded: t("업로드됨"),
                      review: t("검토 필요"),
                      confirmed: t("검토 확정"),
                      failed: t("분석 실패"),
                      analyzing: t("분석 중"),
                    } as any
                  )[d.status]
                }
              </span>
              <h3>{d.name}</h3>
              <p>
                {petName(d.pet_id)} · {d.created.slice(0, 10)}
              </p>
              <div className="button-row">
                <a
                  className="button"
                  href={"/api/files/" + d.id}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("원본 보기")}
                  <ArrowUpRight size={14} />
                </a>
                <button
                  onClick={() => setModal({ type: "review", document: d })}
                >
                  {d.status === "confirmed" ? t("기록 확인") : t("직접 검토")}
                </button>
              </div>
              {d.status !== "confirmed" && (
                <button
                  className="text-button analyze"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api(`documents/${d.id}/analyze`, "POST");
                      setMessage(
                        t(
                          "분석 처리가 끝났습니다. 문서의 검토 버튼을 눌러 확인하세요.",
                        ),
                      );
                    }, t("분석 처리 완료"))
                  }
                >
                  {d.status === "failed"
                    ? t("분석 재시도")
                    : notices?.aiConfigured
                      ? t("AI로 내용 추출")
                      : t("수동 입력 준비")}
                </button>
              )}
              {d.status === "confirmed" && (
                <button
                  className="primary wide"
                  onClick={() =>
                    setModal({ type: "document-schedule", document: d })
                  }
                >
                  {t("확인한 내용으로 일정 만들기")}
                </button>
              )}
            </article>
          ))}
        </div>
        {!data.documents.length && (
          <div className="empty">
            <FileText />
            <h3>{t("아직 보관한 문서가 없어요")}</h3>
            <p>{t("첫 문서를 업로드해 건강 기록을 시작하세요.")}</p>
          </div>
        )}
      </>
    );
  return (
    <div className="timeline">
      {filtered(data.records)
        .sort((a: any, b: any) => b.created.localeCompare(a.created))
        .map((r: any) => {
          const f = r.fields || {},
            doc = data.documents.find((d: any) => d.id === r.document_id);
          return (
            <article className="timeline-item panel" key={r.id}>
              <div className="record-heading">
                <span>
                  <Clock size={16} />{" "}
                  {f.visitDate?.value || r.created.slice(0, 10)}
                </span>
                <strong>{petName(r.pet_id)}</strong>
              </div>
              <h2>{f.hospital?.value || t("병원 이름 확인 필요")}</h2>
              <p>{f.finding?.value || t("소견 확인 필요")}</p>
              {f.medicineName?.value && (
                <p className="medication-note">
                  {t("약:")}
                  {f.medicineName.value} ·{" "}
                  {f.dose?.value || t("투약량 확인 필요")} {f.unit?.value || ""}
                </p>
              )}
              <div className="button-row">
                <a
                  className="button"
                  href={"/api/files/" + r.document_id}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("원본 문서")}
                </a>
                <button
                  onClick={() => setModal({ type: "review", document: doc })}
                >
                  {t("기록 검토·수정")}
                </button>
                <button
                  onClick={() =>
                    setModal({ type: "document-schedule", document: doc })
                  }
                >
                  {t("일정 만들기")}
                </button>
              </div>
            </article>
          );
        })}
      {!filtered(data.records).length && (
        <div className="panel empty">
          <FileText />
          <h3>{t("아직 확정된 건강 기록이 없어요")}</h3>
          <p>{t("문서 보관함에서 원본을 검토하고 기록을 확정하세요.")}</p>
        </div>
      )}
    </div>
  );
}
export function DocumentReview({ modal, data, busy, run, close }: any) {
  const d = modal.document,
    [fields, setFields] = useState(d?.fields || {}),
    [checked, setChecked] = useState(false);
  if (!d) return <p>{t("문서를 찾을 수 없습니다.")}</p>;
  if (modal.type === "document-schedule")
    return (
      <DocumentSchedule
        document={d}
        data={data}
        busy={busy}
        run={run}
        close={close}
      />
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await run(
            () =>
              api(`documents/${d.id}/confirm`, "POST", {
                fields,
                reviewed: checked,
              }),
            t("건강 기록을 확정했습니다"),
          )
        )
          close();
      }}
    >
      <p className="eyebrow">{t("문서 검토")}</p>
      <h2>{t("원본과 비교해 확인해주세요")}</h2>
      <div className="notice">
        {d.mode === "ai"
          ? t("AI 추출 초안입니다. 원본과 다를 수 있으니 확인하세요.")
          : t("AI 미연결 또는 수동 검토 · 입력되지 않은 값은 확인 필요입니다.")}
        {t("자동으로 복약 일정이 생성되지 않습니다.")}
      </div>
      <a
        className="button"
        href={"/api/files/" + d.id}
        target="_blank"
        rel="noreferrer"
      >
        {t("원본 문서 열기")}
        <ArrowUpRight size={16} />
      </a>
      <div className="review-fields">
        {Object.entries(labels).map(([key, label]) => (
          <div className="review-field" key={key}>
            <Field label={t(label)}>
              <input
                value={fields[key]?.value || ""}
                placeholder={t("확인 필요")}
                onChange={(e) =>
                  setFields({
                    ...fields,
                    [key]: {
                      ...fields[key],
                      value: e.target.value,
                      evidence: fields[key]?.evidence || "",
                      uncertain: !e.target.value.trim(),
                    },
                  })
                }
              />
            </Field>
            <p className={fields[key]?.uncertain ? "uncertain" : ""}>
              {fields[key]?.evidence
                ? t("원문: ") + fields[key].evidence
                : t("근거 원문 없음 · 직접 확인 필요")}
            </p>
          </div>
        ))}
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          required
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        {t("원본과 대조했으며, 비어 있는 항목은 확인 필요로 남깁니다.")}
      </label>
      <button className="primary wide" disabled={busy || !checked}>
        {t("확정 건강 기록 저장")}
      </button>
    </form>
  );
}
function DocumentSchedule({ document: d, data, busy, run, close }: any) {
  const f = d.fields || {},
    [kind, setKind] = useState("medicine"),
    [name, setName] = useState(
      f.medicineName?.uncertain ? "" : f.medicineName?.value || "",
    ),
    [dose, setDose] = useState(f.dose?.uncertain ? "" : f.dose?.value || ""),
    [unit, setUnit] = useState(f.unit?.uncertain ? "" : f.unit?.value || ""),
    [route, setRoute] = useState(
      f.route?.uncertain ? "" : f.route?.value || "",
    ),
    [start, setStart] = useState(""),
    [times, setTimes] = useState(""),
    [days, setDays] = useState(""),
    [checked, setChecked] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const zone = data.profile?.timezone || "Asia/Seoul",
          schedule = {
            petId: d.pet_id,
            title:
              kind === "medicine"
                ? name + t(" 복용")
                : kind === "vaccine"
                  ? t("예방접종")
                  : t("병원 재방문"),
            kind,
            rule: {
              mode: kind === "medicine" ? "daily" : "once",
              start,
              times: times.split(",").map((t) => t.trim()),
              timezone: zone,
              interval: 1,
              weekdays: [],
              count: null,
              until:
                kind === "medicine" ? addDays(start, Number(days) - 1) : null,
            },
            medication:
              kind === "medicine"
                ? { name, dose, unit, route, warnings: f.warnings?.value || "" }
                : null,
            notify: true,
            reminder: 0,
            notes: t("원본 문서에서 검토 후 생성"),
          };
        if (
          await run(async () => {
            const r = await api(`documents/${d.id}/schedule`, "POST", {
              reviewed: checked,
              schedule,
            });
            if (r.duplicate)
              throw Error(
                t(
                  "이미 이 문서에서 같은 일정을 생성했습니다. 캘린더를 확인하세요.",
                ),
              );
          }, t("일정을 생성했습니다"))
        )
          close();
      }}
    >
      <p className="eyebrow">{t("확인된 돌봄")}</p>
      <h2>{t("필요한 일정만 직접 선택하세요")}</h2>
      <p className="subtext">
        {t("문서의 빈도:")}
        {f.frequency?.value || t("확인 필요")}
        <br />
        {t("문서의 기간:")}
        {f.duration?.value || t("확인 필요")}
        <br />
        {t("다음 방문일:")}
        {f.nextVisit?.value || t("확인 필요")}
      </p>
      <Field label={t("생성할 일정")}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="medicine">{t("약 복용")}</option>
          <option value="visit">{t("병원 재방문")}</option>
          <option value="vaccine">{t("예방접종")}</option>
        </select>
      </Field>
      {kind === "medicine" && (
        <>
          <Field label={t("약 이름 *")}>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label={t("1회 투약량 *")}>
              <input
                required
                value={dose}
                onChange={(e) => setDose(e.target.value)}
              />
            </Field>
            <Field label={t("단위 *")}>
              <input
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("투여 방법 *")}>
            <input
              required
              value={route}
              onChange={(e) => setRoute(e.target.value)}
            />
          </Field>
        </>
      )}
      <div className="form-grid">
        <Field label={t("시작일 *")}>
          <input
            required
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        {kind === "medicine" && (
          <Field label={t("복용 기간 (일) *")}>
            <input
              required
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </Field>
        )}
      </div>
      <Field label={t("시각 * (예: 08:00, 20:00)")}>
        <input
          required
          placeholder={t("확인한 시각을 직접 입력")}
          value={times}
          onChange={(e) => setTimes(e.target.value)}
        />
      </Field>
      <p className="rule-note">
        {t(
          "시간 간격·요일·월 반복이 필요하면 일반 일정 추가에서 이 문서를 연결하세요. 의료 정보나 복약 주기는 앱이 임의로 정하지 않습니다.",
        )}
      </p>
      <label className="check-label">
        <input
          required
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        {t("투약량·시간·기간을 확인했습니다.")}
      </label>
      <button className="primary wide" disabled={busy || !checked}>
        {t("선택한 일정 생성")}
      </button>
    </form>
  );
}
