# Bug Fix Report: Playhead Snap-Back Issue

**문서 번호**: 001
**버그 현상**: Playhead Snap-Back
**수정 커밋**: 23fa7f9
**작성일**: 2026-01-21

---

## 1. 증상은 무엇이었는가?

**Playhead 드래그 후 snap-back 현상**
- 사용자가 timeline의 Playhead를 드래그하여 새 위치로 이동
- 드래그를 놓는 순간, Playhead가 **이전 위치로 순간 이동 (snap-back)**
- 이후 다시 올바른 위치로 돌아옴 (깜박임)
- 발생 빈도: 높음 (일관되게 재현 가능)

---

## 2. 초기 진단은 무엇이었는가?

**초기 가설들 (시간 순서대로):**

### 1차 진단: 비동기 타이밍 문제
- **가설**: video.js의 seek가 비동기 → timeupdate 발생 타이밍 예측 불가
- **추정 원인**: `isScrubbing` 플래그가 너무 일찍 해제되어 stale timeupdate가 store 오염
- **해결 시도**: RAF, setTimeout 등 타이밍 기반 지연

### 2차 진단: Store 동기화 문제
- **가설**: `draggingTime=null` 후 즉시 store 참조 → store가 이미 오염됨
- **해결 시도**: `draggingTime` 유지 기간 연장

### 3차 진단: pendingSeekTarget 추적
- **가설**: Stale timeupdate를 필터링하기 위해 목표 시간 추적 필요
- **해결 시도**: `pendingSeekTargetRef` 추가하여 diff 계산

### 4차 진단: 좌표 변환 오차
- **가설**: 시간 ↔ 좌표 왕복 변환으로 부동소수점 오차 누적
- **해결 시도**: 좌표 기반 (percentage) 아키텍처로 전환

---

## 3. 진짜 원인은 무엇이었는가?

**3개의 근본 원인이 복합적으로 작용:**

### 원인 A: Multiple Pending Seeks (Race Condition)

```tsx
// 드래그 중 throttled seek
t=0ms:   seek(5초)
t=50ms:  seek(7초)
t=100ms: 드래그 종료 → seek(8초)

// Video는 순차적으로 처리
t=120ms: seek(5초) 완료 → timeupdate(5초)
t=140ms: seek(7초) 완료 → timeupdate(7초)
t=160ms: seek(8초) 완료 → timeupdate(8초)
```

**문제**: 드래그 종료 후에도 이전 seek들이 계속 완료되면서 timeupdate 발생

### 원인 B: Unverified seeked Event Handling

```tsx
player.one('seeked', handleSeeked); // ❌

// 다음 seeked를 무조건 캐치
// → seek(5초) 완료 시 발생한 seeked를 캐치
// → 보호 너무 일찍 해제
```

**문제**: `player.one()`은 첫 번째 seeked를 캐치하는데, 이것이 최종 seek인지 확인 불가

### 원인 C: Unstable useCallback Closures

```tsx
const handleDragEnd = useCallback(() => {
  const finalTime = (draggingTime / 100) * duration;
  ...
}, [draggingTime, ...]); // ❌ 매 mousemove마다 재생성
```

**문제**: `draggingTime`이 dependency → 드래그 중 계속 재생성 → closure 불안정

---

## 4. 왜 상황을 오판하고 코드를 잘못 작성했는가?

### A. **증상에 집중, 원인 무시**
- "snap-back 발생" → "타이밍 문제겠지" → RAF/setTimeout으로 패치
- 실제 원인(multiple seeks)은 파악하지 못함
- **패턴**: 표면적 증상만 보고 깊은 실행 흐름 분석 없이 패치 시도

### B. **비동기에 대한 잘못된 가정**
- "video.js가 비동기니까 기다리면 되겠지"
- 실제: 여러 비동기 작업이 **동시에** 진행 → 단순 지연으로 해결 불가
- **패턴**: 비동기 작업이 순차적으로 완료될 거라는 naive한 가정

### C. **이벤트 시스템 이해 부족**
- `player.one('seeked')`가 "최종 seek의 완료"를 의미한다고 착각
- 실제: "다음에 발생하는 아무 seeked"를 캐치
- **패턴**: API의 정확한 동작 방식을 검증 없이 추측

