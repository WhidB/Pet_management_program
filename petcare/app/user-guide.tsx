"use client";

import { Dialog } from "radix-ui";
import { BookOpen, X } from "lucide-react";
import { useLanguage } from "../lib/i18n";

const copy = {
  ko: {
    title: "사용 방법",
    intro:
      "처음이라면 아래 순서대로 시작해 보세요. 필요할 때 언제든 다시 열 수 있어요.",
    close: "닫기",
    done: "확인했어요",
    steps: [
      [
        "1. 프로필과 반려동물 등록",
        "로그인 없이 샘플 반려동물과 일정으로 시작할 수 있어요. 설정에서 이름과 시간대를 바꿀 수 있어요. 반려동물 화면의 ‘반려동물 등록’을 눌러 이름과 기본 정보를 입력하세요. 사진은 등록 후 정보 수정에서 추가할 수 있어요.",
      ],
      [
        "2. 돌봄 일정 만들기",
        "‘일정 추가’를 눌러 반려동물과 식사·산책·복약 등의 종류를 선택하세요. 시작 날짜, 시각, 반복 주기를 정한 뒤 저장하세요. 복약 일정에는 약 정보와 종료 조건이 필요해요.",
      ],
      [
        "3. 오늘의 돌봄 확인하기",
        "오늘의 일정 왼쪽 체크 버튼으로 완료를 표시하세요. 다시 누르면 완료를 취소할 수 있어요. 일정 옆 ⋯ 메뉴에서 수정, 건너뛰기, ‘10분 뒤 알림’을 선택하세요. 반복 일정 수정 시 적용 범위를 확인하세요.",
      ],
      [
        "4. 캘린더와 반려동물 필터",
        "캘린더에서 날짜를 선택해 그날의 일정을 확인하세요. 화면 위 반려동물 필터를 누르면 선택한 아이의 일정만 볼 수 있어요.",
      ],
      [
        "5. 문서 보관과 건강 기록",
        "문서 보관함에서 반려동물을 선택하고 진료 문서나 처방전을 업로드하세요(JPEG·PNG·WebP·PDF, 최대 10MB). ‘직접 검토’에서 내용을 확인·수정하고 확인 항목을 체크한 뒤 ‘확정 건강 기록 저장’을 누르세요. AI 분석을 사용해도 원문 확인은 필요하며, 복약 일정은 검토 후 별도로 생성하세요.",
      ],
      [
        "6. 알림과 언어 설정",
        "일정 추가창이나 알림 화면에서 ‘알림 허용 및 테스트’를 누르고 브라우저 권한을 허용하세요. ‘10초 뒤 데모 알림’을 누른 뒤 다른 화면으로 이동해 알림을 시연할 수 있어요. 브라우저는 실행해 두세요. 앱 종료 후 일정 자동 발송에는 별도 정기 발송 서비스가 필요해요. 설정에서 한국어·영어·중국어를 선택할 수 있어요.",
      ],
    ],
  },
  en: {
    title: "How to use",
    intro:
      "Start with these steps. You can reopen this guide whenever you need it.",
    close: "Close",
    done: "Got it",
    steps: [
      [
        "1. Set up your profile and pets",
        "No login is needed. Add your own pets and care schedules on this computer. You can change your name and time zone in Settings. Open Pets and choose Add pet to enter their details. After saving, edit the pet to add a photo.",
      ],
      [
        "2. Create a care schedule",
        "Choose Add schedule, select a pet and a care type such as meals, walks or medication. Set the start date, time and repeat rule, then save. Medication schedules also need medication details and an end condition.",
      ],
      [
        "3. Track today's care",
        "Use the check button beside a task to mark it complete; click again to undo. Open its ⋯ menu to edit, skip or snooze for 10 minutes. Check the scope when editing a repeating schedule.",
      ],
      [
        "4. Use the calendar and pet filters",
        "Select a date in Calendar to see that day's tasks. Use the pet filters above the content to view one pet's schedules.",
      ],
      [
        "5. Store documents and health records",
        "In Documents, select a pet and upload a medical document or prescription (JPEG, PNG, WebP or PDF, up to 10MB). Open manual review, check and correct the details, tick the confirmation boxes and save the confirmed health record. Review the original even when using AI analysis. Create medication schedules separately after review.",
      ],
      [
        "6. Set up notifications and language",
        "In Add schedule or Notifications, choose Enable and test and allow browser notifications. Choose Demo in 10 seconds, then switch screens to demonstrate a notification. Keep the browser running. Automatic scheduled delivery after closing the app needs a separate scheduling service. Choose Korean, English or Chinese in Settings.",
      ],
    ],
  },
  zh: {
    title: "使用方法",
    intro: "第一次使用时，请按照以下步骤开始。需要时可随时重新打开本指南。",
    close: "关闭",
    done: "知道了",
    steps: [
      [
        "1. 设置个人资料并添加宠物",
        "无需登录即可体验示例宠物和日程。可在设置中修改姓名和时区。进入宠物页面，点击添加宠物并填写基本信息。保存后，可通过编辑宠物资料添加照片。",
      ],
      [
        "2. 创建照护日程",
        "点击添加日程，选择宠物及喂食、散步、用药等类型。设置开始日期、时间及重复规则后保存。用药日程还需要填写药物信息和结束条件。",
      ],
      [
        "3. 查看今日照护",
        "点击日程左侧的勾选按钮标记完成，再次点击可撤销。通过旁边的 ⋯ 菜单可编辑、跳过或延后10分钟提醒。修改重复日程时，请确认修改范围。",
      ],
      [
        "4. 使用日历与宠物筛选",
        "在日历中选择日期，查看当天的日程。点击页面上方的宠物筛选按钮，即可只查看该宠物的日程。",
      ],
      [
        "5. 保存文档与健康记录",
        "在文档库中选择宠物，上传诊疗文档或处方（JPEG、PNG、WebP 或 PDF，最大10MB）。进入手动审核，核对并修改内容，勾选确认项后保存已确认的健康记录。即使使用 AI 分析，也需要核对原文。审核后需另行创建用药日程。",
      ],
      [
        "6. 设置通知与语言",
        "在添加日程或通知页面点击启用并测试通知，并允许浏览器通知权限。点击10秒后演示通知，再切换页面即可演示。请保持浏览器运行。关闭应用后自动发送日程通知需要单独的定时发送服务。在设置中可选择韩语、英语或中文。",
      ],
    ],
  },
};

export default function UserGuide() {
  const [language] = useLanguage();
  const text = copy[language];
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="guide-trigger">
          <BookOpen size={18} aria-hidden="true" />
          <span>{text.title}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="guide-overlay" />
        <Dialog.Content className="guide-dialog">
          <div className="guide-header">
            <Dialog.Title>{text.title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
                aria-label={text.close}
              >
                <X size={22} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="guide-intro">
            {text.intro}
          </Dialog.Description>
          <div className="guide-steps">
            {text.steps.map(([title, description]) => (
              <section key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </section>
            ))}
          </div>
          <Dialog.Close asChild>
            <button type="button" className="primary guide-done">
              {text.done}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
