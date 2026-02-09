# URL 기반 영상 자르기 기능 구현

## 구현 완료: 2026-02-08

## 아키텍처

```
[사용자] URL 붙여넣기
  → POST /api/video/resolve  (yt-dlp -J로 메타데이터 + 스트림 URL 추출)
  → 스토어에 videoFile 저장 (source: 'url')
  → video.js 플레이어가 /api/video/proxy?url=<streamUrl> 로 재생
  → 기존 타임라인 에디터로 구간 설정
  → POST /api/video/trim  (서버 ffmpeg로 구간 자르기, 스트림 응답)
  → 브라우저에서 다운로드
```

## 변경 파일 목록

### 수정된 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/types/store.ts` | VideoFile 인터페이스 확장 (file: nullable, source, streamUrl, thumbnail, originalUrl) |
| `src/stores/useStore.ts` | `setVideoFromUrl` 액션 추가, reset에서 URL 소스 Object URL revoke 스킵 |
| `src/stores/selectors.ts` | `useVideoSource()`, `useStreamUrl()` 셀렉터 추가 |
| `src/features/upload/components/UploadZone.tsx` | UrlInputZone 컴포넌트 통합 |
| `src/features/upload/hooks/useFileUpload.ts` | VideoFile에 `source: 'file'` 추가 |
| `src/features/player/components/VideoPlayerView.tsx` | 동적 MIME type 결정 |
| `src/features/export/components/ExportButton.tsx` | URL 소스 분기 처리, source/streamUrl 전달 |
| `src/features/export/components/ExportProgress.tsx` | URL 소스 시 서버 FFmpeg 표시 |
| `src/features/export/utils/trimVideoDispatcher.ts` | URL 소스 시 서버 트림 분기 |
| `next.config.ts` | API routes COEP 예외, credentialless 정책 |
| `src/__tests__/unit/useStore.test.ts` | 모든 mock에 `source: 'file'` 추가 |

### 새로 생성된 파일
| 파일 | 설명 |
|------|------|
| `src/app/api/video/resolve/route.ts` | yt-dlp URL 해석 API |
| `src/app/api/video/proxy/route.ts` | 비디오 프록시 API (Range 지원) |
| `src/app/api/video/trim/route.ts` | 서버 ffmpeg 구간 자르기 API |
| `src/features/url-input/components/UrlInputZone.tsx` | URL 입력 UI 컴포넌트 |
| `src/features/url-input/hooks/useUrlInput.ts` | URL 입력 로직 훅 |
| `src/features/export/utils/trimVideoServer.ts` | 서버 트림 클라이언트 유틸 |

## 시스템 요구사항 (로컬 개발)
- `yt-dlp` CLI: `brew install yt-dlp`
- `ffmpeg` CLI: `brew install ffmpeg`

## 검증 상태
- [x] TypeScript 타입 체크 통과
- [x] 92개 단위 테스트 통과
- [x] 프로덕션 빌드 성공
- [ ] YouTube URL 수동 테스트
- [ ] Chzzk VOD URL 수동 테스트
- [ ] 기존 파일 업로드 회귀 테스트

## 주요 설계 결정

### COEP 정책 변경
- 기존: `require-corp` (모든 경로)
- 변경: `credentialless` (비-API 경로), API 경로는 COEP 없음
- 이유: 프록시 응답이 cross-origin 리소스를 포함하므로 `require-corp`는 차단됨
- `credentialless`는 FFmpeg.wasm의 SharedArrayBuffer를 여전히 지원

### 프록시 설계
- Range 요청 지원으로 video.js 시킹 가능
- 원본 서버의 Content-Type/Content-Length/Content-Range/Accept-Ranges 전달
- 클라이언트에서는 same-origin `/api/video/proxy` URL로 접근하여 CORS 문제 없음