### D. **React closure 패턴 간과**
- useCallback에서 state를 dependency로 넣으면 안정성 문제 발생
- 드래그 같은 빈번한 업데이트에서는 ref 사용 필수
- **패턴**: React의 closure 동작을 충분히 고려하지 않음

### E. **자동화 테스트의 맹점**
- 자동화 테스트는 성공했지만 실제 사용자는 문제 발생
- 이유: 프로그래밍 방식의 이벤트는 타이밍이 너무 완벽해서 race condition 재현 안됨
- **패턴**: 테스트가 통과해도 실제 환경에서는 다를 수 있음

---

## 5. 서로 놓친 것과 결정적 기여를 한 프롬프트

### 놓친 것들

**개발자(AI)가 놓친 것:**
1. **실행 흐름 시뮬레이션 부족**: 타임라인으로 정확히 무슨 일이 일어나는지 추적 안함
2. **Multiple pending operations**: 드래그 중 여러 seek가 동시에 처리 중임을 인지 못함
3. **이벤트 검증 없음**: seeked가 어떤 seek의 완료인지 확인 안함
4. **Architecture vs Patch**: 근본 구조 문제를 patch로 해결하려 함

**사용자가 놓친 것:**
1. 초반에는 구체적 증상만 제시 (snap-back 발생)
2. 실행 환경 차이 (자동화 vs 실제 사용) 인지 못함

### 결정적 기여를 한 프롬프트들

**🎯 가장 중요한 프롬프트 (게임 체인저):**

#### 프롬프트 1: 커서 깜박임 관찰
> "4. 드래그 중에는 커서가 src/features/timeline/components/Playhead.tsx 를 움직일때의 양 옆 화살표 모양이여야 하는데 일반 커서 모양으로 깜박거린다. 중간중간 드래그 상태가 풀리는것 아닌가?"

**기여**: React 리렌더링 문제 인식 → useCallback dependency 문제 발견

#### 프롬프트 2: Throttle 본질 질문
> "5. Throttle 관련 시간이 왜 필요하고 왜 존재하는가? ... 아무리 시간을 정확히 입력했어도 코드 동작에 이벤트와 상태변경이 들어가면 이미 비동기가 최소 3개 이상은 되는것이다."

**기여**: Multiple pending seeks 문제 인식 → throttled seek 제거 결정

#### 프롬프트 3: 좌표 vs 시간 개념 분리
> "우리가 움직인 src/features/timeline/components/Playhead.tsx 는 사실 timeline 영역의 x좌표를 움직인것이다. ... 좌표로 계산하고... 시간으로 변경하여 video의 seek의 지점에 번달하면 seek결과 로직은 같다."

**기여**: 단방향 제어 흐름 개념 → 좌표 기반 아키텍처로 전환

#### 프롬프트 4: 심층 분석 강제
> "ultra-deepthinking 하며 원인을 파악하고 수정하라."

**기여**: 표면적 패치에서 벗어나 근본 원인 분석으로 전환

**기타 중요 프롬프트:**

> "여전히 문제가 발생한다." (반복)

**기여**: 이전 접근이 틀렸음을 명확히 인지 → 더 깊은 분석 필요성 인식

> "테스트는 내가 직접할테니 이제 네가 하지 말아라."

**기여**: 자동화 테스트의 한계 인식 → 실제 환경의 복잡성 인정

---

## 6. 앞으로 이런 상황에서 어떻게 해야 하는가?

### 사용자가 해야 할 것

#### A. 환경 정보 명확히 제공
```
✅ "드래그할 때 커서가 깜박인다"
✅ "빠르게/천천히 드래그할 때 모두 발생"
✅ "영상 정지 상태에서 발생"
```

#### B. 관찰 가능한 부작용 모두 나열
```
"다른 이상 현상도 있나요?"
→ UI 깜박임, 성능 저하, 콘솔 에러 등
```

#### C. 강제로 심층 분석 요청
```
✅ "ultra-deepthinking 하며 원인을 파악하라"
✅ "이벤트와 상태의 흐름을 타임라인으로 시뮬레이션하라"
✅ "실행 순서를 밀리초 단위로 추적하라"
```

