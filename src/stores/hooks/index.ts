/**
 * Store hook public surface — 컴포넌트/훅이 스토어를 소비하는 유일한 반응형 진입점.
 *
 * useStore를 직접 호출하지 말고 여기서 도메인별 read/action hook을 가져온다
 * (직접 호출 위험 회피 + CRUD 일원화 + 의미 있는 이름으로 재사용).
 * 소비처 특화 로직은 feature 스마트 hook(src/features/<f>/hooks)이 이 hook들을 합성한다.
 * 비반응형(render 밖) 접근은 ../snapshot 을 쓴다.
 */
export * from './media';
export * from './timeline';
export * from './player';
