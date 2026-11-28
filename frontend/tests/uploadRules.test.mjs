import { test } from "node:test";
import assert from "node:assert/strict";
import { attachedFiles, checkUploadRequest, MAX_FILE_BYTES, newFilePath } from "../../supabase/functions/_shared/files.ts";
import { checkFile, MAX_FILE_BYTES as CLIENT_MAX } from "../src/lib/orders/uploadRules.ts";

test("画面とサーバーで上限が同じ（20 MB）", () => {
  assert.equal(MAX_FILE_BYTES, 20 * 1024 * 1024);
  assert.equal(CLIENT_MAX, MAX_FILE_BYTES);
});

test("アップロード前の検査: PDF だけ・20 MB まで", () => {
  assert.equal(checkUploadRequest({ name: "a.pdf", size: 10, type: "application/pdf" }).ok, true);
  assert.deepEqual(checkUploadRequest({ name: "a.png", size: 10, type: "image/png" }), { ok: false, error: "pdf_only" });
  assert.deepEqual(checkUploadRequest({ name: "a.pdf", size: MAX_FILE_BYTES + 1, type: "application/pdf" }), { ok: false, error: "too_large" });
  assert.equal(checkFile({ name: "a.PDF", size: 10, type: "application/pdf" }), null);
  assert.equal(checkFile({ name: "a.pdf", size: 10, type: "text/plain" }), "pdf_only");
});

test("保存先のパスは日付とランダム ID だけ（利用者のファイル名を使わない）", () => {
  const p = newFilePath(new Date("2026-11-28T16:00:00Z"), "0F8FAD5B-D9CB-469F-A165-70867728950E");
  assert.equal(p, "pending/2026-11-29/0f8fad5b-d9cb-469f-a165-70867728950e.pdf");
});

test("申込の添付: 形の違うパス・重複・4 件以上は拒否、名前と大きさを整える", () => {
  const path = "pending/2026-11-29/0f8fad5b-d9cb-469f-a165-70867728950e.pdf";
  const ok = attachedFiles({ bowing: { files: [{ path, name: " s.pdf ", size: 12, x: 1 }] } });
  assert.deepEqual(ok, { ok: true, files: [{ path, name: "s.pdf", size: 12 }] });
  assert.equal(attachedFiles({ bowing: { files: [{ path: "../x.pdf" }] } }).ok, false);
  assert.equal(attachedFiles({ bowing: { files: [{ path }, { path }] } }).ok, false);
  const four = Array.from({ length: 4 }, (_, i) => ({ path: path.replace("0f8f", `0f8${i}`) }));
  assert.equal(attachedFiles({ bowing: { files: four } }).ok, false);
  assert.deepEqual(attachedFiles({ bowing: {} }), { ok: true, files: [] });
});