#### D. 아키텍처 질문
```
✅ "왜 throttle이 필요한가?"
✅ "이 상태는 누가 관리해야 하는가?"
✅ "단방향 vs 양방향 제어 중 어떤 게 맞는가?"
```

#### E. 패치 반복 시 리셋 요청
```
"지금까지 시도를 전부 버리고, 처음부터 다시 설계하라"
"기존 코드를 읽고 근본 구조 문제를 찾아라"
```

### 개발자(AI)가 해야 할 것

#### A. 패치 전 필수 분석

```typescript
1. 실행 흐름 시뮬레이션 (타임라인)
   t=0ms: ...
   t=50ms: ...

2. 비동기 작업 추적
   - 몇 개의 비동기 작업이 동시 진행?
   - 순서 보장되는가?

3. 이벤트 검증
   - 이 이벤트가 정말 내가 원하는 시점의 것인가?
```

#### B. Architecture-First 접근

```
패치 시도 전:
"이 문제는 구조적 문제인가, 구현 버그인가?"
"근본 설계 원칙을 위반하고 있는가?"
```

#### C. React 패턴 체크리스트

```
□ useCallback의 dependencies가 안정적인가?
□ State vs Ref 선택이 올바른가?
□ Closure 문제 가능성은?
□ 리렌더링 빈도가 적절한가?
```

#### D. 가정 검증 프로세스

```
모든 가정을 명시적으로 나열:
"나는 X가 Y일 것이라 가정한다"
→ 각 가정을 코드/문서로 검증
→ 검증 안되면 가정 폐기
```

---

## 7. Fix 커밋 이전과 이후 비교

### Before (710051e - 이전 fix 시도)

#### VideoPlayerView.tsx
```tsx
if (!useStore.getState().player.isScrubbing && !player.seeking()) {
  setCurrentTime(currentTime);
}
```

#### Playhead.tsx
```tsx
// handleDragEnd
setCurrentTime(draggingTime);
seek(draggingTime);
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    setIsScrubbing(false);
    setDraggingTime(null);
  });
});

// handleDrag
if (now - lastSeekTimeRef.current > 50) {
  seek(newTime); // ❌ Throttled seek
}
```

**특징**: 타이밍 기반 해결 (RAF), throttled seek 유지, 검증 없음

### After (23fa7f9 - 최종 fix)

#### VideoPlayerView.tsx
```tsx
if (state.player.isScrubbing || player.seeking()) {
  return; // ✅ 더 명확한 조건
}
```

#### Playhead.tsx
```tsx
// 좌표 기반 state (percentage)
const [draggingPosition, setDraggingPosition] = useState<number | null>(null);
const draggingPositionRef = useRef<number | null>(null);

// handleDrag - NO seek during drag
setDraggingPosition(newPosition);
// ✅ No seek during drag

// handleDragEnd
const finalPosition = draggingPositionRef.current; // ✅ Ref
const finalTime = (finalPosition / 100) * duration;

seek(finalTime);

player.on('seeked', handleSeeked); // ✅ .on (not .one)

const handleSeeked = () => {
  const diff = Math.abs(player.currentTime() - finalSeekTargetRef.current);
  if (diff < 0.1) { // ✅ 검증!
    cleanup();
  }
};
```

### 변경 요약

| 항목 | Before | After |
|------|--------|-------|
| 타이밍 해결 | ❌ RAF | ✅ seeked 이벤트 검증 |
| 드래그 중 seek | ❌ Throttled seek | ✅ No seek |
| Closure | ❌ State in closure | ✅ Ref |
| 좌표/시간 | ❌ Time-based | ✅ Coordinate-based |
| 이벤트 처리 | ❌ player.one() | ✅ player.on() + 검증 |
| Timeout | ❌ 500ms | ✅ 1000ms |

### 핵심 차이

- **Before**: 타이밍으로 문제를 "피하려" 함
- **After**: 근본 원인(multiple seeks)을 "제거"함

---

## 8. 최종 솔루션 상세

### 핵심 변경 사항

