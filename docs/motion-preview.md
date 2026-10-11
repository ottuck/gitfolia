# GitLeaf · A little breeze

같은 GitHub 기록에 작은 바람만 더한 SVG입니다. 가지와 그 가지의 잎이 함께 움직이며 뿌리·종이·글씨는 고정됩니다. 잎의 날짜, 기여 수, 색 단계는 정지 버전과 같습니다.

**[정지·애니메이션 비교 화면 열기](https://botanical-garden.ottuck.workers.dev/preview/ottuck)**

<table>
  <tr><th>Still · 정지</th><th>Breeze · 은은한 바람</th></tr>
  <tr>
    <td><img src="https://botanical-garden.ottuck.workers.dev/ottuck" width="320" alt="GitLeaf 정지 버전" /></td>
    <td><img src="https://botanical-garden.ottuck.workers.dev/ottuck?motion=breeze" width="320" alt="GitLeaf 애니메이션 버전" /></td>
  </tr>
</table>

[움직이는 SVG 크게 보기](https://botanical-garden.ottuck.workers.dev/ottuck?motion=breeze)

8–13초 동안 천천히 움직이는 아주 작은 흔들림입니다. 기기에서 움직임 줄이기를 켜면 정지합니다. 자바스크립트나 외부 이미지 요청을 사용하지 않습니다.

두 그림은 Cloudflare 서비스가 같은 실제 기여 기록으로 매일 생성합니다. README 파일이나 저장소의 `images/`는 자동 수정하지 않으며, 그림 갱신으로 Git 커밋이 생성되지 않습니다. 기존 기본 주소는 정지 버전을 제공하며 `?motion=breeze`를 추가하면 움직이는 SVG를 제공합니다. GitHub 원본 파일 주소는 보안 정책 때문에 크게 열었을 때 내장 잎 이미지가 차단되므로 서비스 주소를 사용합니다. README에서 움직임을 알아보기 어려우면 위 비교 화면을 열어 오른쪽 가지 끝을 몇 초 동안 바라보세요.

로컬 비교: 저장소의 개발용 스냅샷을 최신화하려면 먼저 `npm run render -- ottuck 2026 github`를 실행합니다. 이후 저장소 루트에서 `python -m http.server 8767 --bind 127.0.0.1` 실행 후 [비교 화면](http://127.0.0.1:8767/motion-preview/)을 엽니다.
