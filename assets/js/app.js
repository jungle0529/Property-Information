/* =========================================================
   집뷰 분양 인사이트 — 렌더링 로직
   ========================================================= */
(function () {
  "use strict";

  var DATA = window.SUPPLY_DATA || [];
  var NEWS = window.NEWS_FEED || [];

  // 분양 시기 → 정렬 키 & 상/하반기 판정
  // H2(하반기) = 7~12월 및 3·4분기
  var MONTH_ORDER = {
    "1월": 1, "2월": 2, "3월": 3, "4월": 4, "5월": 5, "6월": 6,
    "7월": 7, "8월": 8, "9월": 9, "10월": 10, "11월": 11, "12월": 12,
    "1분기": 2.5, "상반기": 3.5, "2분기": 5.5, "3분기": 8.5, "4분기": 11.5, "미정": 99
  };
  var H2_PERIODS = { "7월":1, "8월":1, "9월":1, "10월":1, "11월":1, "12월":1, "3분기":1, "4분기":1 };

  function isH2(p) { return !!H2_PERIODS[p]; }
  function orderOf(p) { return MONTH_ORDER[p] != null ? MONTH_ORDER[p] : 50; }

  // 사업지 유형 추정 → 집뷰 세일즈 피치 자동 생성
  function pitchFor(item) {
    var name = item.project;
    if (/오피스텔|주상복합|생활|레지던스/.test(name))
      return "수익형·소형 평형 다수 → 평형별 3D 공간 비교로 투자수요 설득";
    if (/재건축|재개발|구역/.test(name))
      return "조합원·일반분양 동시 진행 → 사이버 모델하우스로 비대면 설명 효율↑";
    if (item.total >= 2000)
      return "대단지·다(多)타입 → 타입별 가상 투어로 모델하우스 대기·동선 부담 해소";
    if (item.general / item.total < 0.3)
      return "일반분양 희소(경쟁 치열) → 3D 콘텐츠로 단지 가치 선제 어필";
    return "지방·실수요 단지 → 원거리 수요자 대상 온라인 3D 분양 마케팅 적합";
  }

  var state = { half: "H2", builder: "ALL", region: "ALL" };

  // ── KPI 계산 ───────────────────────────────
  function renderKPIs() {
    var h2 = DATA.filter(function (d) { return isH2(d.period); });
    var totGeneral = h2.reduce(function (s, d) { return s + d.general; }, 0);
    var totHouse = h2.reduce(function (s, d) { return s + d.total; }, 0);
    var builders = {}, regions = {};
    h2.forEach(function (d) { builders[d.builder] = 1; regions[d.region] = 1; });
    set("kpi-projects", h2.length);
    set("kpi-general", totGeneral.toLocaleString());
    set("kpi-house", totHouse.toLocaleString());
    set("kpi-builders", Object.keys(builders).length);
  }
  function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

  // ── 필터 UI ────────────────────────────────
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  function buildFilters() {
    // 건설사
    var builders = uniq(DATA.map(function (d) { return d.builder; }));
    var bWrap = document.getElementById("f-builder");
    bWrap.appendChild(chip("전체", "ALL", state.builder, function (v) { state.builder = v; refresh(); }));
    builders.forEach(function (b) {
      bWrap.appendChild(chip(b, b, state.builder, function (v) { state.builder = v; refresh(); }));
    });
    // 권역
    var regions = uniq(DATA.map(function (d) { return d.region; })).sort();
    var rWrap = document.getElementById("f-region");
    rWrap.appendChild(chip("전체", "ALL", state.region, function (v) { state.region = v; refresh(); }));
    regions.forEach(function (r) {
      rWrap.appendChild(chip(r, r, state.region, function (v) { state.region = v; refresh(); }));
    });
    // 시기(상/하반기)
    var hWrap = document.getElementById("f-half");
    [["하반기 (H2)", "H2", true], ["상반기 (H1)", "H1", false], ["전체", "ALL", false]].forEach(function (o) {
      hWrap.appendChild(chip(o[0], o[1], state.half, function (v) { state.half = v; refresh(); }, o[2]));
    });
  }

  function chip(label, val, current, onClick, isHL) {
    var b = document.createElement("button");
    b.className = "chip" + (isHL ? " hl" : "") + (val === current ? " active" : "");
    b.textContent = label;
    b.dataset.val = val;
    b.addEventListener("click", function () { onClick(val); });
    return b;
  }

  function syncChips() {
    document.querySelectorAll("#f-builder .chip").forEach(function (c) { c.classList.toggle("active", c.dataset.val === state.builder); });
    document.querySelectorAll("#f-region .chip").forEach(function (c) { c.classList.toggle("active", c.dataset.val === state.region); });
    document.querySelectorAll("#f-half .chip").forEach(function (c) { c.classList.toggle("active", c.dataset.val === state.half); });
  }

  // ── 카드 렌더 ──────────────────────────────
  function filtered() {
    return DATA.filter(function (d) {
      if (state.half === "H2" && !isH2(d.period)) return false;
      if (state.half === "H1" && (isH2(d.period) || d.period === "미정")) return false;
      if (state.builder !== "ALL" && d.builder !== state.builder) return false;
      if (state.region !== "ALL" && d.region !== state.region) return false;
      return true;
    }).sort(function (a, b) { return orderOf(a.period) - orderOf(b.period); });
  }

  function renderCards() {
    var grid = document.getElementById("card-grid");
    var rows = filtered();
    grid.innerHTML = "";
    document.getElementById("result-count").textContent = rows.length + "개 단지";
    if (!rows.length) {
      grid.innerHTML = '<div class="empty">조건에 맞는 사업지가 없습니다. 필터를 조정해 보세요.</div>';
      return;
    }
    rows.forEach(function (d) {
      var h2 = isH2(d.period);
      var el = document.createElement("article");
      el.className = "card" + (h2 ? " h2hl" : "");
      el.innerHTML =
        '<div class="row1">' +
          '<span class="badge period">' + esc(d.period) + '</span>' +
          (h2 ? '<span class="badge h2">하반기</span>' : '<span class="badge">' + esc(d.region) + '</span>') +
        '</div>' +
        '<h3>' + esc(d.project) + '</h3>' +
        '<div class="builder">' + esc(d.builder) + ' · ' + esc(d.region) + '</div>' +
        '<div class="nums">' +
          '<div class="n">' + d.general.toLocaleString() + '<small>일반분양(가구)</small></div>' +
          '<div class="n">' + d.total.toLocaleString() + '<small>총가구</small></div>' +
        '</div>' +
        '<div class="pitch">▶ 집뷰 활용: ' + esc(pitchFor(d)) + '</div>';
      grid.appendChild(el);
    });
  }

  // ── 건설사별 아코디언 테이블 ────────────────
  function renderAccordion() {
    var host = document.getElementById("by-builder");
    var builders = uniq(DATA.map(function (d) { return d.builder; }));
    host.innerHTML = "";
    builders.forEach(function (b) {
      var rows = DATA.filter(function (d) { return d.builder === b; })
        .sort(function (x, y) { return orderOf(x.period) - orderOf(y.period); });
      var sumG = rows.reduce(function (s, d) { return s + d.general; }, 0);
      var h2n = rows.filter(function (d) { return isH2(d.period); }).length;
      var det = document.createElement("details");
      det.className = "acc";
      var body = rows.map(function (d) {
        return '<tr class="' + (isH2(d.period) ? "h2row" : "") + '">' +
          '<td>' + esc(d.period) + '</td>' +
          '<td>' + esc(d.project) + '</td>' +
          '<td>' + esc(d.region) + '</td>' +
          '<td class="num">' + d.general.toLocaleString() + '</td>' +
          '<td class="num">' + d.total.toLocaleString() + '</td>' +
        '</tr>';
      }).join("");
      det.innerHTML =
        '<summary><span>' + esc(b) + '</span>' +
        '<span class="meta">' + rows.length + '개 단지 · 일반분양 ' + sumG.toLocaleString() + '가구 · 하반기 ' + h2n + '개</span></summary>' +
        '<table class="supply"><thead><tr><th>분양시기</th><th>사업지</th><th>권역</th>' +
        '<th class="num">일반분양</th><th class="num">총가구</th></tr></thead><tbody>' + body + '</tbody></table>';
      host.appendChild(det);
    });
  }

  // ── 뉴스 피드 ──────────────────────────────
  function renderNews() {
    var host = document.getElementById("news-list");
    host.innerHTML = NEWS.map(function (n) {
      return '<div class="news-item"><span class="ntag">' + esc(n.tag) + '</span>' +
        '<div><div class="nt">' + esc(n.title) + '</div>' +
        '<div class="nmeta">' + esc(n.source) + ' · ' + esc(n.date) + '</div></div></div>';
    }).join("");
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function refresh() { syncChips(); renderCards(); }

  // ── init ───────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("today").textContent = new Date().toISOString().slice(0, 10);
    renderKPIs();
    buildFilters();
    renderCards();
    renderAccordion();
    renderNews();
  });
})();
