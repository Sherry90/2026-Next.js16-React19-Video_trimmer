'use client';

import { useEffect } from 'react';

/**
 * 개발 도구 컴포넌트
 * 개발 환경에서만 로드되며, 브라우저 콘솔에 테스트 유틸리티를 노출합니다.
 */
export function DevTools() {
  useEffect(() => {
    // 개발 환경에서만 실행
    if (process.env.NODE_ENV === 'development') {
      // 동적 import로 테스트 유틸리티 로드
      import('@/utils/testAccuracy').then((module) => {
        // window 객체에 노출
        (window as any).accuracyTest = module.devTools;

        console.log(
          '%c🔧 Dev Tools Loaded',
          'color: #3b82f6; font-size: 14px; font-weight: bold;'
        );
        console.log(
          '%cAccuracy Test 유틸리티가 로드되었습니다.',
          'color: #6b7280; font-size: 12px;'
        );
        console.log('');
        console.log(
          '%c사용 방법:',
          'color: #10b981; font-size: 12px; font-weight: bold;'
        );
        console.log(
          '%caccuracyTest.listTestCases()       - 테스트 케이스 목록',
          'color: #6b7280; font-size: 11px;'
        );
        console.log(
          '%caccuracyTest.getVideoDuration()    - 비디오 duration 확인',
          'color: #6b7280; font-size: 11px;'
        );
        console.log(
          '%caccuracyTest.recordResult(0, 3.0)  - 테스트 결과 기록',
          'color: #6b7280; font-size: 11px;'
        );
        console.log('');
        console.log(
          '%c자세한 사용법: .docs/accuracy-test-guide.md',
          'color: #6b7280; font-size: 11px; font-style: italic;'
        );
      });
    }
  }, []);

  // 아무것도 렌더링하지 않음
  return null;
}
