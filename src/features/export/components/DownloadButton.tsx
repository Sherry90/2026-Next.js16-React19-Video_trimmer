'use client';

import { usePhase } from '@/stores/hooks';
import { CheckCircleIcon } from '@/shared/ui/icons';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { TextInput } from '@/shared/ui/TextInput';
import { useDownload } from '../hooks/useDownload';

export function DownloadButton() {
  const phase = usePhase();
  const {
    outputUrl,
    outputFilename,
    ext,
    editableName,
    setEditableName,
    handleDownload,
    handleBackToEdit,
    handleEditAnother,
  } = useDownload();

  if (phase !== 'completed' || !outputUrl || !outputFilename) {
    return null;
  }

  return (
    <Card variant="white" className="text-center space-y-4">
      <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500" />

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Video Ready!
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        파일 이름을 정하고 다운로드 버튼을 눌러 저장하세요.
      </p>

      <div className="text-left space-y-1">
        <label htmlFor="save-as-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Save as
        </label>
        <div className="flex items-center gap-1">
          <TextInput
            id="save-as-input"
            value={editableName}
            onChange={(e) => setEditableName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {ext && (
            <span className="text-sm text-gray-500 dark:text-gray-400 select-none whitespace-nowrap">
              {ext}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <Button
          onClick={handleDownload}
          data-testid="download-button"
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Download
        </Button>

        <Button
          onClick={handleBackToEdit}
          data-testid="back-to-edit-button"
          className="px-6 py-3 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          Back to Edit
        </Button>

        <Button
          onClick={handleEditAnother}
          data-testid="edit-another-button"
          className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Edit Another File
        </Button>
      </div>
    </Card>
  );
}
