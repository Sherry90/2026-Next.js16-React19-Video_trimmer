'use client';

import { useStore } from '@/stores/useStore';

export function ErrorDisplay() {
  const error = useStore((state) => state.error);
  const clearError = useStore((state) => state.clearError);
  const reset = useStore((state) => state.reset);

  if (!error.hasError || error.errorCode === 'VALIDATION_ERROR') {
    return null;
  }

  const handleRetry = () => {
    clearError();
    reset();
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-start">
        <svg
          className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-1">
            Error Occurred
          </h3>

          <div className="space-y-2 mb-4">
            {error.errorCode && (
              <p className="text-sm font-mono text-red-700 dark:text-red-300">
                Code: {error.errorCode}
              </p>
            )}
            <p className="text-sm text-red-700 dark:text-red-300">
              {error.errorMessage}
            </p>
          </div>

          <button
            onClick={handleRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
