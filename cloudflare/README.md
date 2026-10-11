# GitLeaf · Cloudflare development

Worker 한 개가 실제 GitHub 기여 기록을 수채화 식물로 만들어 제공합니다. D1은 사용자와 갱신 상태, R2는 완성된 SVG를 저장합니다. 이미지 주소는 로그인 없이 접근할 수 있습니다.

## 바로 사용

현재 배포: https://botanical-garden.ottuck.workers.dev

README에 아래 한 줄을 붙여 넣습니다. `ottuck`을 자신의 GitHub 아이디로 바꾸면 됩니다. 사용자별 GitHub Actions 설정이나 회원가입이 필요하지 않습니다.

```html
<p align="center"><img src="https://botanical-garden.ottuck.workers.dev/ottuck" width="320" alt="My GitLeaf garden" /></p>
```

[실제 그림 보기](https://botanical-garden.ottuck.workers.dev/ottuck)

<p align="center"><img src="https://botanical-garden.ottuck.workers.dev/ottuck" width="320" alt="ottuck의 실제 GitHub 기여로 그린 수채화 식물" /></p>

기본 예시는 가운데 정렬, 폭 320px입니다. `width`를 바꾸면 크기를 조절할 수 있습니다. 정렬은 복붙한 `<p align="center">`가 지정하며 이미지 서버에서 강제하지 않습니다. 프로필 README 맨 아래에 두면 프로젝트 소개 뒤에 작은 작품처럼 전시할 수 있습니다.

Cloudflare가 제공하는 `workers.dev` 주소를 사용하므로 별도 도메인 구매가 필요하지 않습니다. `/사용자명` 주소는 확장자 없이 SVG 이미지를 반환합니다. 기존 `/garden/사용자명.svg` 주소도 같은 그림과 갱신 상태를 사용하므로 이미 붙인 코드를 바꿀 필요는 없습니다.

- 기본값은 현재 UTC 연도입니다. 같은 주소가 새해에는 새 연도의 그림을 제공합니다.
- `?year=2024`처럼 연도를 고정할 수 있습니다. 2008년부터 현재 연도까지 지원합니다.
- 첫 요청에서 그림을 생성하고 사용자를 등록합니다. 이후 요청은 저장된 SVG를 재사용합니다.
- 작은 잎은 날짜 하나, 색 단계는 GitHub의 `contributionLevel`, 큰 잎은 주 평균입니다. 합계는 커밋에만 한정하지 않는 GitHub contributions입니다.
- 모든 사용자의 조회는 서비스에 설정한 GitHub 토큰의 권한 범위를 따릅니다. 다른 사용자의 비공개 기록이 모두 포함된다고 보장하지 않습니다. 사용자별 비공개 기록 연동을 위한 OAuth는 이번 버전에 포함하지 않습니다.

## 갱신

각 그림은 매일 00:20 UTC(한국 시간 09:20) 이후 한 번 갱신됩니다. Cron은 10분마다 최대 4개의 갱신 대상을 처리합니다. 사용자 작업을 나누어 처리하기 위한 확인이며, 그림을 10분마다 재생성하지 않습니다. 대상이 적으면 09:20에 처리되고 대상이 많으면 뒤 배치로 이어집니다. 기본 배치 크기로 하루 최대 576건을 처리할 수 있으므로 수요가 커지면 실행 한도와 API 할당량을 측정하여 배치·스케줄을 조정하거나 Queues를 추가합니다.

GitHub 요청에 실패하거나 날짜별 데이터가 불완전하면 기존 이미지를 유지하고 1시간부터 최대 24시간까지 간격을 늘려 재시도합니다. 존재하지 않는 계정은 24시간 동안 재조회를 피합니다. D1의 `lock_until`과 `lock_token`으로 동시에 들어온 요청과 예약 실행의 중복 생성을 제어합니다.

SVG는 `Cache-Control: public, max-age=3600, s-maxage=3600`과 ETag를 반환합니다. HEAD와 조건부 요청(304)을 지원합니다. README의 이미지 프록시 캐시 때문에 서버 갱신 시각과 README에서 새 그림을 보는 시각이 같다고 보장하지 않습니다. [GitHub 이미지 프록시 안내](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls)

## 로컬 개발

Node.js 22 이상이 필요합니다. 아래 명령은 `cloudflare/` 폴더에서 실행합니다.

```sh
npm ci
npm test
npm run db:local
```

로컬용 `cloudflare/.dev.vars` 파일에 `GITHUB_TOKEN="..."`을 설정한 뒤 `npm run dev`를 실행합니다. 이 파일은 Git에서 제외됩니다. 실제 서비스 토큰과 별도로 읽기 목적의 GitHub 토큰을 사용할 수 있습니다.

- 이미지: `http://localhost:8787/ottuck`
- 상태: `http://localhost:8787/health` (프로그램 응답 확인이며 저장소·GitHub API의 정상 동작을 보장하는 검사는 아닙니다)
- 예약 실행 테스트: `http://localhost:8787/__scheduled?cron=*/10%20*%20*%20*%20*` (로컬 개발 전용)

로컬과 배포 환경은 같은 SQL 마이그레이션을 사용하지만 저장소는 분리됩니다. 테스트의 가짜 기여와 인증 정보는 격리된 임시 Miniflare 저장소에만 존재합니다.

## 배포

이 저장소의 `wrangler.jsonc`에는 ottuck의 실제 배포 계정·D1 ID가 들어 있습니다. 다른 계정에 설치할 때는 반드시 자신의 계정·저장소로 바꿉니다. [Wrangler 설정](https://developers.cloudflare.com/workers/wrangler/configuration/)

```sh
npx wrangler login
npx wrangler whoami
npx wrangler d1 create botanical-garden
npx wrangler r2 bucket create botanical-gardens
```

`wrangler.jsonc`의 `account_id`를 자신의 계정 ID로, `database_id`를 방금 만든 D1 ID로 변경하고 필요하면 Worker·DB·버킷 이름도 변경합니다. R2는 계정에서 활성화되어 있어야 합니다.

```sh
npm run db:remote
npm run deploy
npx wrangler secret put GITHUB_TOKEN
```

GitHub 토큰은 Cloudflare의 Worker secret으로 저장하며 URL, 저장소 파일, 클라이언트에 넣지 않습니다. 인증된 GitHub CLI 로그인을 명시적으로 사용하려면 `npm run secret:github -- --from-gh`을 실행할 수도 있습니다. 이 명령은 토큰을 명령행 인수나 파일로 쓰지 않고 표준 입력으로 전달합니다. 운영용 전용 토큰으로 바꾸려면 `wrangler secret put GITHUB_TOKEN`을 다시 실행합니다.

GitHub의 `cloudflare-test.yml`은 코드 테스트만 실행하며 자동으로 배포하거나 토큰을 사용하지 않습니다. 서버를 업데이트하려면 테스트 후 `npm run deploy`를 실행합니다. 기존 저장소 이미지용 `calendar.yml`은 별개로 유지하며 `images/`만 갱신합니다. 서비스 소개용 루트 README와 프로필 삽입 안내는 자동 생성하지 않습니다.

## 검증

```sh
npm test
npm run verify:live -- https://botanical-garden.ottuck.workers.dev ottuck
```

17개의 테스트가 workerd, D1, R2에서 최초 생성·재사용·확장자 없는 주소와 기존 주소의 이미지·등록·캐시 공유·365/366일 채색·연말 집중 활동·과거 잎 갱신·일일 중복 방지·장애 복구·불완전 기록·동시 실행·배치·연도 변경·잘못된 URL·누락된 secret·리다이렉트 차단·저장 이미지 유실 복구를 확인합니다. 테스트는 GitHub 네트워크에 접속하지 않습니다.

`verify:live`는 배포한 서비스에서 받은 그림을 별도의 새 GitHub 응답과 대조합니다. 일별 기여 수, 단계, 실제 잎 PNG, 미래 날짜, 주간 평균과 그림 하단 합계까지 확인하고 `test-output/live/`에 SVG와 검증 보고서를 저장합니다. 검증 도중 실제 기록이 바뀌거나 검증 계정의 조회 권한이 서비스와 다르면 불일치로 실패할 수 있습니다.

## 운영 확인

`wrangler tail`로 `garden_refresh_batch` 및 오류 코드를 확인합니다. D1의 `updated_at`, `next_refresh_at`, `failure_count`, `last_error`로 계정별 갱신 상태를 확인할 수 있습니다. 실제 스케줄은 [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)를 사용합니다.

초기 버전은 하나의 Worker 안에서 작은 배치로 처리합니다. GitHub API 할당량과 [Workers 실행 한도](https://developers.cloudflare.com/workers/platform/limits/)의 제약을 받으며, 전체 운영 비용이 무료라고 보장하지 않습니다. 공개 서비스 규모의 사용자 인증·가입 제한·관리 화면은 아직 포함하지 않습니다.
