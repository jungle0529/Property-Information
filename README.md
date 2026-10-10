# 집뷰 분양 인사이트 (Property Information Newsletter)

올림플래닛 **집뷰(ZIPVIEW)** 세일즈 참고용 분양 정보 뉴스레터 페이지입니다.
시행사·시공사·광고대행사를 타겟으로, 다가올 분양 사업지(특히 **2026 하반기**)를
한눈에 보여주고 각 단지에 집뷰를 어떻게 제안할지 세일즈 포인트를 붙였습니다.

## 빠르게 보기

빌드 도구·서버 없이 정적 파일로 동작합니다.

```
# 그냥 열기
open index.html        # macOS
# 또는 로컬 서버
python3 -m http.server 8080   # → http://localhost:8080
```

## 구조

```
index.html                     # 뉴스레터 페이지 (kmjournal.net 풍 미니멀 에디토리얼)
assets/css/style.css           # 디자인 토큰·레이아웃
assets/js/data.js              # 시드 데이터 + 뉴스 샘플 (오프라인/file:// 폴백)
assets/js/app.js               # 필터/카드/테이블/KPI/Pick/타임라인 렌더링
data/projects.json             # 파이프라인 산출물(분양 일정·세대수) — 페이지가 우선 사용
data/news.json                 # 파이프라인 산출물(핫이슈 피드)
scripts/fetch-data.js          # 청약홈 OpenAPI + RSS 수집 → data/*.json
.github/workflows/update-data.yml  # 매일 자동 갱신(스케줄/수동)
docs/data-sources.md           # 데이터 소스 전략 (호갱노노 대안 포함)
```

데이터 로딩은 **점진적 향상(progressive enhancement)** 방식입니다. HTTP로 서빙되면
`data/projects.json`·`data/news.json`을 우선 사용하고, `file://`로 직접 열면 `data.js`
시드로 폴백합니다. 페이지는 어느 경우에도 동작합니다.

## 데이터 자동 수집

```
# 시드로 산출(키 없이도 유효 JSON 생성)
node scripts/fetch-data.js

# 청약홈 OpenAPI 실수집 (공공데이터포털 일반 인증키 필요)
APPLYHOME_SERVICE_KEY="발급키" node scripts/fetch-data.js
```

- 키는 공공데이터포털 → 청약홈 분양정보 조회 서비스(15098547) 활용신청 후 발급.
- CI 자동화: 저장소 **Settings → Secrets**에 `APPLYHOME_SERVICE_KEY` 등록 →
  `.github/workflows/update-data.yml`이 매일 갱신·커밋.
- ⚠ 응답 필드명/RSS 주소는 운영 전 Swagger·각 언론사 RSS로 **대조(확인 필요)**.

## 데이터는 어디서 가져오나 (요약)

| 항목 | 권장 소스 | 방식 | 비고 |
|---|---|---|---|
| 분양 일정·세대수 | 한국부동산원 **청약홈 분양정보 OpenAPI** (공공데이터포털) | 공식 API (무료) | 합법·안정. 코어 백본 |
| 시세·실거래가 | 국토부 **실거래가 공개시스템 OpenAPI** | 공식 API | 호갱노노 대체 |
| 건설사별 공급계획 | 비즈워치·각사 IR/보도자료 | 분기 수기 갱신 | 본 시드 데이터 출처 |
| 핫이슈/뉴스 | 언론사 **RSS** / 네이버 뉴스 검색 API | 피드 수집 | 크롤링 불필요 |

> **호갱노노는 사용하지 않습니다.** 이용약관상 크롤링·스크래핑·캐싱이 금지돼 있고
> 실제로 접근이 차단됩니다. 같은 정보를 위 공식 OpenAPI 조합으로 합법적으로 확보할 수 있습니다.
> 꼭 필요하면 B2B 제휴 문의가 정공법입니다. 자세한 내용은 `docs/data-sources.md` 참고.

## 데이터 갱신 방법

`assets/js/data.js`의 `SUPPLY_DATA` 배열에 사업지를 추가/수정합니다.
하반기(H2) 판정은 `app.js`가 `period` 값(`7월~12월`, `3분기`, `4분기`)으로 자동 처리합니다.

```js
{ builder: "현대건설", period: "9월", region: "서울",
  project: "디에이치 클래스트", general: 1803, total: 4765 }
```

## 컴플라이언스 메모

- 모든 수치는 **추정치이며 변동 가능**(자료 면책 문구 명시).
- 외부 공유 산출물에는 대외비 수치·미공개 IR·고객/파트너 데이터를 포함하지 마세요.
- 집뷰 제품 사양·효익 표현은 실제 제품 스펙으로 **확인 필요** 후 확정하세요.
