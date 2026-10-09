# 프로필 README 삽입 검증

다른 저장소의 README에 넣을 때 사용하는 **절대 URL**로 같은 이미지를 표시합니다. 시험 상태는 **1000 / 3000커밋**입니다.

<table><tr><th>은행나무</th><th>양치식물</th></tr><tr><td><img src="https://raw.githubusercontent.com/ottuck/botanical-readme-poc/main/images/01-sketch-bloom.svg?v=f097a053f5a7" width="360" alt="프로필 삽입 검증 은행나무 1000" /></td><td><img src="https://raw.githubusercontent.com/ottuck/botanical-readme-poc/main/images/02-watercolor-fern.svg?v=5985bf5eaae5" width="360" alt="프로필 삽입 검증 양치식물 1000" /></td></tr></table>

복사할 은행나무 코드:

```markdown
<img src="https://raw.githubusercontent.com/ottuck/botanical-readme-poc/main/images/01-sketch-bloom.svg?v=f097a053f5a7" width="360" alt="Botanical garden" />
```

복사할 양치식물 코드:

```markdown
<img src="https://raw.githubusercontent.com/ottuck/botanical-readme-poc/main/images/02-watercolor-fern.svg?v=5985bf5eaae5" width="360" alt="Botanical garden" />
```

채색은 GitHub Actions가 이미지를 교체할 때 갱신됩니다. 이 문서의 버전 값은 그림 해시로 자동 갱신됩니다. 실제 프로필에 적용할 때도 프로필 README의 버전 값을 함께 갱신하면 이전 이미지 캐시를 피할 수 있습니다. 현재 열린 README가 커밋 발생을 실시간으로 감지하는 방식은 아닙니다.
