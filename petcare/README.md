# Current mode: local English app

Double-click Pawday.cmd in the parent folder. No login or public website is needed. See LOCAL_APP.md for startup, storage and team-copy instructions. Older online demo/authentication descriptions below describe previous versions.

# Current mode: public demo

This Site now opens without ChatGPT login. See [PUBLIC_DEMO.md](PUBLIC_DEMO.md) for anonymous session isolation and current demo behavior. Legacy authentication descriptions below describe the previous account-based version.

# 포데이 / Pawday

한국어·영어 반려동물 돌봄 웹앱. 빈 프로젝트에서 React 19 + TypeScript + Vinext/Vite, Cloudflare D1(SQLite), 비공개 R2 원본 저장소로 구현했습니다. 로컬 개발에서는 Miniflare가 실제 SQLite 파일과 파일 저장소를 `.wrangler/state`에 유지합니다. 앱 데이터는 localStorage에 저장하지 않습니다. localStorage에는 언어와 이 기기의 알림 선호도만 저장합니다.

## 실행

현재 PC에서 프로젝트 상위 폴더의 PowerShell:

```powershell
.\start.ps1
```

기본 주소: http://localhost:5173

이미 서버가 실행 중이면 해당 주소를 사용하세요. 다른 포트는 `./start.ps1 -Port 5174`입니다. 스크립트 실행 정책 때문에 차단되면 정책을 변경하지 말고 아래 Node 명령을 직접 사용하세요.

다른 PC(Node.js 22.13 이상):

```sh
cd petcare
npm ci
npm run build
node scripts/migrate-local.mjs
npm run dev
```

현재 PC의 Node는 `../.runtime/node-v22.23.3-win-x64/node.exe`에 준비되어 있습니다. 시스템 전체 설치는 하지 않았습니다. 로컬 마이그레이션 적용 상태는 `.sites-runtime/migrations-applied.json`에 기록됩니다. `.wrangler/state`와 이 파일을 함께 보관하세요. 이미 적용된 SQL을 수동으로 다시 실행하지 마세요.

## 로그인 / 가입

- 배포 버전은 Sites의 **ChatGPT 계정 로그인**을 사용합니다. 첫 로그인 후 설정에서 이름·IANA 시간대를 저장하면 앱 프로필 등록이 완료됩니다.
- 별도의 이메일/비밀번호 회원가입, 비밀번호 재설정은 구현하지 않았습니다.
- 로컬 로그인은 **명시적인 개발용 모의 계정** `seedy@sites.test`입니다. 실제 ChatGPT 인증을 로컬에서 수행하지 않습니다.
- 로컬 통합 테스트용 `test_alice`, `test_bob`은 개발 서버 플러그인에서만 제공됩니다. 프로덕션 Worker에는 포함되지 않습니다.
- 브라우저 UI 검증에 만든 `데모 · 두부`, `데모 · 저녁 산책`은 로컬 테스트 데이터입니다. 배포 데이터베이스에 복사되지 않습니다.
- 서버는 플랫폼이 검증해 주입하는 사용자 ID로 데이터 소유권을 확인합니다. 이 Worker를 인증 게이트웨이 없이 임의의 호스트에 노출하면 안 됩니다. 자체 호스팅 시 동일한 수준의 인증 계층이 필요합니다.

## 구현한 흐름

### 1. 반려동물과 일정

- 여러 반려동물 등록·수정: 이름, 종류, 품종, 생년월일, 성별, 체중, 특이사항. 사진은 등록 후 정보 수정에서 업로드합니다.
- 반려동물 필터, 오늘의 할 일, 다음 7일 일정, 월 캘린더, 일별 목록.
- 식사·산책·목욕·미용·예방접종·검진·병원 방문·복약·기타 일정.
- 한 번 / 매일 여러 지정 시각 / 특정 요일 / N일·N주·N개월 / 시작 시각부터 N시간 반복.
- 종료일 포함 또는 총 횟수. 일반 반복 일정은 종료 없이 사용할 수 있고 복약은 종료 조건이 필수입니다.
- 이번 회차 수정은 예외 레코드로 저장하고, 이후 수정은 원래 시리즈의 경계를 설정한 뒤 새 시리즈로 분할합니다. 과거 회차 수행 기록은 남습니다.
- 완료·건너뛰기·10분 후 다시 알림은 개별 회차에만 적용됩니다. 일정 삭제는 소프트 삭제이며 수행 기록은 서버에 보존됩니다.

