'use client';

import { useErrorState, useErrorActions, useReset } from '@/stores/hooks';
import { AlertCircleIcon } from '@/shared/ui/icons';

export function FileValidationError() {
  const error = useErrorState();
  const { clearError } = useErrorActions();
  const reset = useReset();

  if (!error.hasError || error.errorCode !== 'VALIDATION_ERROR') {
    return null;
  }

  const handleRetry = () => {
    clearError();
    reset();
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-start">
        <AlertCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-1">
            File Validation Error
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            {error.errorMessage}
          </p>

          <button
            onClick={handleRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
          >
            Try Another File
          </button>
        </div>
      </div>
    </div>
  );
}
