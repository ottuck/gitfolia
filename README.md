# Botanical calendar

하루에 잎 하나. 이 README에는 **수채화 양치식물 한 장**으로 실제 GitHub 기여 기록을 전시합니다. **비공개 개발 중**입니다.

**2026년 · @ottuck 실제 GitHub 기여 · 2026-10-11 UTC 기준 · 1,327 contributions · 74 active days**

[GitHub 기여 달력에서 확인](https://github.com/ottuck?tab=overview&from=2026-01-01&to=2026-10-11) · [날짜별 기록](images/calendar-data.json) · [기록과 채색 대조 결과](images/calendar-validation.json) · [지금 기록 갱신](https://github.com/ottuck/botanical-readme-poc/actions/workflows/calendar.yml)

<p align="center"><img src="images/calendar-watercolor.svg?v=b82ede3a89d3" width="480" alt="수채화 양치식물 2026 daily contribution calendar" /></p>

그림 하단의 **Grown from 1,327 contributions.**는 올해의 기여 합계입니다. 그 아래에는 활동한 날짜 수와 GitHub 계정을 적었습니다. 잎의 색과 숫자가 같은 기록에서 함께 갱신됩니다.

## 날짜와 색

- 연도 전체를 고정합니다. 평년에는 일별 잎 365개, 윤년에는 366개이며 날짜가 바뀌어도 이전 잎의 위치는 같습니다.
- 일별 잎은 GitHub GraphQL의 contributionLevel(0–4)을 그대로 사용합니다. 커밋뿐 아니라 GitHub가 인정하는 다른 기여도 포함됩니다.
- 같은 단계에 속하는 날은 기여 수가 달라도 같은 농도로 표시합니다. 채색 잎은 불투명도 38%, 59%, 80%, 100%와 명도 조정을 함께 사용합니다. 활동 없는 날의 선화를 낮춰, 1단계 활동도 빈 날보다 확실히 드러납니다. 단계가 높을수록 채색이 진해집니다.
- 네 큰 줄기를 따라 주별 작은 가지를 배치합니다. 작은 가지의 일별 잎은 날짜순입니다. 큰 요약 잎은 일요일부터 토요일까지의 주 평균입니다.
- 주 평균은 이미 지난 날짜의 기여 수를 더하고 날짜 수로 나눕니다. 0인 날도 포함하며 미래 날짜는 제외합니다. 연초·연말의 일부 주는 그 연도에 속하는 날만 사용합니다. 요약 색은 최대 주 평균에 대한 네 단계이며 GitHub의 일별 색 공식과 다릅니다.
- 활동 없는 날은 선화, 미래 날짜는 더 옅은 선화입니다. 줄기와 뿌리는 항상 채색되어 있습니다. 모든 잎이 채워지는 목표 수치는 없습니다.
- 수채화 원화로 만든 8개 잎 변형을 정확한 날짜 수에 맞춰 조합합니다.
- SVG는 내장 PNG 잎과 도형만 사용합니다. JavaScript와 외부 리소스 요청이 없습니다. URL 해시로 README 이미지 캐시를 갱신합니다.

## 실행과 미리보기

이 저장소의 코드가 main에 push되면 기여 기록과 전시 이미지를 자동 갱신합니다. 생성된 README·images만 변경한 push는 제외합니다. 다른 저장소에서 새로 기여한 뒤 바로 확인하려면 위의 **지금 기록 갱신** → **Run workflow**를 실행하세요. 매일 00:20 UTC에도 갱신됩니다. 현재 기본 계정은 ottuck입니다.

```sh
npm ci --ignore-scripts
npm run verify
npm run render -- ottuck 2026 github
npm run verify:actual
python -m http.server 8767 --bind 127.0.0.1
```

[로컬 미리보기](http://127.0.0.1:8767/calendar-preview/)에서 날짜별 확인, 윤년 예시, 주 요약 표시, SVG 저장이 가능합니다. 브라우저는 저장된 실제 기록을 읽으며 토큰을 사용하지 않습니다.

기록 선택에서 **검증: 연초부터 연말까지**, **검증: 연말 40~95기여**, **검증: 매일 30~90기여**를 고르면 12월 31일까지의 고정 테스트 데이터로 확인할 수 있습니다. 연말 집중 예시는 12월 25일만 활동 없는 날로 남깁니다. 테스트 데이터는 실제 GitHub 기여 기록에 섞이지 않습니다.

검증은 새 GitHub 응답과 저장된 날짜별 기여 수·단계, SVG의 잎 이미지 참조와 실제 PNG 채색까지 대조합니다. 주간 평균도 독립적으로 계산합니다. Actions는 검증이 통과한 이미지와 images/calendar-validation.json만 반영합니다. 수집 도중 기록이 바뀌어 불일치가 생기면 갱신을 중단하므로 다시 실행하세요.

## 인증과 공개

로컬 수집은 GH_TOKEN/GITHUB_TOKEN 또는 기존 gh 로그인을 사용합니다. Actions는 기존 GITHUB_TOKEN을 사용합니다. 기본 Actions 토큰으로 비공개 개인 기여까지 모두 조회할 수 있다고 보장하지 않습니다. 그런 기록이 필요하면 read:user 권한이 있는 토큰을 저장소 secret BOTANICAL_TOKEN에 설정할 수 있습니다. 비공개 기여를 포함한 집계 파일은 공개 전 검토하세요.

현재 저장소는 비공개이므로 외부 공개 프로필의 이미지 표시는 제한됩니다. 공개 전환 후 [프로필 삽입 코드](PROFILE-EMBED.md)를 사용할 수 있습니다.

이전 목표 커밋 기반 PoC는 scripts/render-v2.mjs와 preview/에 남아 있습니다.