### 반복과 시간대 정책

- 모든 저장 시각은 UTC ISO 값, 일정 정의는 IANA 시간대와 현지 날짜/시간을 별도로 보관합니다.
- `08:00, 20:00`은 매일의 현지 시각입니다. `12시간마다`는 UTC 실제 경과 12시간입니다. DST 전환 시 두 방식은 다른 결과를 냅니다.
- 1월 31일 월 반복 → 2월 말일 → 3월 31일. 말일 보정 때문에 이후 월의 기준일이 바뀌지 않습니다.
- 없는 DST 시각은 건너뛰며 중복 시각은 이른 회차만 선택합니다. 없는 시작 시각은 입력 오류로 안내합니다.
- N주 반복은 월요일 시작 주 단위이며 선택한 요일에 발생합니다.
- 1회 조회 최대 370일, 결과 최대 약 10,000회입니다. 반복은 규칙으로 저장하고 조회 시 계산하므로 무한한 회차를 DB에 미리 저장하지 않습니다.

### 2. 알림

| 구분                     | 현재 지원                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 앱 내부 목록             | 실제 DB 저장, 접속 시 최근 7일 + 향후 8일 예약 동기화, 읽음 처리                                                   |
| 앱이 열린 동안 기기 알림 | Notifications API + Service Worker로 구현. 지원 브라우저에서 사용자 권한 필요. 약 30초 폴링                        |
| 앱을 닫은 상태           | **현재 미연결**. VAPID 구독·발송 코드와 보호된 dispatch API는 준비됨. 키·정기 호출 서비스 및 호스팅 경계 연결 필요 |
| 소리·진동·정시 알람      | OS/브라우저 정책을 따름. 강제 소리·반복 울림·정확한 정시 발송은 제공하지 않음                                      |

- 회차 ID 기반 알림 작업, DB 원자적 claim으로 중복 표시를 막습니다. 수정 시 기존 작업을 재구성하고 삭제·완료·건너뛰기 시 취소합니다.
- 이미 기기에 표시된 알림은 다음 동기화에서 닫습니다. 오프라인 기기에 이미 표시된 알림을 즉시 철회할 수는 없습니다.
- 여러 기기 중 먼저 claim한 기기만 해당 알림을 표시하는 정책입니다. claim 후 브라우저가 종료되는 경우 표시가 누락될 수 있습니다. 의료용 확정 알람 시스템이 아닙니다.
- 정기 호출이 없으면 앱 종료 중 타이머는 실행되지 않습니다. 화면은 이 상태를 연결 완료로 표시하지 않습니다.
- iOS/iPadOS의 Web Push는 홈 화면에 추가한 웹앱과 사용자 권한이 필요합니다. 브라우저/OS 종료·절전·권한·네트워크 상태에 따라 전달은 지연되거나 차단될 수 있습니다.

### 3. 문서와 건강 기록

