#!/usr/bin/env node
/**
 * 분양 데이터 수집 파이프라인
 * ------------------------------------------------------------------
 * 출력:  data/projects.json  (분양 일정·세대수)
 *        data/news.json      (시황/핫이슈 피드)
 *
 * 소스
 *  1) 청약홈 분양정보 OpenAPI (한국부동산원, 공공데이터포털 서비스 15098547)
 *       - getAPTLttotPblancDetail            : APT 분양정보
 *       - getUrbtyOfctlLttotPblancDetail     : 오피스텔/도시형/민간임대/생활숙박
 *     base: https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1
 *     인증: 환경변수 APPLYHOME_SERVICE_KEY (공공데이터포털 일반 인증키, URL 디코딩값)
 *  2) 언론사 RSS (핫이슈)  — 환경변수/상수로 피드 URL 구성
 *
 * 키가 없으면(로컬/CI 미설정) 시드 데이터(assets/js/data.js)를 그대로 산출해
 * 페이지가 항상 유효한 JSON을 갖도록 한다(graceful fallback).
 *
 * 실행:  node scripts/fetch-data.js
 *        APPLYHOME_SERVICE_KEY=xxxx node scripts/fetch-data.js
 *
 * ⚠ 응답 필드명은 청약홈 분양정보 API 명세 기준이나, 운영 전 Swagger UI로 대조(확인 필요).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const SERVICE_KEY = process.env.APPLYHOME_SERVICE_KEY || "";
const YEAR = process.env.TARGET_YEAR || String(new Date().getFullYear());

const APPLY_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";

// 청약홈 응답 → 내부 스키마 매핑에 쓰는 필드명 (확인 필요: Swagger 대조)
const F = {
  name: "HOUSE_NM",            // 주택명
  total: "TOT_SUPLY_HSHLDCO",  // 총 공급 세대수
  region: "SUBSCRPT_AREA_CODE_NM", // 공급지역명
  addr: "HSSPLY_ADRES",        // 공급위치
  noticeDate: "RCRIT_PBLANC_DE", // 모집공고일
  rceptBgn: "SUBSCRPT_RCEPT_BGNDE", // 청약접수 시작
  rceptEnd: "SUBSCRPT_RCEPT_ENDDE", // 청약접수 종료
  developer: "BSNS_MBY_NM",    // 사업주체(시행)
  builder: "CNSTRCT_ENTRPS_NM",// 시공사
  url: "PBLANC_URL",           // 분양정보 URL
};

// 시·도명 → 본 페이지 권역 라벨 정규화
const REGION_MAP = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천",
  광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
  경기도: "경기", 강원특별자치도: "강원", 강원도: "강원",
  충청북도: "충북", 충청남도: "충남", 전라북도: "전북", 전북특별자치도: "전북",
  전라남도: "전남", 경상북도: "경북", 경상남도: "경남",
  제주특별자치도: "제주", 제주도: "제주",
};

// 핫이슈 RSS 피드 (2026.06 응답 확인). filter가 있으면 제목에 해당 키워드 포함분만 채택.
const RE_ESTATE = /분양|청약|재건축|재개발|아파트|부동산|오피스텔|입주|매매|전세|집값|주택|시행|시공/;
const RSS_FEEDS = [
  { source: "한국경제", tag: "부동산", url: "https://www.hankyung.com/feed/realestate" },
  { source: "경향신문", tag: "부동산", url: "https://www.khan.co.kr/rss/rssdata/economy_news.xml", filter: RE_ESTATE },
  // 매경·연합은 봇 차단(403)으로 미사용 — 필요 시 네이버 뉴스 검색 API로 대체(확인 필요).
];

function normRegion(v) { return REGION_MAP[v] || (v ? String(v).replace(/(특별|광역)?시$|도$/, "") : "기타"); }

// 모집공고일(YYYY-MM-DD/YYYYMMDD) → "9월" 형태 period 라벨
function periodFromDate(s) {
  if (!s) return "미정";
  const m = String(s).match(/(\d{4})[-.]?(\d{2})/);
  if (!m) return "미정";
  return parseInt(m[2], 10) + "월";
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return res.json();
}

// 청약홈 오퍼레이션 호출 — 해당 연도 모집공고분만 (cond[FIELD::GTE/LTE])
async function fetchApplyOp(op) {
  const all = [];
  const perPage = 100;
  for (let page = 1; page <= 20; page++) {
    const qs = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      serviceKey: SERVICE_KEY,
    });
    qs.append("cond[" + F.noticeDate + "::GTE]", YEAR + "-01-01");
    qs.append("cond[" + F.noticeDate + "::LTE]", YEAR + "-12-31");
    const url = APPLY_BASE + "/" + op + "?" + qs.toString();
    const json = await fetchJSON(url);
    const rows = json.data || [];
    all.push(...rows);
    if (rows.length < perPage) break;
  }
  return all;
}

function mapApplyRow(r) {
  const total = parseInt(r[F.total], 10) || 0;
  return {
    builder: (r[F.builder] || r[F.developer] || "기타").toString().trim(),
    period: periodFromDate(r[F.noticeDate]),
    region: normRegion(r[F.region]),
    project: (r[F.name] || "").toString().trim(),
    general: total,          // 일반분양 별도 필드 없으면 총공급으로 우선 표기(확인 필요)
    total: total,
    noticeDate: r[F.noticeDate] || null,
    rcept: r[F.rceptBgn] ? r[F.rceptBgn] + " ~ " + (r[F.rceptEnd] || "") : null,
    url: r[F.url] || null,
    _src: "applyhome",
  };
}

// pubDate(RFC822) → YYYY-MM-DD
function normDate(s) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d) ? s.slice(0, 16) : d.toISOString().slice(0, 10);
}

// 의존성 없는 RSS <item> 파서
function parseRSS(xml, feed) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const b of blocks) {
    const pick = (re) => { const m = b.match(re); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : ""; };
    const title = pick(/<title>([\s\S]*?)<\/title>/i);
    const link = pick(/<link>([\s\S]*?)<\/link>/i);
    const date = pick(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    if (!title) continue;
    if (feed.filter && !feed.filter.test(title)) continue; // 키워드 필터
    items.push({ source: feed.source, tag: feed.tag, title, link, date: normDate(date) });
  }
  return items;
}

async function fetchNews() {
  let out = [];
  for (const f of RSS_FEEDS) {
    try {
      const res = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 (newsletter-bot)" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      out.push(...parseRSS(await res.text(), f));
      console.log("  RSS " + f.source + ": " + out.length + "건 누적");
    } catch (e) {
      console.warn("  RSS 실패(" + f.source + "): " + e.message);
    }
  }
  // 제목 중복 제거 → 최신순 정렬 → 상위 8건
  const seen = {};
  out = out.filter((n) => (seen[n.title] ? false : (seen[n.title] = true)));
  out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return out.slice(0, 8);
}

// 시드 데이터 로드 (fallback)
function loadSeed() {
  const sandbox = { window: {} };
  const code = fs.readFileSync(path.join(ROOT, "assets/js/data.js"), "utf8");
  new Function("window", code)(sandbox.window);
  return { projects: sandbox.window.SUPPLY_DATA || [], news: sandbox.window.NEWS_FEED || [] };
}

function write(file, obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(obj, null, 2) + "\n");
  console.log("  → data/" + file + " (" + (obj.projects || obj.items || []).length + "건)");
}

(async function main() {
  const seed = loadSeed();
  const now = new Date().toISOString();
  let projects, source;

  // 분양 일정·세대수: 청약홈 키가 있으면 실수집, 없으면 시드
  if (SERVICE_KEY) {
    console.log("청약홈 OpenAPI 수집 (" + YEAR + ")…");
    try {
      const [apt, urb] = await Promise.all([
        fetchApplyOp("getAPTLttotPblancDetail"),
        fetchApplyOp("getUrbtyOfctlLttotPblancDetail"),
      ]);
      projects = [...apt, ...urb].map(mapApplyRow).filter((p) => p.project);
      source = "청약홈 분양정보 OpenAPI (한국부동산원) · " + YEAR;
      console.log("  수집 " + projects.length + "건");
    } catch (e) {
      console.warn("OpenAPI 실패 → 시드로 대체: " + e.message);
      projects = seed.projects; source = "시드 데이터 (비즈워치/각사 IR)";
    }
  } else {
    console.log("APPLYHOME_SERVICE_KEY 미설정 → 분양 데이터는 시드 사용.");
    projects = seed.projects; source = "시드 데이터 (비즈워치/각사 IR, 2026.02 기준)";
  }

  // 핫이슈: RSS는 키 불필요 — 항상 실수집
  console.log("RSS 핫이슈 수집…");
  let news = await fetchNews();
  if (!news.length) { console.warn("  RSS 0건 → 시드 샘플 사용"); news = seed.news; }

  write("projects.json", { generatedAt: now, source, projects });
  write("news.json", { generatedAt: now, items: news });
  console.log("완료.");
})().catch((e) => { console.error(e); process.exit(1); });
