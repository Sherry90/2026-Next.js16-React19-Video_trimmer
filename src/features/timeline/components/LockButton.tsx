'use client';

import { LockIcon, UnlockIcon } from '@/shared/ui/icons';

interface LockButtonProps {
  locked: boolean;
  onToggle: () => void;
  label: string;
}

export function LockButton({ locked, onToggle, label }: LockButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`p-1.5 rounded transition-colors ${
        locked
          ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
      title={`${locked ? 'Unlock' : 'Lock'} ${label}`}
      aria-label={`${locked ? 'Unlock' : 'Lock'} ${label}`}
    >
      {locked ? (
        <LockIcon className="w-4 h-4" />
      ) : (
        <UnlockIcon className="w-4 h-4" />
      )}
    </button>
  );
}
