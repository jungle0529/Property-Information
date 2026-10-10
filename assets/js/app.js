/* =========================================================
   집뷰 분양 인사이트 — 렌더링 로직
   ========================================================= */
(function () {
  "use strict";

  // 데이터는 파이프라인 산출물(data/*.json)을 우선 사용하고,
  // file:// 등 fetch 불가 환경에서는 시드(window.SUPPLY_DATA)로 폴백한다.
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
      var title = n.link
        ? '<a class="nt" href="' + esc(n.link) + '" target="_blank" rel="noopener">' + esc(n.title) + '</a>'
        : '<div class="nt">' + esc(n.title) + '</div>';
      return '<div class="news-item"><span class="ntag">' + esc(n.tag || "뉴스") + '</span>' +
        '<div>' + title +
        '<div class="nmeta">' + esc(n.source || "") + (n.date ? ' · ' + esc(n.date) : '') + '</div></div></div>';
    }).join("");

    // 실데이터(원문 링크 보유) 여부로 안내 문구 전환
    var note = document.getElementById("news-note");
    if (note) {
      var live = NEWS.some(function (n) { return n.link; });
      if (live) {
        note.classList.add("live");
        note.innerHTML = "✓ 한경·경향 <b>RSS 자동수집</b> 결과입니다(매시간 갱신). 제목 클릭 시 원문으로 이동합니다. " +
          "(호갱노노 등 약관상 크롤링 금지 소스는 사용하지 않음)";
      }
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function refresh() { syncChips(); renderCards(); }

  // ── 이번 호 핵심(Editor's pick): 하반기 총가구 상위 3 ──
  function renderPicks() {
    var host = document.getElementById("picks");
    if (!host) return;
    var top = DATA.filter(function (d) { return isH2(d.period); })
      .sort(function (a, b) { return b.total - a.total; }).slice(0, 3);
    host.innerHTML = top.map(function (d, i) {
      return '<a class="pick" href="#h2"><span class="rk">0' + (i + 1) + '</span>' +
        '<div><div class="pt">' + esc(d.project) + '</div>' +
        '<div class="pm">' + esc(d.builder) + ' · ' + esc(d.region) + ' · ' + esc(d.period) + '</div></div>' +
        '<span class="pv">' + d.total.toLocaleString() + '<small>총가구</small></span></a>';
    }).join("");
  }

  // ── 하반기 월별 공급 분포 (CSS 바) ──────────
  function renderTimeline() {
    var host = document.getElementById("timeline");
    if (!host) return;
    var buckets = ["7월", "8월", "9월", "10월", "11월", "12월", "3분기", "4분기"];
    var agg = {};
    buckets.forEach(function (b) { agg[b] = 0; });
    DATA.forEach(function (d) { if (agg[d.period] != null) agg[d.period] += d.total; });
    var max = Math.max.apply(null, buckets.map(function (b) { return agg[b]; })) || 1;
    host.innerHTML = buckets.map(function (b) {
      var pct = Math.round((agg[b] / max) * 100);
      return '<div class="tl-row"><span class="tl-lbl">' + b + '</span>' +
        '<span class="tl-bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="tl-val">' + agg[b].toLocaleString() + '</span></div>';
    }).join("");
  }

  function setFreshness(meta) {
    var el = document.getElementById("freshness");
    if (!el || !meta) return;
    var d = meta.generatedAt ? meta.generatedAt.slice(0, 10) : "—";
    el.textContent = "데이터 기준 " + d + " · " + (meta.source || "");
  }

  function boot() {
    document.getElementById("today").textContent = new Date().toISOString().slice(0, 10);
    renderKPIs();
    buildFilters();
    renderCards();
    renderAccordion();
    renderNews();
    renderPicks();
    renderTimeline();
  }

  // ── init: JSON 우선, 실패 시 시드 폴백 ──────
  document.addEventListener("DOMContentLoaded", function () {
    if (typeof fetch !== "function" || location.protocol === "file:") { boot(); return; }
    Promise.all([
      fetch("data/projects.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch("data/news.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    ]).then(function (res) {
      var pj = res[0], nj = res[1];
      if (pj && pj.projects && pj.projects.length) { DATA = pj.projects; setFreshness(pj); }
      if (nj && nj.items && nj.items.length) { NEWS = nj.items; }
      boot();
    }).catch(function () { boot(); });
  });
})();
