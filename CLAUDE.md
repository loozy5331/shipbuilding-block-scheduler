# 조선소 블록 일정 스케줄러 — 작업 안내

React 19 + TypeScript + Vite, 상태는 zustand(localStorage 저장), 계산은 브라우저(Web Worker). 서버는 Python FastAPI(`backend/`, 로그인 API + SQLite)뿐.
사용자 문서·배치 규칙·최적화 설명은 README.md. 여기에는 코드를 고칠 때 필요한 것만 둔다.

## 명령
- `npx tsc --noEmit` 타입 검사(테스트 포함, 안 쓰는 import도 오류)
- `npx vitest run` 단위 테스트 (`tests/*.test.ts`)
- `npx playwright test --reporter=dot` e2e (`tests/e2e/*.spec.ts`, headless, 기본 reducedMotion=reduce라 조립 애니메이션은 건너뜀)
- `npm run test:py` 백엔드 pytest (`backend/tests/`), 설치는 `npm run setup:py`
- `npm run build` 빌드

## 코드 지도 (찾는 것 → 파일)
| 무엇 | 어디 |
|---|---|
| 타입·기본 자원 | `src/domain/types.ts` |
| 배치 평가(지연·초과·KPI·목적함수) | `src/domain/evaluate.ts` |
| 작업 자리(레인)·착수 순서·같은 배치 비교 | `src/domain/lanes.ts` |
| 배정 가능 여부·힌트·TBM·평가서·라벨 | `src/domain/{assign,hint,tbm,report,labels}.ts` |
| 최적화(직렬 SGS + 로컬 서치), 용량 검사, what-if | `src/solver/{sgs,search,feasibility,whatif}.ts`, 진입 `index.ts`, 워커 호출 `client.ts` |
| 상태: 화면·로그인 / 블록·배치 / 튜토리얼 / UI | `src/store/slices/{session,plan,tutorial,ui}.ts` (저장 항목·마이그레이션은 `schedulerStore.ts`) |
| 현재 배치 평가(메모이즈) | `src/store/evaluation.ts` → `useEvaluation()` |
| 최적화 실행·결과 저장 | `src/store/actions.ts` `runSolve()` |
| 엑셀/Numbers/CSV 읽기·쓰기, 붙여넣기 파싱 | `src/io/{excel,parse}.ts` |
| 로그인 API | 호출 `src/io/auth.ts` ↔ FastAPI `backend/app/main.py`(라우트), `backend/app/users.py`(SQLite·scrypt). 개발 시 `vite.config.ts`가 uvicorn을 띄우고 /api 프록시 |
| 페이지 | `components/home/{LoginPage,MenuPage}` → `input/InputPage` → `board/BoardPage` → `result/ResultPage` (`App.tsx`가 전환) |
| 간트 | `board/GanttChart.tsx`(줄·작업장), `board/GanttBars.tsx`(막대·아이콘), 드래그 `board/useBoardDnd.ts`, 칸 폭 `board/ganttLayout.ts` |
| 튜토리얼 가이드 | 단계 `src/tutorial/steps.ts`, 화면 `Tour.tsx`, 예시 데이터 `scenario.ts` |
| 조립 애니메이션 | 장면 데이터 `components/assembly/scene.ts`, 화면 `AssemblyShow.tsx` |
| 스타일 | `src/styles/parts/NN-*.css` — **번호 순서가 우선순위**(app.css가 순서대로 @import). 새 스타일은 해당 구역 파일에 |
| 계획 문서 | `docs/ocr-plan.md` |

## 규칙
- UI 문구·주석·커밋 메시지는 한국어. 주석은 "왜"만 짧게, 주변 코드 밀도에 맞춘다.
- 작업은 단계마다 커밋(기능 브랜치, 통합 브랜치는 `develop`). 커밋 전 tsc·vitest·playwright 통과.
- 버전: 유의적 버전. 기능 브랜치를 합칠 때 `CHANGELOG.md`의 `[Unreleased]`에 한 줄 추가. 릴리스는 `develop`에서 `release/X.Y.Z` → `package.json` 버전·CHANGELOG 갱신 → `main`에 `--no-ff` 머지 → `vX.Y.Z` 태그(annotated) → `develop`에 되머지.
- 배치를 바꾸는 상태 변경은 `plan.ts`의 `withLanes`로 작업 자리를 채운다.
- 평가가 필요하면 `evaluate()`를 새로 부르지 말고 `useEvaluation()`/`selectEvaluation()`.
- 큰 파일 통째 읽기 피하기: 위 지도로 파일을 고르고 `grep -n`으로 위치를 찾은 뒤 필요한 범위만 읽는다.
- Python은 프로젝트 `.venv`(Python 3.12, uv)에서만 실행한다. 의존성은 `backend/requirements*.txt`에 버전 고정.
