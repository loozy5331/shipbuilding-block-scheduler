# 변경 이력

버전은 [유의적 버전](https://semver.org/lang/ko/)(MAJOR.MINOR.PATCH)을 따르고, 릴리스마다 `main`에 `vX.Y.Z` 태그를 붙인다.

- MAJOR: 저장 데이터·엑셀 양식·API가 호환되지 않게 바뀔 때
- MINOR: 기능 추가
- PATCH: 버그 수정·문구·스타일

## [Unreleased]

### 기능
- 결과로 넘어갈 때 three.js 조립 애니메이션(이중선체 측면 블록, 용접 비드)
- 숙련자는 블록 스케줄링에 들어오면 최적 배치로 시작
- 간트 줄이 재정렬될 때 새 자리로 미끄러지는 애니메이션
- 튜토리얼 중에는 상단 단계 탭으로 건너뛰지 않음

### 내부
- 폴더 정리: 프론트엔드를 `frontend/`로, 회원 DB 기본 위치를 `backend/data/`로. npm 스크립트 `typecheck`·`samples` 추가

## [1.0.0] - 2026-10-20

첫 릴리스.

### 기능
- 블록 일정 배치: 엑셀/Numbers/CSV 업로드와 붙여넣기, 엑셀 양식 도움말, 빈 셀은 공통 설정 입력에서 채움
- 진입 화면: 로그인·회원가입(FastAPI + SQLite), 숙련자/신입 모드, 田자 메뉴(엑셀 업로드·튜토리얼·설정·블록 작업 촬영 자리)
- 배치 화면: 블록 한 줄 간트, 작업장별 굵은 테두리, 작업장 간 드래그 이동, 작업자 수만큼 막대 나눔, 가용 자원으로 처리 가능 여부 즉시 표시
- 숙련자는 최적 배치(직렬 SGS + 로컬 서치, Web Worker), 신입은 최적 배치와 비교한 힌트
- 차선책: 최소 요건(자재·크레인·작업자, 자원 초과 없음)을 만족하는 안만 제시
- 결과 화면: 블록 조립 애니메이션, 오늘 작업·TBM 공유 메시지, 최적 배치와 비교한 평가서, 엑셀 저장
- 튜토리얼: 실제 사용과 같은 페이지 순서, 계정마다 처음 한 번만 가이드
- 모바일 화면 대응

### 내부
- 리팩토링 R1~R7: 스토어 slice 분리, `useEvaluation` 단일 평가, 컴포넌트·CSS·e2e 분리, 백엔드를 Python FastAPI로 전환
- 블록 작업 촬영(OCR) 계획 문서 `docs/ocr-plan.md`

[Unreleased]: https://github.com/loozy5331/shipbuilding-block-scheduler/compare/v1.0.0...develop
[1.0.0]: https://github.com/loozy5331/shipbuilding-block-scheduler/releases/tag/v1.0.0
