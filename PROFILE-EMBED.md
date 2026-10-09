# 프로필 README 삽입 검증

다른 저장소의 README에 넣을 때 사용하는 **절대 URL**로 같은 이미지를 표시합니다. 아래 그림은 현재 생성된 시험 상태를 보여줍니다.

<img src="https://raw.githubusercontent.com/ottuck/botanical-readme-poc/main/images/01-sketch-bloom.svg" width="360" alt="프로필 삽입 검증 은행나무" />
<img src="https://raw.githubusercontent.com/ottuck/botanical-readme-poc/main/images/02-watercolor-fern.svg" width="360" alt="프로필 삽입 검증 양치식물" />

복사할 코드:

```markdown
<img src="https://raw.githubusercontent.com/ottuck/botanical-readme-poc/main/images/01-sketch-bloom.svg" width="360" alt="Botanical garden" />
```

```markdown
<img src="https://raw.githubusercontent.com/ottuck/botanical-readme-poc/main/images/02-watercolor-fern.svg" width="360" alt="Botanical garden" />
```

채색은 GitHub Actions가 이미지를 교체할 때 갱신됩니다. README를 새로 열거나 새로고침하면 변경된 그림을 불러옵니다. 현재 열린 README가 커밋 발생을 실시간으로 감지하는 방식은 아닙니다.