- JPEG·PNG·WebP·PDF, 최대 10MB. 실제 파일 시그니처 검사와 요청 본문 크기 제한을 적용합니다.
- 원본은 인증된 파일 API를 통해서만 열립니다. 소유권과 반려동물 연결을 모든 쓰기 및 읽기 경계에서 검사합니다.
- 사용자·반려동물·파일 SHA-256 기반으로 중복 업로드를 차단합니다.
- 원본 저장 → 선택적으로 AI 분석 → 필드별 원문 근거와 불명확 표시 → 수동 검토·수정 → 확인 체크 → 확정 건강 기록 → 별도로 선택한 일정 생성.
- AI 미연결에서는 **빈 필드와 ‘확인 필요’만 표시**하며 가짜 AI 결과를 만들지 않습니다.
- 약 이름·투약량·단위·투여 방법·복용 시각·기간은 확인되어야 합니다. 누락된 내용을 추측하거나 자동으로 복약을 생성하지 않습니다.
- 한 문서의 여러 약이 복잡하게 적힌 경우 자동 병합하지 않습니다. 원문 소견을 확인하고 약별로 일정을 직접 생성해야 합니다.
- 확정 문서별 건강 타임라인과 원본 연결, 중복 일정 생성 방지.
- 분석 실패 시 원본 유지, 재시도와 수동 검토 지원. 중단된 분석 잠금은 90초 후 재시도 가능합니다.

## 언어

설정의 `Language / 언어`에서 한국어 / English를 즉시 전환합니다. 로그인 전 화면에도 선택기가 있습니다. 다음 접속에도 유지되며 날짜 표시, 메뉴, 폼, 설명 문구가 변경됩니다. 반려동물 이름·메모·원문·기록 내용은 번역하지 않습니다. 일부 외부 서비스 오류 메시지는 원문으로 표시될 수 있습니다.

## 외부 연결

### AI 문서 추출 — 현재 실제 API 미연결

로컬 `.dev.vars`에 `OPENAI_API_KEY`, `OPENAI_MODEL`을 설정한 뒤 서버를 재시작합니다. 기본 모델은 `gpt-4.1-mini`이며 이미지/PDF와 Structured Outputs를 지원하는 사용 가능한 모델로 변경할 수 있습니다. 배포 환경은 Sites 환경변수/비밀정보 관리에서 동일한 키를 설정합니다. 브라우저에는 키를 전달하지 않습니다.

`AI로 내용 추출`은 원본을 OpenAI Responses API에 전송합니다. UI에서 이 전송을 안내합니다. `store:false`, JSON Schema, 문서 내부 지시 무시, 정보 추측 금지 프롬프트를 적용했습니다. 실제 API 비용·계정·모델 가용성·실문서 정확도는 키 연결 후 검증해야 합니다. 현재 검증은 미연결 수동 경로를 대상으로 했습니다.

### 앱 종료 후 Web Push — 현재 실제 전송 미검증

1. `node scripts/generate-push-keys.mjs`를 직접 실행하고 결과를 비밀정보 저장소에 보관합니다. 출력에는 비밀 키가 포함되므로 공유하지 마세요.
2. `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`을 로컬 또는 서버 환경변수에 설정합니다.
3. 실제 HTTPS 브라우저에서 알림을 허용하여 구독합니다.
4. 신뢰할 수 있는 서버 스케줄러가 매분 `POST /api/dispatch`에 `Authorization: Bearer <CRON_SECRET>`을 전달하도록 연결합니다.
5. **현재 사이트는 소유자 전용 비공개**입니다. Sites의 로그인 경계가 외부 스케줄러 요청을 막을 수 있으므로 일반 cron URL만 등록하면 동작한다고 볼 수 없습니다. 플랫폼이 허용하는 서버 인증 경로 또는 인증 경계가 구성된 별도 호스팅이 필요합니다. 이 프로젝트가 접근 범위를 자동으로 공개로 변경하지 않습니다.
6. 이 구현은 비어 있는 Web Push 신호를 보내고 서비스 워커가 로그인된 세션으로 본문을 조회합니다. 세션 만료와 플랫폼 인증 제약, Safari의 사용자 표시 정책을 포함한 실제 기기 검증이 필요합니다. 사용 전 Android/Chrome·iOS 홈 화면·Safari별 수신 검증을 완료하세요.

로컬 개발 서버가 켜져 있는 것만으로 휴대폰의 앱 종료 알림이 연결되는 것은 아닙니다.

