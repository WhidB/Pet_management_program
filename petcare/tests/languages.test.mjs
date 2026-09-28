import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  dictionaries,
  translate,
  translateError,
} from "../lib/translations.mjs";
const root = new URL("../", import.meta.url);
function files(directory) {
  if (directory instanceof URL) directory = fileURLToPath(directory);
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : /\.(tsx?|mjs)$/.test(entry.name)
          ? [path.join(directory, entry.name)]
          : [],
    );
}
test("English and Chinese cover the same nonempty translation keys", () => {
  assert.deepEqual(
    Object.keys(dictionaries.en).sort(),
    Object.keys(dictionaries.zh).sort(),
  );
  for (const dictionary of Object.values(dictionaries))
    for (const value of Object.values(dictionary)) {
      assert.ok(value.trim());
      assert.doesNotMatch(value, /[가-힣]/);
    }
});
test("All literal UI translations and server validation errors have translations", () => {
  const missing = [];
  for (const file of [
    ...files(new URL("app", root)),
    ...files(new URL("lib", root)),
  ]) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      if (
        (ts.isCallExpression(node) &&
          node.expression.getText(source) === "t") ||
        (ts.isNewExpression(node) &&
          ["AppError", "Error"].includes(node.expression.getText(source)))
      ) {
        const arg = node.arguments?.[0];
        if (
          arg &&
          ts.isStringLiteral(arg) &&
          /[가-힣]/.test(arg.text) &&
          !(arg.text.trim() in dictionaries.en)
        )
          missing.push(arg.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual([...new Set(missing)], []);
});
test("App JSX contains no hardcoded Korean, Chinese or English captions", () => {
  const raw = [];
  for (const filename of [
    "pet-app.tsx",
    "extra-pages.tsx",
    "welcome.tsx",
    "language-select.tsx",
    "file-input.tsx",
  ]) {
    const source = ts.createSourceFile(
      filename,
      fs.readFileSync(new URL(`app/${filename}`, root), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      if (ts.isJsxText(node) && /[a-zA-Z가-힣\u4e00-\u9fff]/.test(node.text))
        raw.push(node.text.trim());
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(raw, []);
});
test("Switching language retranslates an already displayed error or success message", () => {
  assert.equal(translate(translate("저장했습니다", "en"), "zh"), "已保存");
  assert.equal(
    translateError(translate("체중을 확인하세요.", "zh"), "en"),
    "Check the weight.",
  );
  assert.equal(translateError("Failed to fetch", "zh"), "请求失败，请重试。");
  assert.equal(
    translateError("Unknown server exception", "ko"),
    "요청에 실패했습니다.",
  );
});
test("Counts and selected-language names do not leak another language", () => {
  assert.equal(
    translate("14번의 작은 돌봄이 기다려요", "zh"),
    "今天有 14 项照护待完成",
  );
  assert.equal(
    translate("1개 완료했어요. 오늘도 잘 챙겨주고 있네요.", "en"),
    "1 completed. You’re doing great today.",
  );
  assert.equal(translate("영어", "zh"), "英语");
  assert.equal(translate("중국어 (간체)", "en"), "Chinese (Simplified)");
});
