# Video Trimmer 리팩토링 전략

**작성일**: 2026-01-29
**목표**: 코드 볼륨 300-400줄 감소 (약 7%), 가독성 및 유지보수성 향상
**접근법**: 6단계 점진적 리팩토링 (안전성 우선)

---

## 요약

전체 코드베이스 스캔을 통해 확인된 주요 개선 기회:

### 발견된 문제점
1. **중복 코드**: InPointHandle/OutPointHandle 85% 동일 (130줄 중 110줄)
2. **복잡한 컴포넌트**: TimelineEditor 182줄, 8개 이상의 책임
3. **반복된 패턴**: 스토어 셀렉터 20회 이상 반복, 시간 변환 로직 5회 반복
4. **유틸리티 중복**: formatBytes 정확히 중복, FFmpeg 로딩 로직 2곳
5. **상태 관리 문제**: MP4Box 경쟁 조건, FFmpeg 전역 상태, 복잡한 Playhead 동기화
6. **미사용 코드**: useFFmpeg 훅 72줄 완전 미사용

### 기대 효과
- **코드 볼륨**: 350줄 감소 (5,039줄 → 4,700줄)
- **번들 크기**: 7.5KB 감소 (압축 기준)
- **성능**: Playhead 리렌더 50% 감소, 줌 응답성 향상
- **유지보수성**: 컴포넌트 단일 책임 원칙 적용, 테스트 용이성 향상

---

## 6단계 리팩토링 계획

### Phase 1: 유틸리티 통합 (LOW RISK, 우선순위 최상)
**예상 시간**: 1-2시간 | **감소 예상**: 80-100줄

#### 작업 내용
1. **formatBytes 중복 제거** ✅ 안전
   - `src/utils/memoryMonitor.ts`의 formatBytes 제거
   - `src/utils/formatBytes.ts`에서 import
   - **절감**: 11줄

2. **시간 포맷팅 통합**
   - `src/features/timeline/utils/timeFormatter.ts` 확장
   - `src/utils/ffmpegLogParser.ts`의 formatDuration 통합
   - options 파라미터로 밀리초 표시 제어
   - **절감**: 15-20줄

3. **스토어 셀렉터 훅 생성** ⚠️ 성능 개선
   - 새 파일: `src/stores/selectors.ts`
   - `useTimelineState`, `useTimelineActions`, `usePlayerState` 등
   - Zustand의 `useShallow` 사용하여 불필요한 리렌더 방지
   - **절감**: 40-50줄 (컴포넌트 전반)

#### 검증 방법
```bash
npm test                # 모든 테스트 통과 확인
npm run type-check      # 타입 에러 없음 확인
```

**수동 테스트**: 시간 표시 정확성, 메모리 모니터링 정상 작동

---

### Phase 2: 컴포넌트 통합 (MEDIUM RISK, 우선순위 높음)
**예상 시간**: 2-3시간 | **감소 예상**: 60-70줄

#### 작업 내용
1. **TrimHandle 컴포넌트 생성**
   - 새 파일: `src/features/timeline/components/TrimHandle.tsx`
   - InPointHandle과 OutPointHandle을 type prop으로 통합
   - 85% 중복 코드 제거

2. **기존 컴포넌트 교체**
   ```tsx
   // 기존
   <InPointHandle />
   <OutPointHandle />

   // 변경 후
   <TrimHandle type="in" />
   <TrimHandle type="out" />
   ```

3. **삭제 예정 파일**
   - `src/features/timeline/components/InPointHandle.tsx`
   - `src/features/timeline/components/OutPointHandle.tsx`

#### 검증 방법
- 인포인트/아웃포인트 드래그 동작 확인
- 잠금 기능 정상 작동
- 키보드 단축키 동작
- 시간 입력과 동기화

**롤백 전략**: 임시로 두 구현 모두 유지, TimelineEditor 임포트만 변경

---

### Phase 3: TimelineEditor 분해 (MEDIUM RISK, 우선순위 중간)
**예상 시간**: 3-4시간 | **감소 예상**: 40-60줄

#### 작업 내용
1. **프리뷰 로직 추출**
   - 새 파일: `src/features/timeline/hooks/usePreviewPlayback.ts`
   - handlePreview, handlePreviewEdges 로직 이동
   - 컴포넌트: `src/features/timeline/components/PreviewButtons.tsx`

2. **줌 로직 추출**
   - 새 파일: `src/features/timeline/hooks/useTimelineZoom.ts`
   - Ctrl+휠 이벤트 처리 분리

3. **컨트롤 분리**
   - 새 파일: `src/features/timeline/components/TimelineControls.tsx`
   - TimeInput, LockButton, PreviewButtons 조합

4. **TimelineEditor 단순화**
   - 182줄 → 50줄로 축소
   - 오케스트레이션만 담당

#### 검증 방법
- Preview Full/Edges 버튼 동작
- Ctrl+휠 줌 기능
- 모든 컨트롤 응답성
- 핸들 이동 정상 작동

**롤백 전략**: `TimelineEditor.backup.tsx` 유지, 점진적 마이그레이션

---

