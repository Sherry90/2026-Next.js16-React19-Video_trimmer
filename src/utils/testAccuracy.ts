/**
 * 트리밍 정확도 테스트 유틸리티
 *
 * 개발 목적으로만 사용됩니다.
 * 실제 프로덕션 코드에서는 제거해야 합니다.
 */

export interface AccuracyTestCase {
  name: string;
  startTime: number;
  endTime: number;
  expectedDuration: number;
}

export interface AccuracyTestResult {
  testCase: AccuracyTestCase;
  actualDuration: number;
  error: number; // 오차 (초)
  errorPercentage: number; // 오차 비율 (%)
}

/**
 * 트리밍 정확도 테스트 케이스
 */
export const ACCURACY_TEST_CASES: AccuracyTestCase[] = [
  {
    name: '짧은 구간 (2-5초)',
    startTime: 2.0,
    endTime: 5.0,
    expectedDuration: 3.0,
  },
  {
    name: '중간 구간 (30-45초)',
    startTime: 30.0,
    endTime: 45.0,
    expectedDuration: 15.0,
  },
  {
    name: '긴 구간 (120-180초)',
    startTime: 120.0,
    endTime: 180.0,
    expectedDuration: 60.0,
  },
  {
    name: '소수점 정밀도 (2.345-5.678초)',
    startTime: 2.345,
    endTime: 5.678,
    expectedDuration: 3.333,
  },
  {
    name: '매우 짧은 구간 (0.5-1.5초)',
    startTime: 0.5,
    endTime: 1.5,
    expectedDuration: 1.0,
  },
];

/**
 * 비디오 파일의 실제 duration을 측정
 */
export async function measureVideoDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);

    video.preload = 'metadata';
    video.src = url;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata'));
    };
  });
}

/**
 * 정확도 테스트 결과 분석
 */
export function analyzeAccuracyResult(
  testCase: AccuracyTestCase,
  actualDuration: number
): AccuracyTestResult {
  const error = actualDuration - testCase.expectedDuration;
  const errorPercentage = (error / testCase.expectedDuration) * 100;

  return {
    testCase,
    actualDuration,
    error,
    errorPercentage,
  };
}

/**
 * 테스트 결과를 콘솔에 출력
 */
export function logTestResult(result: AccuracyTestResult): void {
  console.group(`📊 ${result.testCase.name}`);
  console.log(`예상 duration: ${result.testCase.expectedDuration.toFixed(3)}초`);
  console.log(`실제 duration: ${result.actualDuration.toFixed(3)}초`);
  console.log(
    `오차: ${result.error >= 0 ? '+' : ''}${result.error.toFixed(3)}초 (${result.errorPercentage.toFixed(2)}%)`
  );

  if (Math.abs(result.error) < 0.1) {
    console.log('✅ 정확도: 매우 높음 (±0.1초 이내)');
  } else if (Math.abs(result.error) < 0.5) {
    console.log('✅ 정확도: 높음 (±0.5초 이내)');
  } else if (Math.abs(result.error) < 1.0) {
    console.log('⚠️ 정확도: 보통 (±1초 이내)');
  } else if (Math.abs(result.error) < 2.0) {
    console.log('⚠️ 정확도: 낮음 (±2초 이내)');
  } else {
    console.log('❌ 정확도: 매우 낮음 (±2초 초과)');
  }

  console.groupEnd();
}

/**
 * 테스트 결과를 마크다운 표 형식으로 생성
 */
export function generateMarkdownReport(results: AccuracyTestResult[]): string {
  const header = '| 테스트 케이스 | 예상 (초) | 실제 (초) | 오차 (초) | 오차 (%) |\n' +
                 '|-------------|----------|----------|----------|----------|\n';

  const rows = results.map(result => {
    const { testCase, actualDuration, error, errorPercentage } = result;
    return `| ${testCase.name} | ${testCase.expectedDuration.toFixed(3)} | ${actualDuration.toFixed(3)} | ${error >= 0 ? '+' : ''}${error.toFixed(3)} | ${errorPercentage.toFixed(2)}% |`;
  }).join('\n');

  const avgError = results.reduce((sum, r) => sum + Math.abs(r.error), 0) / results.length;
  const maxError = Math.max(...results.map(r => Math.abs(r.error)));

  const summary = `\n\n### 요약\n` +
                  `- 평균 오차: ±${avgError.toFixed(3)}초\n` +
                  `- 최대 오차: ±${maxError.toFixed(3)}초\n` +
                  `- 테스트 개수: ${results.length}개\n`;

  return header + rows + summary;
}

/**
 * 개발자 콘솔에서 사용할 수 있는 테스트 헬퍼
 *
 * 사용 방법:
 * 1. 브라우저 개발자 도구를 엽니다
 * 2. 비디오를 업로드하고 트리밍합니다
 * 3. Export 후 다운로드된 파일의 duration을 확인합니다
 * 4. 콘솔에서 결과를 기록합니다
 */
export const devTools = {
  /**
   * 현재 페이지의 비디오 엘리먼트 duration 확인
   */
  getVideoDuration: () => {
    const video = document.querySelector('video');
    if (!video) {
      console.error('비디오 엘리먼트를 찾을 수 없습니다');
      return null;
    }
    console.log(`비디오 duration: ${video.duration.toFixed(3)}초`);
    return video.duration;
  },

  /**
   * 테스트 케이스 목록 출력
   */
  listTestCases: () => {
    console.table(ACCURACY_TEST_CASES);
  },

  /**
   * 수동 테스트 결과 기록
   */
  recordResult: (testCaseIndex: number, actualDuration: number) => {
    const testCase = ACCURACY_TEST_CASES[testCaseIndex];
    if (!testCase) {
      console.error(`테스트 케이스 ${testCaseIndex}를 찾을 수 없습니다`);
      return;
    }

    const result = analyzeAccuracyResult(testCase, actualDuration);
    logTestResult(result);
    return result;
  },

  /**
   * 전체 테스트 결과 마크다운 생성
   */
  generateReport: (results: AccuracyTestResult[]) => {
    const markdown = generateMarkdownReport(results);
    console.log(markdown);
    return markdown;
  },
};

// 개발 환경에서만 window에 노출
if (process.env.NODE_ENV === 'development') {
  (window as any).accuracyTest = devTools;
}
