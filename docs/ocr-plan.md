# 블록 작업 촬영(OCR) 계획 — PaddleOCR

메뉴의 `블록 작업 촬영`(현재 "준비 중")을 구현한다. 작업지시서·인쇄 표·화이트보드·모니터 화면을 찍거나 사진을 올리면
블록 표(`블록 ID`, `납기일`, `필요 작업 시간`, `자재준비 여부`)로 바꿔 **공통 설정 입력**의 블록 목록으로 넘긴다.
OCR 결과는 틀릴 수 있으므로 **사람이 검토·수정한 뒤 적용**하는 흐름을 원칙으로 한다.

## 1. 왜 PaddleOCR인가

| 항목 | 내용 |
|---|---|
| 라이선스 | Apache 2.0. 사내 배포·수정이 자유롭다 |
| 한국어 | 한국어 인식 모델 `korean_PP-OCRv5_mobile_rec` 제공 |
| 표 인식 | PP-StructureV3가 표 구조(셀 좌표)를 Markdown/JSON으로 돌려준다 |
| 사진 대응 | 문서 방향 분류·왜곡 보정(`use_doc_orientation_classify`, `use_doc_unwarping`) 내장 |
| 실행 환경 | CPU만으로도 동작(GPU면 훨씬 빠름), 자체 서버에서 실행 → **도면·일정 사진이 외부로 나가지 않는다** |
| 서빙 | 공식 서빙(HTTP `POST /ocr`, Docker 이미지) 제공, ONNX 변환도 지원 |

## 2. 구조

```
[브라우저]  촬영/업로드 → 회전·축소(긴 변 2000px, JPEG) ─┐
                                                        │ POST /api/ocr (multipart, ≤10MB)
[FastAPI]  backend/app/ocr.py: 크기·형식 검사, 동시 처리 제한 ┘  (로그인 API와 같은 서버, 같은 .venv)
   1) 표 인식(PP-StructureV3) → 셀 2차원 배열
   2) 표가 없으면 텍스트 박스(PaddleOCR) → 행·열로 묶기
   → { rows: string[][], cells: { text, score, box }[][] }
[브라우저]  기존 parseTable()로 헤더·값 해석 → 검토 표 → 블록으로 적용
```

- 백엔드가 이미 FastAPI(`backend/`)이므로 **OCR도 같은 서버의 라우트**로 붙인다. 별도 프록시가 필요 없다.
- PaddleOCR는 무거우므로 첫 요청 때 모델을 불러오고(lazy), `paddleocr`는 `backend/requirements-ocr.txt`로 분리해
  OCR이 필요 없는 환경은 가볍게 설치한다. 설치되지 않았으면 `/api/ocr`이 503과 안내 문구를 돌려준다.
- 표 해석은 엑셀 업로드와 같은 `frontend/src/io/parse.ts`의 `parseTable()`을 재사용한다. 헤더 별칭·날짜 환산·자재 표기 인식이 한 곳에 모인다.

## 3. 처리 단계

1. **전처리(브라우저)**: EXIF 회전 반영, 긴 변 2000px로 축소, JPEG 0.85. 모바일은 `<input type="file" accept="image/*" capture="environment">`.
2. **표 인식(서버)**: PP-StructureV3로 표 영역과 셀을 얻는다. 인식 언어는 기본(중·영)이 아니라 **한국어 모델로 지정**한다.
3. **표가 없을 때**: PaddleOCR의 `rec_boxes`/`rec_texts`를 y좌표로 행 묶음 → x좌표로 열 정렬해 표를 만든다(화이트보드·메모).
4. **헤더 없음 대응**: 열 값 패턴으로 열을 추정 — 블록 ID(`[A-Z]+\d*-\d+`), 날짜/숫자(납기), 숫자(MH), 준비/미준비·O/X(자재).
5. **보정**: 열 성격에 맞춰 흔한 오인식 교정(ID·숫자 열의 `O↔0`, `I/l↔1`, `S↔5`, `B↔8`), 자재 값은 사전 매칭.
6. **검토 화면**: 원본 사진과 표를 나란히. 신뢰도(`rec_scores`)가 낮은 셀(예: < 0.8)과 파싱 오류 행을 노랗게 표시하고, 셀을 눌러 고친 뒤 `블록으로 적용`.

