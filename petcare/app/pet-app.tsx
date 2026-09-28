"use client";
import FileInput from "./file-input";
import UserGuide from "./user-guide";
import LanguageSelect from "./language-select";
import NotificationControls from "./notification-controls";
import {
  t,
  errorText,
  useLocalizedValidation,
  useLanguage,
  useLanguageReady,
  getLocale,
  dayLabels,
} from "../lib/i18n";
import { useState, useEffect, useCallback } from "react";
import {
  PawPrint,
  House,
  CalendarDays,
  HeartPulse,
  FileText,
  Bell,
  Plus,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Settings,
  Sun,
  Clock,
  Upload,
  Stethoscope,
  Pill,
  Footprints,
  Utensils,
  MoreHorizontal,
} from "lucide-react";
import {
  localParts,
  addDays,
  occurrences,
  zonedInstant,
} from "../lib/recurrence.mjs";
import { useWebMCP } from "../lib/webmcp";
type Obj = Record<string, any>;
const kinds: Obj = {
  meal: "식사",
  walk: "산책",
  bath: "목욕",
  groom: "미용",
  vaccine: "예방접종",
  checkup: "건강검진",
  visit: "병원 방문",
  medicine: "약 복용",
  other: "기타",
};
const modes: Obj = {
  once: "한 번",
  daily: "매일 지정 시각",
  weekly: "특정 요일",
  days: "N일마다",
  weeks: "N주마다",
  months: "N개월마다",
  hours: "시작부터 N시간마다",
};
const icons: Obj = {
  meal: Utensils,
  walk: Footprints,
  medicine: Pill,
  visit: Stethoscope,
  checkup: HeartPulse,
};
export async function api(
  path: string,
  method = "GET",
  body?: any,
): Promise<any> {
  const r = await fetch("/api/" + path, {
    method,
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data: any = await r.json();
  if (!r.ok) throw Error(data.error || "요청에 실패했습니다.");
  return data;
}
const petEmoji = (p: Obj) =>
  p.species === "cat" ? "🐈" : p.species === "dog" ? "🐕" : "🐾";
function Avatar({ pet, small = false }: { pet: Obj; small?: boolean }) {
  return (
    <span className={"avatar " + (small ? "small" : "")}>
      {pet.photoId ? (
        <img alt={pet.name} src={"/api/files/" + pet.photoId} />
      ) : (
        petEmoji(pet)
      )}
    </span>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <PawPrint size={34} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export default function PetApp() {
  useLanguage();
  const languageReady = useLanguageReady();
  useLocalizedValidation();
  useNotificationBridge();
  const [data, setData] = useState<Obj | null>(null),
    [items, setItems] = useState<Obj[]>([]),
    [page, setPage] = useState("home"),
    [filter, setFilter] = useState("all"),
    [date, setDate] = useState(localParts(Date.now(), "Asia/Seoul").date),
    [modal, setModal] = useState<Obj | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [loading, setLoading] = useState(true);
  const zone = data?.profile?.timezone || "Asia/Seoul";
  const today = localParts(Date.now(), zone).date;
  const reload = useCallback(async () => {
    try {
      const d = await api("data");
      setData(d);
      const z = d.profile?.timezone || "Asia/Seoul";
      const anchor =
        page === "calendar" ? date : localParts(Date.now(), z).date;
      const start = anchor.slice(0, 7) + "-01",
        end = addDays(start, 62);
      setItems(
        await api(
          `occurrences?from=${encodeURIComponent(new Date(zonedInstant(start, "00:00", z)!).toISOString())}&to=${encodeURIComponent(new Date(zonedInstant(end, "00:00", z)!).toISOString())}`,
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date, page]);
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 60000);
    return () => clearInterval(timer);
  }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const run = async (fn: () => Promise<any>, message = t("저장했습니다")) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
      window.dispatchEvent(new Event("care-changed"));
      setToast(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const visible = items.filter((i) => filter === "all" || i.petId === filter),
    daily = visible.filter(
      (i) =>
        localParts(i.at, zone).date === (page === "calendar" ? date : today),
    ),
    complete = daily.filter((i) => i.status === "complete").length;
  const openSchedule = () => {
    if (!data?.pets.length) {
      setModal({ type: "pet" });
      return;
    }
    setModal({ type: "schedule" });
  };
  const readOverview = useCallback(
    () => ({
      pets: (data?.pets || []).map((p: Obj) => ({
        id: p.id,
        name: p.name,
        species: p.species,
      })),
      occurrences: items.map((i) => ({
        scheduleId: i.scheduleId,
        at: i.at,
        petName: i.petName,
        title: i.title,
        status: i.status,
      })),
    }),
    [data, items],
  );
  const startForm = useCallback(
    () => setModal({ type: data?.pets.length ? "schedule" : "pet" }),
    [data],
  );
  useWebMCP(readOverview, startForm);
  const nav = [
    ["home", t("오늘"), House],
    ["calendar", t("캘린더"), CalendarDays],
    ["pets", t("반려동물"), PawPrint],
    ["health", t("건강 기록"), HeartPulse],
    ["documents", t("문서 보관함"), FileText],
    ["notifications", t("알림"), Bell],
  ] as const;
  const act = (i: Obj, status: string) =>
    run(
      () =>
        api("occurrences", "POST", {
          scheduleId: i.scheduleId,
          at: i.originalAt,
          status,
        }),
      status === "complete"
        ? t("이번 회차를 완료했습니다")
        : status === "snooze"
          ? t("10분 뒤에 다시 알려드릴게요")
          : t("수행 기록을 변경했습니다"),
    );
  function Task({ item: i }: { item: Obj }) {
    const Icon = icons[i.kind] || CalendarDays;
    return (
      <article className={"task " + (i.status !== "pending" ? "done" : "")}>
        <button
          className="check"
          disabled={busy}
          aria-label={i.status === "complete" ? t("완료 취소") : t("완료")}
          onClick={() =>
            act(i, i.status === "complete" ? "pending" : "complete")
          }
        >
          {i.status === "complete" && <Check size={18} />}
        </button>
        <div className={"task-symbol " + i.kind}>
          <Icon size={21} />
        </div>
        <div className="task-main">
          <div className="task-label">
            <strong>{i.title}</strong>
            <span className="tag">{t(kinds[i.kind])}</span>
          </div>
          <p>
            <span className="pet-dot" />
            {i.petName} <span>·</span> {localParts(i.at, zone).time}
            {i.status === "skipped" ? t(" · 건너뜀") : ""}
            {i.snooze ? t(" · 다시 알림") : ""}
          </p>
          {i.kind === "medicine" && (
            <small>
              {i.medication?.name} · {i.medication?.dose} {i.medication?.unit} ·{" "}
              {i.medication?.route}
            </small>
          )}
        </div>
        <details className="task-menu">
          <summary aria-label={t("일정 작업")}>
            <MoreHorizontal size={22} />
          </summary>
          <div>
            <button onClick={() => setModal({ type: "schedule", item: i })}>
              {t("일정 수정")}
            </button>
            <button onClick={() => act(i, "skipped")}>{t("건너뛰기")}</button>
            <button onClick={() => act(i, "snooze")}>
              {t("10분 뒤 알림")}
            </button>
            <button
              className="danger"
              onClick={() => setModal({ type: "delete", item: i })}
            >
              {t("반복 일정 삭제")}
            </button>
          </div>
        </details>
      </article>
    );
  }
  if (!languageReady)
    return (
      <div className="loading" aria-busy="true">
        <PawPrint />
      </div>
    );
  if (loading)
    return (
      <div className="loading" role="status">
        <PawPrint />
        <p>{t("우리 아이들의 하루를 불러오고 있어요…")}</p>
      </div>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span>
            <PawPrint size={25} />
          </span>
          {t("포데이")}
        </a>
        <p className="nav-label">{t("우리의 하루")}</p>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon size={21} />
              {label}
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div>{t("작은 돌봄, 큰 행복.")}</div>
          <p>
            {t("함께하는 하루를")}
            <br />
            {t("차곡차곡 기록해요.")}
          </p>
          <PawPrint size={35} />
        </div>
        <button className="settings-link" onClick={() => setPage("settings")}>
          <Settings size={19} />
          {t("설정")}
        </button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="mobile-brand">
            <PawPrint />
            {t("포데이")}
          </span>
          <span className="breadcrumb">
            {t("우리의 하루")}
            <span>/</span> {nav.find((n) => n[0] === page)?.[1] || t("설정")}
          </span>
          <div>
            <span className="zone-label">{zone}</span>
            <UserGuide />
            <button
              className="icon-button"
              aria-label={t("알림")}
              onClick={() => setPage("notifications")}
            >
              <Bell size={21} />
            </button>
            <button className="user-chip" onClick={() => setPage("settings")}>
              {(data?.profile?.name || data?.user?.name || t("나")).slice(0, 1)}
            </button>
          </div>
        </header>
        <main>
          <section className="demo-banner" aria-label={t("로컬 앱")}>
            <div>
              <strong>{t("내 컴퓨터의 포데이")}</strong>
              <p>
                {t(
                  "로그인 없이 사용하세요. 반려동물과 일정은 이 컴퓨터에 저장됩니다.",
                )}
              </p>
            </div>
            <LanguageSelect />
          </section>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {new Date(today + "T12:00:00Z").toLocaleDateString(
                  getLocale(),
                  {
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                    timeZone: "UTC",
                  },
                )}
              </p>
              <h1>
                {page === "home"
                  ? t("오늘도, 함께 건강하게")
                  : page === "calendar"
                    ? t("우리의 돌봄 캘린더")
                    : page === "pets"
                      ? t("소중한 우리 아이들")
                      : page === "health"
                        ? t("건강 기록")
                        : page === "documents"
                          ? t("문서 보관함")
                          : page === "notifications"
                            ? t("알림")
                            : t("내 계정과 설정")}
                <span className="heading-dot">.</span>
              </h1>
              <p className="subtitle">
                {page === "home"
                  ? t("아이들의 하루를 살펴보고, 필요한 돌봄을 챙겨주세요.")
                  : page === "pets"
                    ? t("아이마다 다른 일상과 건강 정보를 담아두세요.")
                    : page === "calendar"
                      ? t("일상부터 병원 방문까지, 빠짐없이.")
                      : ""}
              </p>
            </div>
            <button
              className="primary"
              onClick={
                page === "pets" ? () => setModal({ type: "pet" }) : openSchedule
              }
            >
              <Plus size={18} />
              {page === "pets" ? t("반려동물 등록") : t("일정 추가")}
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {errorText(error)}
              <button onClick={reload}>{t("다시 시도")}</button>
            </div>
          )}
          {data && !data.profile && (
            <div className="notice">
              {t(
                "처음 오셨네요. 설정에서 이름과 시간대를 저장해 가입을 마무리하세요.",
              )}
              <button onClick={() => setPage("settings")}>
                {t("프로필 등록 →")}
              </button>
            </div>
          )}
          {data && (
            <>
              <div className="pet-filters">
                <button
                  className={filter === "all" ? "selected" : ""}
                  onClick={() => setFilter("all")}
                >
                  <PawPrint size={18} />
                  {t("모든 반려동물")}
                </button>
                {data.pets.map((p: Obj) => (
                  <button
                    key={p.id}
                    className={filter === p.id ? "selected" : ""}
                    onClick={() => setFilter(p.id)}
                  >
                    <Avatar pet={p} small />
                    {p.name}
                  </button>
                ))}
                <button
                  className="add-pet"
                  aria-label={t("반려동물 추가")}
                  onClick={() => setModal({ type: "pet" })}
                >
                  <Plus size={19} />
                </button>
              </div>
              {(page === "home" || page === "calendar") && (
                <div className="dashboard">
                  <section className="main-column">
                    {page === "home" ? (
                      <div className="day-banner">
                        <div>
                          <span className="banner-kicker">
                            <Sun size={17} />
                            {t("오늘의 돌봄")}
                          </span>
                          <h2>
                            {daily.length
                              ? t(`${daily.length}번의 작은 돌봄이 기다려요`)
                              : t("새로운 돌봄을 시작해볼까요?")}
                          </h2>
                          <p>
                            {complete
                              ? t(
                                  `${complete}개 완료했어요. 오늘도 잘 챙겨주고 있네요.`,
                                )
                              : t("함께하는 건강한 습관, 하나씩 채워가요.")}
                          </p>
                          <div className="progress">
                            <span
                              style={{
                                width: `${daily.length ? (complete / daily.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <small>
                            {complete} / {daily.length} {t("완료")}
                          </small>
                        </div>
                        <div className="banner-art" aria-hidden="true">
                          <span>✧</span>
                          <PawPrint size={85} />
                          <span>♡</span>
                        </div>
                      </div>
                    ) : (
                      <Calendar
                        date={date}
                        setDate={setDate}
                        items={visible}
                        zone={zone}
                      />
                    )}
                    <div className="section-title">
                      <h2>
                        {page === "home"
                          ? t("오늘 해야 할 일")
                          : date + t(" 일정")}{" "}
                        <span>{daily.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => {
                          setPage("calendar");
                          setDate(today);
                        }}
                      >
                        {t("캘린더 보기")}
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div className="tasks">
                      {daily.length ? (
                        daily.map((i) => <Task key={i.id} item={i} />)
                      ) : (
                        <Empty
                          title={t("아직 등록된 일정이 없어요")}
                          detail={t(
                            "식사, 산책, 복약 등 아이의 첫 일정을 추가하세요.",
                          )}
                          action={
                            <button onClick={openSchedule}>
                              <Plus size={16} />
                              {t("일정 추가")}
                            </button>
                          }
                        />
                      )}
                    </div>
                    <div className="section-title">
                      <h2>{t("다가오는 일정")}</h2>
                      <span className="muted">{t("다음 7일")}</span>
                    </div>
                    {visible
                      .filter(
                        (i) =>
                          localParts(i.at, zone).date > today &&
                          localParts(i.at, zone).date <= addDays(today, 7),
                      )
                      .slice(0, 8)
                      .map((i) => (
                        <div className="upcoming" key={i.id}>
                          <div className="date-tile">
                            {new Date(i.at).toLocaleDateString(getLocale(), {
                              timeZone: zone,
                              month: "short",
                            })}
                            <strong>
                              {localParts(i.at, zone).date.slice(-2)}
                            </strong>
                          </div>
                          <div>
                            <strong>{i.title}</strong>
                            <p>
                              {i.petName} · {localParts(i.at, zone).time} ·{" "}
                              {t(kinds[i.kind])}
                            </p>
                          </div>
                          <button
                            className="icon-button"
                            aria-label={t("일정 수정")}
                            onClick={() =>
                              setModal({ type: "schedule", item: i })
                            }
                          >
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      ))}
                    {!visible.some(
                      (i) =>
                        localParts(i.at, zone).date > today &&
                        localParts(i.at, zone).date <= addDays(today, 7),
                    ) && (
                      <p className="muted upcoming-empty">
                        {t("가까운 예정 일정이 없어요.")}
                      </p>
                    )}
                  </section>
                  <aside className="right-column">
                    <div className="section-title">
                      <h2>{t("우리 아이들")}</h2>
                      <button
                        className="text-button"
                        onClick={() => setPage("pets")}
                      >
                        {t("전체 보기")}
                      </button>
                    </div>
                    {data.pets.map((p: Obj) => (
                      <button
                        className="pet-summary"
                        key={p.id}
                        onClick={() => {
                          setFilter(p.id);
                          setPage("pets");
                        }}
                      >
                        <Avatar pet={p} />
                        <div>
                          <strong>{p.name}</strong>
                          <p>
                            {p.breed ||
                              (
                                {
                                  dog: t("강아지"),
                                  cat: t("고양이"),
                                  other: t("기타"),
                                } as Obj
                              )[p.species]}{" "}
                            {p.weight ? "· " + p.weight + " kg" : ""}
                          </p>
                        </div>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                    {!data.pets.length && (
                      <div className="side-empty">
                        <PawPrint size={28} />
                        <p>{t("함께하는 아이를 등록해보세요.")}</p>
                        <button onClick={() => setModal({ type: "pet" })}>
                          {t("첫 반려동물 등록")}
                        </button>
                      </div>
                    )}
                    <div className="document-promo">
                      <span className="promo-icon">
                        <FileText size={24} />
                      </span>
                      <h3>{t("병원 기록도 한곳에")}</h3>
                      <p>
                        {t("처방전과 진단서를 보관하고")}
                        <br />
                        {t("확인한 내용을 건강 기록으로 남겨요.")}
                      </p>
                      <button onClick={() => setPage("documents")}>
                        {t("문서 보관함")}
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div className="care-note">
                      <HeartPulse size={18} />
                      <p>
                        {t("완료 표시는 이번 회차에만 적용돼요.")}
                        <br />
                        {t("다음 돌봄 일정은 그대로 남아 있어요.")}
                      </p>
                    </div>
                  </aside>
                </div>
              )}
              {page === "pets" && (
                <div className="pet-grid">
                  {data.pets
                    .filter((p: Obj) => filter === "all" || filter === p.id)
                    .map((p: Obj) => (
                      <article className="pet-card" key={p.id}>
                        <Avatar pet={p} />
                        <h2>{p.name}</h2>
                        <p>
                          {p.breed || t("품종 미등록")} ·{" "}
                          {p.species === "cat"
                            ? t("고양이")
                            : p.species === "dog"
                              ? t("강아지")
                              : t("기타")}
                        </p>
                        <dl>
                          <dt>{t("생년월일")}</dt>
                          <dd>{p.birthday || t("미등록")}</dd>
                          <dt>{t("성별")}</dt>
                          <dd>
                            {
                              (
                                {
                                  male: t("수컷"),
                                  female: t("암컷"),
                                  unknown: t("미확인"),
                                } as Obj
                              )[p.sex]
                            }
                          </dd>
                          <dt>{t("체중")}</dt>
                          <dd>{p.weight ? p.weight + " kg" : t("미등록")}</dd>
                          <dt>{t("특이사항")}</dt>
                          <dd>{p.notes || t("없음")}</dd>
                        </dl>
                        <div className="button-row">
                          <button
                            onClick={() => setModal({ type: "pet", pet: p })}
                          >
                            {t("정보 수정")}
                          </button>
                          <button
                            onClick={() => {
                              setFilter(p.id);
                              setPage("health");
                            }}
                          >
                            {t("건강 기록")}
                          </button>
                        </div>
                      </article>
                    ))}
                  <button
                    className="pet-card add-card"
                    onClick={() => setModal({ type: "pet" })}
                  >
                    <Plus size={30} />
                    <strong>{t("새로운 가족 등록")}</strong>
                  </button>
                </div>
              )}
              {["documents", "health", "notifications", "settings"].includes(
                page,
              ) && (
                <ExtraPages
                  page={page}
                  data={data}
                  filter={filter}
                  zone={zone}
                  run={run}
                  busy={busy}
                  setModal={setModal}
                />
              )}
            </>
          )}
        </main>
        <footer>
          {t("포데이")}
          <span>·</span>
          {t("함께하는 하루를 기록해요")}
        </footer>
      </div>
      <nav className="mobile-nav">
        {nav.slice(0, 5).map(([id, label, Icon]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => setPage(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {t(toast)}
        </div>
      )}
      {modal && (
        <div className="overlay" onClick={() => !busy && setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("정보 입력")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label={t("닫기")}
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            {modal.type === "pet" ? (
              <PetForm
                pet={modal.pet}
                busy={busy}
                save={async (p) => {
                  if (await run(() => api("pets", "POST", p))) setModal(null);
                }}
              />
            ) : modal.type === "schedule" ? (
              <ScheduleForm
                data={data!}
                item={modal.item}
                initialPetId={filter === "all" ? undefined : filter}
                zone={zone}
                busy={busy}
                save={async (p) => {
                  if (
                    await run(() =>
                      modal.item
                        ? api("schedules", "PATCH", p)
                        : api("schedules", "POST", p),
                    )
                  )
                    setModal(null);
                }}
              />
            ) : modal.type === "delete" ? (
              <>
                <h2>{t("반복 일정을 삭제할까요?")}</h2>
                <p>
                  {t(
                    "이 일정의 남은 모든 회차와 예약 알림이 취소됩니다. 수행 기록은 서버에 남습니다.",
                  )}
                </p>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await run(() =>
                        api("schedules", "DELETE", {
                          id: modal.item.scheduleId,
                        }),
                      )
                    )
                      setModal(null);
                  }}
                >
                  {t("전체 일정 삭제")}
                </button>
              </>
            ) : (
              <DocumentReview
                modal={modal}
                data={data!}
                busy={busy}
                run={run}
                close={() => setModal(null)}
              />
            )}
            {error && (
              <p className="error" role="alert">
                {errorText(error)}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Calendar({
  date,
  setDate,
  items,
  zone,
}: {
  date: string;
  setDate: (d: string) => void;
  items: Obj[];
  zone: string;
}) {
  const start = date.slice(0, 7) + "-01",
    offset = new Date(start + "T12:00Z").getUTCDay(),
    days = new Date(+date.slice(0, 4), +date.slice(5, 7), 0).getDate();
  function move(n: number) {
    const d = new Date(start + "T12:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    setDate(d.toISOString().slice(0, 10));
  }
  return (
    <div className="calendar">
      <div className="section-title">
        <button aria-label={t("이전 달")} onClick={() => move(-1)}>
          <ChevronLeft />
        </button>
        <h2>
          {new Date(date + "T12:00Z").toLocaleDateString(getLocale(), {
            year: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
        </h2>
        <button aria-label={t("다음 달")} onClick={() => move(1)}>
          <ChevronRight />
        </button>
      </div>
      <div className="calendar-grid">
        {dayLabels().map((d) => (
          <span key={d}>{d}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={"e" + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = start.slice(0, 8) + String(i + 1).padStart(2, "0");
          return (
            <button
              className={d === date ? "selected" : ""}
              key={d}
              onClick={() => setDate(d)}
            >
              {i + 1}
              {items.some((x) => localParts(x.at, zone).date === d) && <i />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function PetForm({
  pet,
  busy,
  save,
}: {
  pet?: Obj;
  busy: boolean;
  save: (p: Obj) => void;
}) {
  const [p, set] = useState<Obj>(
    pet || {
      name: "",
      species: "dog",
      breed: "",
      birthday: "",
      sex: "unknown",
      weight: "",
      notes: "",
    },
  );
  const field = (key: string) => ({
    value: p[key] || "",
    onChange: (e: any) => set({ ...p, [key]: e.target.value }),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(p);
      }}
    >
      <p className="eyebrow">{t("우리 가족")}</p>
      <h2>{pet ? t("반려동물 정보 수정") : t("새로운 가족을 소개해주세요")}</h2>
      <div className="form-grid">
        <Field label={t("이름 *")}>
          <input required maxLength={60} {...field("name")} />
        </Field>
        <Field label={t("종류")}>
          <select {...field("species")}>
            <option value="dog">{t("강아지")}</option>
            <option value="cat">{t("고양이")}</option>
            <option value="other">{t("기타")}</option>
          </select>
        </Field>
        <Field label={t("품종")}>
          <input {...field("breed")} />
        </Field>
        <Field label={t("생년월일")}>
          <input type="date" {...field("birthday")} />
        </Field>
        <Field label={t("성별")}>
          <select {...field("sex")}>
            <option value="unknown">{t("미확인")}</option>
            <option value="male">{t("수컷")}</option>
            <option value="female">{t("암컷")}</option>
          </select>
        </Field>
        <Field label={t("체중 (kg)")}>
          <input type="number" min="0" step="0.01" {...field("weight")} />
        </Field>
      </div>
      <Field label={t("특이사항")}>
        <textarea {...field("notes")} />
      </Field>
      {pet && (
        <Field label={t("사진 (JPEG·PNG·WebP, 10MB 이하)")}>
          <FileInput
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.set("file", f);
              fd.set("petId", pet.id);
              fd.set("purpose", "photo");
              try {
                const d = await api("documents", "POST", fd);
                set({ ...p, photoId: d.id });
              } catch (err) {
                e.target.setCustomValidity(errorText((err as Error).message));
                e.target.reportValidity();
              }
            }}
          />
        </Field>
      )}
      {!pet && (
        <p className="muted">
          {t("등록 후 정보 수정에서 사진을 추가할 수 있어요.")}
        </p>
      )}
      <button className="primary wide" disabled={busy}>
        {busy ? t("저장 중…") : t("반려동물 저장")}
      </button>
    </form>
  );
}
function ScheduleForm({
  data,
  item,
  initialPetId,
  zone,
  busy,
  save,
}: {
  data: Obj;
  item?: Obj;
  initialPetId?: string;
  zone: string;
  busy: boolean;
  save: (p: Obj) => void;
}) {
  const today = localParts(Date.now(), zone).date,
    [s, set] = useState<Obj>(
      item
        ? {
            ...item,
            rule: {
              ...item.rule,
              start: localParts(item.at, item.rule.timezone).date,
            },
          }
        : {
            petId:
              initialPetId || (data.pets.length === 1 ? data.pets[0].id : ""),
            title: "",
            kind: "meal",
            rule: {
              mode: "once",
              start: today,
              times: ["08:00"],
              timezone: zone,
              interval: 1,
              weekdays: [1],
              until: null,
              count: null,
            },
            reminder: 0,
            notify: true,
            notes: "",
            medication: {
              name: "",
              dose: "",
              unit: "",
              route: "",
              warnings: "",
            },
          },
    ),
    [scope, setScope] = useState("one"),
    [localError, setError] = useState("");
  const change = (k: string, v: any) => set({ ...s, [k]: v }),
    rule = (k: string, v: any) => set({ ...s, rule: { ...s.rule, [k]: v } }),
    med = (k: string, v: any) =>
      set({ ...s, medication: { ...s.medication, [k]: v } });
  let preview = "";
  try {
    const end = s.rule.until
      ? addDays(s.rule.until, 1)
      : addDays(s.rule.start, 31);
    preview = `${s.rule.until ? t("기간 내") : t("앞으로 31일")} ${occurrences(s.rule, new Date(zonedInstant(s.rule.start, "00:00", s.rule.timezone)!).toISOString(), new Date(zonedInstant(end, "00:00", s.rule.timezone)!).toISOString()).length}${t("회")}`;
  } catch {}
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const newAt = zonedInstant(
            s.rule.start,
            s.rule.times[0],
            s.rule.timezone,
          );
          if (newAt == null) throw Error(t("유효하지 않은 시각입니다."));
          save(
            item
              ? {
                  id: item.scheduleId,
                  version: item.version,
                  at: item.originalAt,
                  scope,
                  newAt: new Date(newAt).toISOString(),
                  data: s,
                }
              : s,
          );
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <p className="eyebrow">{t("돌봄 일정")}</p>
      <h2>{item ? t("돌봄 일정 수정") : t("새로운 돌봄 일정")}</h2>
      {item && (
        <Field label={t("수정 범위")}>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              if (e.target.value === "one")
                set({ ...s, petId: item.petId, documentId: item.documentId });
            }}
          >
            <option value="one">{t("이번 회차만")}</option>
            <option value="future">{t("이번 회차부터 이후 일정")}</option>
          </select>
        </Field>
      )}
      <fieldset
        className="schedule-pet-picker"
        disabled={!!item && scope === "one"}
      >
        <legend>{t("반려동물 선택 *")}</legend>
        <p className="muted">
          {item && scope === "one"
            ? t("개별 회차의 반려동물은 변경할 수 없습니다.")
            : t("이 일정을 함께할 반려동물을 선택하세요.")}
        </p>
        <div className="schedule-pet-options">
          {data.pets.map((pet: Obj) => (
            <label
              key={pet.id}
              className={
                "schedule-pet-option" + (s.petId === pet.id ? " selected" : "")
              }
            >
              <input
                type="radio"
                name="schedule-pet"
                value={pet.id}
                checked={s.petId === pet.id}
                required
                onChange={() => set({ ...s, petId: pet.id, documentId: null })}
              />
              <Avatar pet={pet} small />
              <span>{pet.name}</span>
              {s.petId === pet.id && <Check size={18} aria-hidden="true" />}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-grid">
        <Field label={t("종류")}>
          <select
            value={s.kind}
            onChange={(e) => change("kind", e.target.value)}
          >
            {Object.entries(kinds).map(([v, l]) => (
              <option key={v} value={v}>
                {t(l)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t("일정 제목 *")}>
        <input
          required
          maxLength={120}
          value={s.title}
          onChange={(e) => change("title", e.target.value)}
          placeholder={t("예: 저녁 산책")}
        />
      </Field>
      {s.kind === "medicine" && (
        <fieldset>
          <legend>{t("복약 정보 · 처방 내용을 확인해 입력하세요")}</legend>
          <div className="form-grid">
            {[
              ["name", t("약 이름")],
              ["dose", t("1회 투약량")],
              ["unit", t("단위 (mg, 정, mL 등)")],
              ["route", t("투여 방법")],
            ].map(([k, l]) => (
              <Field key={k} label={t(l) + " *"}>
                <input
                  required
                  value={s.medication?.[k] || ""}
                  onChange={(e) => med(k, e.target.value)}
                />
              </Field>
            ))}
          </div>
          <Field label={t("주의사항")}>
            <textarea
              value={s.medication?.warnings || ""}
              onChange={(e) => med("warnings", e.target.value)}
            />
          </Field>
          <Field label={t("연결할 확정 처방 문서")}>
            <select
              value={s.documentId || ""}
              onChange={(e) => change("documentId", e.target.value || null)}
            >
              <option value="">{t("연결 안 함")}</option>
              {data.documents
                .filter(
                  (d: Obj) => d.status === "confirmed" && d.pet_id === s.petId,
                )
                .map((d: Obj) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </Field>
        </fieldset>
      )}
      <div className="form-grid">
        <Field label={t("시작일 *")}>
          <input
            required
            type="date"
            value={s.rule.start}
            onChange={(e) => rule("start", e.target.value)}
          />
        </Field>
        <Field label={t("반복 방식")}>
          <select
            value={s.rule.mode}
            onChange={(e) => rule("mode", e.target.value)}
          >
            {Object.entries(modes).map(([v, l]) => (
              <option key={v} value={v}>
                {t(l)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label={
          s.rule.mode === "hours"
            ? t("시작 시각 (이 시각부터 경과 시간 계산)")
            : t("실행 시각 (여러 시각은 쉼표로 구분) *")
        }
      >
        <input
          required
          value={s.rule.times.join(", ")}
          placeholder="08:00, 20:00"
          onChange={(e) =>
            rule(
              "times",
              e.target.value.split(",").map((t) => t.trim()),
            )
          }
        />
      </Field>
      {["days", "weeks", "months", "hours"].includes(s.rule.mode) && (
        <Field label={t("반복 간격 N")}>
          <input
            type="number"
            min="1"
            max="365"
            value={s.rule.interval}
            onChange={(e) => rule("interval", Number(e.target.value))}
          />
        </Field>
      )}
      {["weekly", "weeks"].includes(s.rule.mode) && (
        <div className="weekdays">
          {dayLabels().map((d, n) => (
            <label key={n}>
              <input
                type="checkbox"
                checked={s.rule.weekdays.includes(n)}
                onChange={(e) =>
                  rule(
                    "weekdays",
                    e.target.checked
                      ? [...s.rule.weekdays, n]
                      : s.rule.weekdays.filter((v: number) => v !== n),
                  )
                }
              />
              {d}
            </label>
          ))}
        </div>
      )}
      {s.rule.mode !== "once" && (
        <div className="form-grid">
          <Field label={t("종료일 (포함)")}>
            <input
              type="date"
              min={s.rule.start}
              value={s.rule.until || ""}
              onChange={(e) =>
                set({
                  ...s,
                  rule: {
                    ...s.rule,
                    until: e.target.value || null,
                    count: null,
                  },
                })
              }
            />
          </Field>
          <Field label={t("또는 총 반복 횟수")}>
            <input
              type="number"
              min="1"
              max="10000"
              value={s.rule.count || ""}
              onChange={(e) =>
                set({
                  ...s,
                  rule: {
                    ...s.rule,
                    count: e.target.value ? Number(e.target.value) : null,
                    until: null,
                  },
                })
              }
            />
          </Field>
        </div>
      )}
      <Field label={t("일정 시간대")}>
        <input
          required
          value={s.rule.timezone}
          onChange={(e) => rule("timezone", e.target.value)}
          list="zones"
        />
      </Field>
      <datalist id="zones">
        {[
          "Asia/Seoul",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "America/New_York",
          "Europe/London",
          "UTC",
        ].map((z) => (
          <option key={z}>{z}</option>
        ))}
      </datalist>
      <div className="rule-note">
        {t(
          "월 반복은 날짜가 없으면 말일에 실행합니다. 지정 시각은 일정 시간대 기준이며, N시간 반복은 실제 경과 시간 기준입니다. 일광절약시간으로 없는 시각은 건너뛰고, 중복 시각은 첫 번째만 실행합니다.",
        )}
        <strong>{preview}</strong>
      </div>
      <div className="form-grid">
        <Field label={t("알림")}>
          <select
            value={s.notify ? "yes" : "no"}
            onChange={(e) => change("notify", e.target.value === "yes")}
          >
            <option value="yes">{t("사용")}</option>
            <option value="no">{t("사용 안 함")}</option>
          </select>
        </Field>
        <Field label={t("몇 분 전 알림 (0 = 정시)")}>
          <input
            type="number"
            min="0"
            max="10080"
            value={s.reminder}
            onChange={(e) => change("reminder", Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label={t("메모")}>
        <textarea
          value={s.notes || ""}
          onChange={(e) => change("notes", e.target.value)}
        />
      </Field>
      {s.notify && (
        <NotificationControls
          compact
          notificationTitle={
            s.petId
              ? `${data.pets.find((pet: Obj) => pet.id === s.petId)?.name} · ${s.title || t("돌봄 일정")}`
              : undefined
          }
        />
      )}
      {localError && <p className="error">{errorText(localError)}</p>}
      <button className="primary wide" disabled={busy}>
        {busy ? t("저장 중…") : t("일정 저장")}
      </button>
    </form>
  );
}
import {
  ExtraPages,
  DocumentReview,
  useNotificationBridge,
} from "./extra-pages";
