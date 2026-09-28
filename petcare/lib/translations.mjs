import en from "./locales/en.json" with { type: "json" };
import zh from "./locales/zh.json" with { type: "json" };
export const dictionaries = { en, zh };
const canonical = new Map(Object.keys(en).map((key) => [key, key]));
for (const dictionary of Object.values(dictionaries)) {
  for (const [key, value] of Object.entries(dictionary))
    canonical.set(value, key);
}
export function translate(text, language = "ko") {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  const key = canonical.get(trimmed);
  if (key)
    return text.replace(
      trimmed,
      language === "ko" ? key : dictionaries[language]?.[key] || key,
    );
  let match = trimmed.match(/^(\d+)번의 작은 돌봄이 기다려요$/);
  if (match)
    return language === "zh"
      ? `今天有 ${match[1]} 项照护待完成`
      : language === "en"
        ? `${match[1]} little ${match[1] === "1" ? "act" : "acts"} of care today`
        : text;
  match = trimmed.match(/^(\d+)개 완료했어요\. 오늘도 잘 챙겨주고 있네요\.$/);
  if (match)
    return language === "zh"
      ? `已完成 ${match[1]} 项，今天也照顾得很好。`
      : language === "en"
        ? `${match[1]} completed. You’re doing great today.`
        : text;
  match = trimmed.match(
    /^AI 분석에 실패했습니다 \((\d+)\)\. 원본은 보관되어 있으며 다시 시도하거나 직접 입력할 수 있습니다\.$/,
  );
  if (match)
    return language === "zh"
      ? `智能分析失败（${match[1]}）。原件已保存，请重试或手动填写。`
      : language === "en"
        ? `AI analysis failed (${match[1]}). Your original is saved. Retry or enter details manually.`
        : text;
  return text;
}
export function translateError(text, language = "ko") {
  if (
    typeof text === "string" &&
    (canonical.has(text.trim()) || /^AI 분석에 실패했습니다 \(\d+\)/.test(text))
  )
    return translate(text, language);
  return translate("요청에 실패했습니다.", language);
}