## 4. 단계별 진행 (단계마다 커밋)

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| M0 PoC | 실제 사진 20장 이상 수집(인쇄 표·손글씨·화이트보드·모니터 촬영), Python 스크립트로 셀 정확도 측정 | 인쇄 표 셀 정확도 95% 이상이면 진행. 손글씨는 결과 보고 범위 결정 |
| M1 OCR 라우트 | `backend/app/ocr.py` (PaddleOCR 3.x, `.venv`, `requirements-ocr.txt`), `POST /api/ocr` | 샘플 이미지로 rows/cells JSON 반환, pytest |
| M2 운영 | 크기·형식 검사, 동시 처리 제한, 미설치·시간 초과 시 명확한 오류, Dockerfile(모델 포함) | 오류 경로 pytest |
| M3 표 변환 | 행·열 묶기, 헤더 추정, 오인식 보정 → `parseTable()` 연결 | 고정 OCR JSON 픽스처로 단위 테스트 |
| M4 화면 | 메뉴 타일 활성화, 촬영/업로드, 진행 표시, 검토 표, 적용 | 모바일 폭에서 가로 스크롤 없음 |
| M5 테스트·문서 | OCR 응답을 모킹한 e2e, README 실행 방법 | 기존 테스트 포함 전부 통과 |

## 5. 배포

- 백엔드 Docker 이미지에 OCR 모델을 빌드 때 받아 넣어 첫 요청 지연을 없앤다.
- 권장 사양(가정, M0에서 측정 후 확정): CPU 4코어·메모리 8GB, 사진 1장 수 초. GPU가 있으면 `device="gpu"`.
- PP-StructureV3 전체 파이프라인은 무겁다 → 수식·도표 인식 등 쓰지 않는 기능은 끄고 모바일(경량) 모델을 우선 쓴다.

## 6. 위험과 대응

| 위험 | 대응 |
|---|---|
| 손글씨 인식률이 낮음(PaddleOCR은 인쇄체에 강함) | M0 결과에 따라 손글씨는 범위에서 빼거나 PaddleOCR-VL 검토. 검토 화면으로 사람 수정 전제 |
| 사진 각도·조명·반사 | 방향 분류·왜곡 보정 사용, 촬영 가이드(표가 화면을 채우도록) 표시 |
| 표 구조 인식 실패(선 없는 표) | 텍스트 박스 기반 행·열 묶기로 대체(3단계) |
| 서버 자원 | 동시 요청 제한(큐), 이미지 크기 제한 |

## 7. 검토한 대안

- **브라우저 안에서 실행(PaddleOCR.js / ONNX Runtime Web)**: 서버가 필요 없지만 모델 다운로드가 크고 표 구조 인식이 없다 → 서버 방식이 자리 잡은 뒤 오프라인 용도로 재검토.
- **클라우드 OCR(Naver CLOVA, Google Vision 등)**: 정확도는 높지만 사진이 외부로 나가고 호출 비용이 든다 → 조선소 보안 정책상 제외.

## 8. 정해야 할 것

1. 실제로 찍을 대상: 인쇄된 작업지시서 양식이 있는지, 손글씨·화이트보드가 많은지 (→ M0 샘플 수집)
2. OCR 서버를 둘 곳과 GPU 유무
3. 사진을 서버에 보관할지(기본: 처리 후 즉시 삭제)

참고: [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), [OCR 파이프라인 문서](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/OCR.html), [PP-StructureV3 문서](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PP-StructureV3.html)