### Phase 4: 상태 관리 개선 (MEDIUM RISK, 우선순위 중간)
**예상 시간**: 3-4시간 | **감소 예상**: 30-40줄

#### 작업 내용
1. **MP4Box 경쟁 조건 수정** 🔴 중요
   - `src/features/export/utils/trimVideoMP4Box.ts` 개선
   - 100ms 타이머로 완료 감지 (기존 10초 타임아웃 대체)
   - onFlush 이벤트 활용

2. **페이즈 전환 분리**
   - `setError`, `setExportResult`에서 페이즈 자동 변경 제거
   - 새 액션: `setErrorAndTransition`, `setExportResultAndComplete`
   - 더 명확한 상태 흐름

3. **검증 상태 추가**
   - 새 페이즈: 'ready' (편집 → 내보내기 전 검증)
   - validateExport() 액션으로 범위 검증
   - 더 나은 에러 메시지

4. **FFmpeg 정리 로직**
   - `cleanupFFmpeg()` 함수 추가
   - 스토어 리셋 시 자동 호출
   - 메모리 누수 방지

#### 검증 방법
```typescript
// 스토어 테스트
describe('Phase Transitions', () => {
  test('setError does not auto-transition phase')
  test('validateExport catches invalid ranges')
})
```

**수동 테스트**: 다양한 포맷 내보내기, 메모리 정리 확인

---

### Phase 5: 미사용 코드 제거 (LOW RISK, 우선순위 낮음)
**예상 시간**: 1시간 | **감소 예상**: 40-50줄

#### 작업 내용
1. **useFFmpeg 훅 삭제**
   - `src/hooks/useFFmpeg.ts` 완전 미사용 (72줄)
   - trimVideoDispatcher의 싱글톤 패턴으로 대체됨

2. **에러 핸들러 맵 통합**
   - `src/utils/errorHandler.ts`의 중복 에러 맵 통합
   - 단일 ERROR_MAP으로 통합
   - **절감**: 30줄

3. **주석 처리된 코드 제거**
   - 10-15줄 예상

#### 검증 방법
```bash
# useFFmpeg 사용처 없는지 확인
grep -r "useFFmpeg" src/ --exclude="useFFmpeg.ts"

npm run build           # 빌드 성공 확인
npm test                # 모든 테스트 통과
```

---

### Phase 6: 성능 최적화 (LOW RISK, 품질 향상)
**예상 시간**: 2-3시간 | **감소 예상**: 20-30줄

#### 작업 내용
1. **Playhead 메모이제이션**
   - React.memo로 컴포넌트 래핑
   - position 계산 useMemo 적용
   - **효과**: 재생 중 리렌더 50% 감소

2. **Waveform 줌 디바운스**
   - 100ms 디바운스로 waveform 업데이트 지연
   - Ctrl+휠 스크롤 시 CPU 사용량 감소
   - 더 부드러운 줌 경험

3. **Export 컴포넌트 지연 로딩**
   - React.lazy로 DownloadButton, ExportProgress 지연 로딩
   - 초기 번들 크기 감소
   - 코드 스플리팅 개선

#### 검증 방법
- DevTools Performance 탭에서 리렌더 횟수 측정
- 번들 크기 Before/After 비교
- 줌 응답성 체감 테스트

---

## 중요 파일 목록

### 수정 필요 (우선순위 순)
1. **src/stores/useStore.ts** - Phase 1, 4에서 수정
2. **src/features/timeline/components/TimelineEditor.tsx** - Phase 2, 3에서 대폭 수정
3. **src/features/timeline/components/InPointHandle.tsx** - Phase 2에서 삭제
4. **src/features/timeline/components/OutPointHandle.tsx** - Phase 2에서 삭제
5. **src/features/export/utils/trimVideoMP4Box.ts** - Phase 4 경쟁 조건 수정
6. **src/utils/memoryMonitor.ts** - Phase 1 중복 제거
7. **src/features/export/utils/trimVideoDispatcher.ts** - Phase 4 정리 로직
8. **src/utils/errorHandler.ts** - Phase 5 통합
9. **src/hooks/useFFmpeg.ts** - Phase 5에서 삭제

### 생성 필요
1. **src/stores/selectors.ts** - Phase 1
2. **src/features/timeline/components/TrimHandle.tsx** - Phase 2
3. **src/features/timeline/hooks/usePreviewPlayback.ts** - Phase 3
4. **src/features/timeline/hooks/useTimelineZoom.ts** - Phase 3
5. **src/features/timeline/components/TimelineControls.tsx** - Phase 3
6. **src/features/timeline/components/PreviewButtons.tsx** - Phase 3

---

## 안전한 리팩토링 절차

### 각 Phase 시작 전
1. ✅ 새 브랜치 생성: `refactor/phase-N-description`
2. ✅ 현재 상태 문서화 (스크린샷, 메트릭)
3. ✅ `npm test` 모든 테스트 통과 확인
4. ✅ 현재 라인 수 기록

### Phase 실행 중
1. ✅ 작은 단위로 커밋 (각 서브 단계마다)
2. ✅ 기존 코드 주석 처리 (즉시 삭제 X)
3. ✅ 각 변경 후 테스트 실행
4. ✅ 수동 검증 체크리스트 확인

