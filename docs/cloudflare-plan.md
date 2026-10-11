# Cloudflare 서비스 작업 계획

목표: 사용자가 README에 이미지 URL 하나를 붙이면 자신의 실제 GitHub 기여 기록을 수채화 식물로 볼 수 있게 한다. Worker 한 개, D1 한 개, R2 버킷 한 개를 사용한다. 기존 저장소는 비공개로 유지한다.

1. 기존 순수 JavaScript SVG 생성기와 수채화 잎 원화를 그대로 재사용한다.
2. TypeScript Worker에 `/garden/{login}.svg`를 구현한다. 최초 요청에서 등록·생성하고 이후 요청에는 저장된 SVG를 반환한다. `?year=2026`으로 연도를 고정할 수 있다.
3. D1에 사용자와 갱신 상태, R2에 완성된 SVG를 저장한다. GitHub 인증 정보는 Worker secret으로만 전달한다.
4. 하루 한 번 00:20 UTC 이후 갱신한다. Cron은 10분마다 최대 4개의 갱신 대상만 처리한다. 그림은 하루 한 번 생성하며 여러 사용자 작업을 나누기 위한 예약 확인이다. 중복 생성은 D1 임대로 제어하고 실패 시 기존 그림을 유지한다.
5. 실제 Workers 런타임(workerd), D1, R2로 최초 생성, 재사용, 연말·윤년 채색, 갱신, 실패 유지, 중복 실행, 연도 변경, 캐시 응답을 테스트한다.
6. 실제 계정의 GitHub 기록으로 그림을 검증하고 Worker 번들·마이그레이션·배포 설정을 확인한다.
7. Cloudflare 계정 연결이 있으면 전용 리소스를 만들고 배포를 검증한다. 없거나 서비스 활성화가 필요하면 코드·검증을 먼저 완료하고 필요한 계정 작업만 안내한다.

완료 기준: 테스트 데이터가 실제 기록에 섞이지 않으며, Worker가 기여별 잎과 합계를 정확히 생성하고, 동일 URL로 갱신된 이미지를 반환한다. 배포 성공 여부는 실제 공개 URL 요청으로 확인한다.

## 진행 결과

- 구현·16개 로컬 테스트·TypeScript 검사·번들 생성·원격 SQL 마이그레이션 완료.
- Worker `botanical-garden`, D1 `botanical-garden`, R2 `botanical-gardens`를 실제 계정에 구성하고 배포 완료.
- 기존 GitHub CLI 인증을 사용해 Worker secret `GITHUB_TOKEN`을 설정했다. 토큰은 저장소 파일·URL·응답에 포함하지 않았다.
- https://botanical-garden.ottuck.workers.dev/garden/ottuck.svg 에서 실제 이미지 제공을 확인했다.
- 2026-10-11 UTC 기준 실제 GitHub 응답과 일별 잎 365개, 주별 잎 53개를 독립적으로 대조하여 불일치 0건을 확인했다. 당시 합계는 1,332 contributions, 74 active days였다. 저장 그림 재사용과 304 응답도 확인했다.
- 코드 저장소 공개 전환과 개인 프로필 README 수정은 하지 않는다. 누구나 사용할 수 있는 이미지 주소와 운영 안내는 cloudflare/README.md에 기록한다.
