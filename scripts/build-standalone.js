#!/usr/bin/env node
/**
 * 단일 HTML 빌드 — index.html의 외부 CSS/JS를 인라인해
 * 더블클릭만으로 열리는 portable 파일(dist/newsletter.html)을 생성한다.
 * (data.js 시드가 내장되므로 서버 없이도 동작)
 *
 * 실행: node scripts/build-standalone.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let html = read("index.html");
const css = read("assets/css/style.css");
const data = read("assets/js/data.js");
const app = read("assets/js/app.js");

html = html
  .replace(/<link rel="stylesheet" href="assets\/css\/style\.css" \/>/,
           "<style>\n" + css + "\n</style>")
  .replace(/<script src="assets\/js\/data\.js"><\/script>/,
           "<script>\n" + data + "\n</script>")
  .replace(/<script src="assets\/js\/app\.js"><\/script>/,
           "<script>\n" + app + "\n</script>");

// 안내 주석
html = html.replace(/<head>/,
  "<head>\n  <!-- 단일 배포본: scripts/build-standalone.js 산출물. 더블클릭하여 열거나 공유 가능. -->");

fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "dist/newsletter.html"), html);
console.log("→ dist/newsletter.html (" + (html.length / 1024).toFixed(0) + " KB)");