#### 1. 드래그 중 seek 완전 제거
```tsx
const handleDrag = useCallback(
  (_handleType: string, deltaX: number) => {
    // ... 좌표 계산 ...

    // Update both ref and state
    draggingPositionRef.current = newPosition;
    setDraggingPosition(newPosition);

    // NO VIDEO SEEK DURING DRAG
    // This prevents multiple pending seeks from causing race conditions
  },
  [duration, inPoint, outPoint]
);
```

**효과**: Race condition 원천 차단

#### 2. Ref 기반 안정적 closure
```tsx
const draggingPositionRef = useRef<number | null>(null);

const handleDragEnd = useCallback(() => {
  const finalPosition = draggingPositionRef.current; // ✅ 항상 최신값
  // ...
}, [duration, seek, setIsScrubbing, setCurrentTime, player]);
// draggingPosition은 dependency에서 제거
```

**효과**: useCallback 재생성 방지, 안정적인 이벤트 핸들러

#### 3. seeked 이벤트 검증
```tsx
const finalSeekTargetRef = useRef<number | null>(null);

const handleSeeked = () => {
  if (player.currentTime && finalSeekTargetRef.current !== null) {
    const diff = Math.abs(player.currentTime() - finalSeekTargetRef.current);

    if (diff < 0.1) { // ✅ 목표 도달 확인
      player.off('seeked', handleSeeked);
      cleanup();
    }
    // Otherwise, this is a stale seek - ignore it
  }
};

player.on('seeked', handleSeeked); // ✅ .on (not .one)
```

**효과**: 올바른 seek 완료 시점에만 보호 해제

#### 4. 좌표 기반 아키텍처
```tsx
// Store position as PERCENTAGE (0-100), not time
const [draggingPosition, setDraggingPosition] = useState<number | null>(null);

// UI works in COORDINATES, not time
const position = draggingPosition !== null
  ? draggingPosition
  : (duration > 0 ? (currentTime / duration) * 100 : 0);

// Convert position → time ONCE at drag end
const finalTime = (finalPosition / 100) * duration;
```

**효과**: 좌표↔시간 변환 오차 최소화, 단방향 제어 흐름

---

## 9. 교훈과 Best Practices

### 교훈

1. **표면적 증상만 보지 말고 실행 흐름을 시뮬레이션하라**
2. **비동기 작업이 여러 개 동시에 진행될 수 있음을 항상 고려하라**
3. **이벤트는 반드시 검증하라 (이것이 내가 원하는 이벤트인가?)**
4. **React closure 패턴을 정확히 이해하라 (state vs ref in useCallback)**
5. **자동화 테스트가 통과해도 실제 환경에서는 다를 수 있다**
6. **패치를 반복하기보다 구조적 문제를 먼저 점검하라**

### Best Practices

#### 드래그 구현 시
```tsx
✅ DO:
- 드래그 중에는 로컬 상태만 업데이트
- 드래그 종료 시 한 번에 동기화
- Ref를 사용하여 안정적인 closure 구현
- 좌표 기반으로 작업, 시간 변환은 최소화

❌ DON'T:
- 드래그 중 throttled 외부 API 호출
- State를 useCallback dependency에 포함
- 이벤트 검증 없이 무조건 처리
- 타이밍 기반 해결책에 의존
```

#### 비동기 작업 처리 시
```tsx
✅ DO:
- 여러 작업이 동시 진행 중임을 가정
- 각 작업의 완료를 검증
- 취소 가능한 작업은 취소 메커니즘 구현
- Target 값을 저장하여 결과 검증

❌ DON'T:
- 순차 완료를 가정
- 타이밍으로 동기화 시도
- 이벤트를 무조건 신뢰
```

---

## 10. 관련 파일

- `src/features/timeline/components/Playhead.tsx` (주요 수정)
- `src/features/player/components/VideoPlayerView.tsx` (보조 수정)
- `src/features/timeline/hooks/useDragHandle.ts` (영향 받음)

## 11. 참고 커밋

- 710051e: fix: Resolve Playhead snap-back issue on drag end (이전 시도)
- 23fa7f9: fix: Eliminate Playhead snap-back by removing throttled seek and verifying seeked events (최종 해결)

---

**문서 종료**
