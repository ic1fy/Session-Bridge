import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(
  new URL("../src/web/index.html", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../src/web/styles.css", import.meta.url),
  "utf8",
);

test("presents the Session Bridge title and complete three-step guide", () => {
  assert.match(
    html,
    /<h1 id="title">[\s\S]*Session[\s\S]*Bridge[\s\S]*<\/h1>/,
  );
  assert.equal((html.match(/class="guide-step"/g) ?? []).length, 3);
  assert.match(html, /href="https:\/\/chatgpt\.com"/);
  assert.match(
    html,
    /href="https:\/\/chatgpt\.com\/api\/auth\/session"/,
  );
  assert.match(html, /全部内容（不可缺漏）/);
});

test("separates the title words and keeps the guide surface transparent", () => {
  assert.match(styles, /h1\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(styles, /h1\s*\{[^}]*gap:\s*0\.12em;/s);
  assert.match(
    styles,
    /\.session-guide\s*\{[^}]*background:\s*transparent;/s,
  );
});
