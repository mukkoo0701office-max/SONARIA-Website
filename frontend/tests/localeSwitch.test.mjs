import { test } from "node:test";
import assert from "node:assert/strict";
import { switchTarget } from "../src/lib/localeSwitch.ts";

const partial = { "/composers/sevcik/": ["ja"], "/scores/category/etude/": ["ja"], "/scores/category/": [] };

test("全言語にあるページは同じパスへ", () => {
  assert.equal(switchTarget("/scores/", "en", partial), "/scores/");
  assert.equal(switchTarget("/composers/bach/", "en", partial), "/composers/bach/");
});
test("その言語に無いページは 1 つ上の階層へ", () => {
  assert.equal(switchTarget("/composers/sevcik/", "en", partial), "/composers/");
  assert.equal(switchTarget("/scores/category/etude/", "en", partial), "/scores/");
});
test("ある言語へはそのまま", () => {
  assert.equal(switchTarget("/composers/sevcik/", "ja", partial), "/composers/sevcik/");
  assert.equal(switchTarget("/", "en", partial), "/");
});
