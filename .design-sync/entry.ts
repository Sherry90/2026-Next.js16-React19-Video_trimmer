// Synthetic design-system barrel for design-sync.
// Exposes the app's storied UI components on window.VideoTrimmerUI so the
// converter can bundle the real compiled components as the shipped DS bundle.
// (This repo is a Next.js app, not a packaged DS — see .design-sync/NOTES.md.)
export { DownloadButton } from '@/features/export/components/DownloadButton';
export { ErrorDisplay } from '@/features/export/components/ErrorDisplay';
export { ExportProgress } from '@/features/export/components/ExportProgress';
export { VideoPlayerView } from '@/features/player/components/VideoPlayerView';
export { Playhead } from '@/features/timeline/components/Playhead';
export { TimeInput } from '@/features/timeline/components/TimeInput';
export { TimelineBar } from '@/features/timeline/components/TimelineBar';
export { TimelineControls } from '@/features/timeline/components/TimelineControls';
export { TimelineEditor } from '@/features/timeline/components/TimelineEditor';
export { TrimHandle } from '@/features/timeline/components/TrimHandle';
export { WaveformBackground } from '@/features/timeline/components/WaveformBackground';
export { UploadProgress } from '@/features/upload/components/UploadProgress';
export { UploadZone } from '@/features/upload/components/UploadZone';
export { UrlInputZone } from '@/features/url-input/components/UrlInputZone';
export { ProgressBar } from '@/shared/ui/ProgressBar';

// Shared context + store, hoisted onto the global so story decorators
// (which wrap VideoPlayerProvider / inject useStore state) share React-context
// and Zustand-store identity with the bundled components. Routed via
// cfg.storyImports.shim because their filenames don't match the export names.
export { VideoPlayerProvider, useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
export { useStore } from '@/stores/useStore';
