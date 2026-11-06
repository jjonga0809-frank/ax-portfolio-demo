# AX Portfolio — STEP 8 배포용 정적 웹서비스

## 실행
이 폴더에서 `python -m http.server 8000`을 실행한 후 http://localhost:8000 에 접속합니다.

## 기능
GitHub 공개 프로필·저장소 분석, 교육용 가상 공고 8개, 사용자 공고 입력·편집, 가중 최대 커버리지 조합 탐색, 규칙 기반 포트폴리오 초안 생성, 로컬 저장·Markdown 다운로드.

## 제한 사항
- 계정 로그인/OAuth 없음. GitHub 공개 REST API만 조회하며 호출 제한이 적용됩니다.
- 실제 채용공고 연동 없음. 예시 8개는 가상 데이터입니다.
- 생성형 AI API 연동 없음. 포트폴리오는 규칙 기반 템플릿입니다.
- 기술 단서 매칭은 개인 기여·역량·합격 확률을 증명하지 않습니다.
- 포폴기록은 각 브라우저의 localStorage에 저장됩니다. 배포 주소가 바뀌면 기존 localhost 기록이 자동 이전되지 않습니다.
- GitHub 기술 단서의 오탐/누락이 가능하며 최근 5개 저장소만 상세 분석합니다.

## 배포
`site` 폴더 안 파일을 GitHub 저장소 최상위에 올리고 Vercel에서 해당 저장소를 Import합니다. Framework Preset = Other, Root Directory = ./, Build Command 비움, Output Directory 비움(기본값). GitHub/Vercel 인증은 사용자가 직접 합니다.
