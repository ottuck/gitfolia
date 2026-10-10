# Botanical calendar

하루에 잎 하나. GitHub의 기여 기록을 수채화 양치식물, 동판화 허바리움, 미드나이트 식물 도감으로 표현합니다. **비공개 개발 중**입니다.

**2026년 · @ottuck 실제 GitHub 기여 · 2026-10-10 UTC 기준 · 1,318 contributions · 73 active days**

<table><tr><th>수채화 양치식물</th><th>동판화 허바리움</th><th>미드나이트 식물 도감</th></tr><tr><td><img src="images/calendar-watercolor.svg?v=84398fca7e1d" width="280" alt="수채화 양치식물 2026 daily contribution calendar" /></td><td><img src="images/calendar-herbarium.svg?v=1f2f8e7d088f" width="280" alt="동판화 허바리움 2026 daily contribution calendar" /></td><td><img src="images/calendar-midnight.svg?v=9b5671dae4a0" width="280" alt="미드나이트 식물 도감 2026 daily contribution calendar" /></td></tr></table>

## 날짜와 색

- 연도 전체를 고정합니다. 평년에는 일별 잎 365개, 윤년에는 366개이며 날짜가 바뀌어도 이전 잎의 위치는 같습니다.
- 일별 잎은 GitHub GraphQL의 contributionLevel(0–4)을 그대로 사용합니다. 커밋뿐 아니라 GitHub가 인정하는 다른 기여도 포함됩니다.
- 네 큰 줄기를 따라 주별 작은 가지를 배치합니다. 작은 가지의 일별 잎은 날짜순입니다. 큰 요약 잎은 일요일부터 토요일까지의 주 평균입니다.
- 주 평균은 이미 지난 날짜의 기여 수를 더하고 날짜 수로 나눕니다. 0인 날도 포함하며 미래 날짜는 제외합니다. 연초·연말의 일부 주는 그 연도에 속하는 날만 사용합니다. 요약 색은 최대 주 평균에 대한 네 단계이며 GitHub의 일별 색 공식과 다릅니다.
- 활동 없는 날은 선화, 미래 날짜는 더 옅은 선화입니다. 줄기와 뿌리는 항상 채색되어 있습니다. 모든 잎이 채워지는 목표 수치는 없습니다.
- 세 테마는 같은 날짜 배치를 공유합니다. 원화 후보의 잎을 그대로 세는 방식 대신, 각 화풍으로 만든 8개 잎 변형을 정확한 날짜 수에 맞춰 조합합니다.
- SVG는 내장 PNG 잎과 도형만 사용합니다. JavaScript와 외부 리소스 요청이 없습니다. URL 해시로 README 이미지 캐시를 갱신합니다.

## 실행과 미리보기

Actions → **Update botanical calendar** → 계정과 연도를 입력하면 기여 기록, 세 이미지, README가 갱신됩니다. 매일 00:20 UTC에도 갱신됩니다. 현재 기본 계정은 ottuck입니다.

```sh
npm ci --ignore-scripts
npm run verify
npm run render -- ottuck 2026 github
python -m http.server 8767 --bind 127.0.0.1
```

[로컬 미리보기](http://127.0.0.1:8767/calendar-preview/)에서 세 테마 비교, 날짜별 확인, 윤년 예시, 주 요약 표시, SVG 저장이 가능합니다. 브라우저는 저장된 실제 기록을 읽으며 토큰을 사용하지 않습니다.

## 인증과 공개

로컬 수집은 GH_TOKEN/GITHUB_TOKEN 또는 기존 gh 로그인을 사용합니다. Actions는 기존 GITHUB_TOKEN을 사용합니다. 기본 Actions 토큰으로 비공개 개인 기여까지 모두 조회할 수 있다고 보장하지 않습니다. 그런 기록이 필요하면 read:user 권한이 있는 토큰을 저장소 secret BOTANICAL_TOKEN에 설정할 수 있습니다. 비공개 기여를 포함한 집계 파일은 공개 전 검토하세요.

현재 저장소는 비공개이므로 외부 공개 프로필의 이미지 표시는 제한됩니다. 공개 전환 후 [프로필 삽입 코드](PROFILE-EMBED.md)를 사용할 수 있습니다.

이전 목표 커밋 기반 PoC는 scripts/render-v2.mjs와 preview/에 남아 있습니다.