## 검증

```sh
node --test tests/recurrence.test.mjs
node tests/integration.mjs
npx tsc --noEmit
npm run build
```

통합 검증은 로컬 개발 서버와 마이그레이션이 적용된 DB가 필요합니다. 테스트 계정에만 데이터를 생성합니다.

- 반복 단위 검증 **9개 통과**: 7일×하루2회=14, 월말 복원, 요일 주기, DST, 횟수 제한, 이후 회차 분할, 복약 누락 거부.
- 실제 서버 통합 검증 **17개 통과**: 두 반려동물 분리, 한 회차 완료/13회 대기, 개별 수정, 알림 중복 claim·삭제 취소, 문서 중복, 미확정/불명확 일정 거부, 타 사용자 원본·기록 접근 차단, 미로그인 접근 차단, 저장 유지, 파일 위조 거부.
- 브라우저 UI: 390px 모바일 화면, 영어 전환 및 새로고침 유지, 반려동물 등록, 일정 생성, 완료 처리 확인.
- 타입 검사와 프로덕션 빌드 통과. 실제 AI 추출·앱 종료 후 기기 수신·iOS 실기기·부하 검증은 아직 하지 않았습니다.

## 남은 범위 / 운영 전 보완

- 실제 AI 계정, VAPID 비밀키, 정기 발송 서비스 연결 및 플랫폼별 기기 수신 검증.
- 별도 이메일/비밀번호 인증, 이메일/문자 알림, 강제 알람음, 오프라인 전체 편집은 미구현입니다.
- 계정 삭제·문서 삭제/보존 정책 UI, 백업 자동화, 악성 PDF 스캔, 대규모 발송 큐와 재처리 운영 도구는 추가 구현 대상입니다.
- 시간대 DB가 바뀌는 장기 일정, 여러 문서의 복잡한 처방 병합, 동시 다중 편집과 대량 스케줄 부하는 추가 검증이 필요합니다.

## 주요 파일

- `app/pet-app.tsx`, `app/extra-pages.tsx`: 반응형 UI
- `lib/i18n.ts`, `lib/locales/en.json`: 언어와 번역 사전
- `lib/recurrence.mjs`: 반복 계산과 복약 검증
- `app/api/`: 소유권 검사, CRUD, 문서 검토, 알림 API
- `lib/documents.ts`: 파일 형식 검사와 선택적 AI 어댑터
- `lib/webpush.ts`, `public/sw.js`: VAPID 신호 및 기기 표시
- `db/schema.ts`, `drizzle/`: 스키마와 마이그레이션
- `tests/`: 반복 및 실제 API 통합 검증

## 공식 근거

- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [WebKit: iOS/iPadOS Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

## 언어 설정 업데이트

- 한국어, 영어, 중국어 간체를 로그인 화면과 설정에서 선택할 수 있습니다.
- 메뉴, 언어 선택지, 소제목, 날짜와 요일, 입력 검증, 서버 오류 안내, 파일 선택 표시와 기기 알림 본문을 선택한 언어로 표시합니다.
- 기기에 저장한 언어를 새로고침 후 복원하며, 복원 전에는 다른 언어의 로딩 문구를 표시하지 않습니다.
- 사용자 이름, 반려동물 이름, 직접 작성한 일정·메모와 문서 원문은 자동 번역하지 않습니다. 시간대 식별자, 파일 형식, 제품명은 고유 표기를 유지합니다.
- 운영체제의 파일 선택 창, 브라우저 자체 날짜 선택 팝업 및 외부 로그인 페이지는 해당 시스템의 언어 설정을 따릅니다.
- `node --test tests/languages.test.mjs`: 번역 사전 누락, 하드코딩된 화면 문구, 언어 전환 후 메시지와 숫자 문구를 검사합니다. 5개 테스트 통과.
- 실제 화면에서 한국어→중국어→영어 전환, 중국어 필수 입력 안내 및 새로고침 유지 확인.