### Phase 완료 후
1. ✅ 전체 테스트 스위트 통과 (`npm test`)
2. ✅ 타입 체크 통과 (`npm run type-check`)
3. ✅ E2E 주요 경로 수동 테스트
4. ✅ 라인 수 감소 문서화
5. ✅ PR 생성 및 코드 리뷰
6. ✅ 승인 후 main에 머지

### 롤백 전략
- **Phase 1-2**: 간단한 git revert
- **Phase 3**: TimelineEditor.backup.tsx로 복원
- **Phase 4**: 새 메서드 추가 방식이므로 기존 호출 유지 가능
- **Phase 5-6**: git history에서 복원

---

## 검증 체크리스트

### 전체 Phase 공통 (매번 확인)

#### 1. 업로드 플로우
- [ ] 파일 드래그 앤 드롭 동작
- [ ] 파일 검증 정상 작동
- [ ] 진행률 표시 정확

#### 2. 타임라인 인터랙션
- [ ] 인포인트 핸들 드래그
- [ ] 아웃포인트 핸들 드래그
- [ ] 플레이헤드 드래그
- [ ] 핸들 잠금/해제
- [ ] 키보드 단축키 (Space, I, O, [, ])
- [ ] Ctrl+휠 줌

#### 3. 재생
- [ ] 재생/일시정지
- [ ] 시크 동작
- [ ] Preview Full 동작
- [ ] Preview Edges 동작 (<10초, >10초 세그먼트)

#### 4. 내보내기
- [ ] MP4 내보내기 (MP4Box)
- [ ] WebM 내보내기 (FFmpeg)
- [ ] 다운로드 동작
- [ ] 리셋 동작

#### 5. 에러 처리
- [ ] 잘못된 파일 에러 표시
- [ ] 큰 파일 경고 표시
- [ ] 내보내기 에러 표시

---

## 위험도 평가

| Phase | 위험도 | 영향 범위 | 완화 전략 |
|-------|--------|----------|-----------|
| Phase 1 | 🟢 낮음 | 유틸리티 함수 | 단위 테스트, git revert |
| Phase 2 | 🟡 중간 | 타임라인 핸들 | 임시 양쪽 유지, 점진적 교체 |
| Phase 3 | 🟡 중간 | TimelineEditor | 백업 파일, 단계별 추출 |
| Phase 4 | 🟠 중상 | 상태 관리 전반 | 새 메서드 추가 방식, 기존 유지 |
| Phase 5 | 🟢 낮음 | 미사용 코드 | import 확인, git history |
| Phase 6 | 🟢 낮음 | 성능 최적화 | 추가형 변경, 제거 용이 |

---

## 예상 타임라인

**총 예상 시간**: 12-16시간

### 권장 일정 (4주)
- **1주차**: Phase 1-2 (유틸리티 + 컴포넌트 통합)
- **2주차**: Phase 3 (TimelineEditor 분해)
- **3주차**: Phase 4 (상태 관리 개선)
- **4주차**: Phase 5-6 (정리 + 최적화) + 최종 검증

---

## 성공 지표

### 코드 품질
- ✅ 라인 수 300-400줄 감소 (7% 감소)
- ✅ 순환 복잡도 증가 없음
- ✅ 컴포넌트 책임 점수 향상
- ✅ 테스트 커버리지 90% 이상 유지

### 성능
- ✅ 초기 번들 5-8% 감소
- ✅ Playhead 리렌더 50% 이상 감소
- ✅ 줌 작업 응답성 향상
- ✅ 성능 회귀 없음

### 유지보수성
- ✅ 컴포넌트 라인 수 <100줄 (복잡한 것 제외)
- ✅ 단일 책임 원칙 준수
- ✅ 관심사 명확한 분리
- ✅ 문서 업데이트 완료

---

## 리팩토링 후 작업

### 문서 업데이트
1. CLAUDE.md에 새 패턴 반영
2. 컴포넌트 문서 업데이트
3. 아키텍처 결정 기록(ADR) 작성
4. README 업데이트

### 배포
1. main 브랜치 머지
2. 스테이징 배포
3. 스테이징 스모크 테스트
4. 프로덕션 배포
5. 모니터링

### 후속 작업
1. 성능 메트릭 추적
2. 팀 피드백 수집
3. 교훈 문서화
4. 다음 개선 계획

---

## 핵심 원칙

이 리팩토링 계획의 핵심 원칙:

1. **안전성 우선**: 각 단계는 독립적으로 테스트 가능하고 되돌릴 수 있음
2. **점진적 접근**: 한 번에 모든 것을 바꾸지 않고 단계별 진행
3. **낮은 위험부터**: 유틸리티 통합 → 컴포넌트 → 상태 관리 순서
4. **하위 호환성**: 전환 중에도 기존 기능 유지
5. **철저한 검증**: 각 단계마다 자동 + 수동 테스트

**목표는 단순히 라인 수를 줄이는 것이 아니라, 유지보수성, 테스트 용이성, 성능을 향상시키면서 코드베이스를 안정적으로 유지하는 것입니다.**
