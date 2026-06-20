## What this is

The real, compiled UI components from **Video Trimmer** — a dark-themed,
browser-based video-trimming app (upload/URL → timeline trim → export). These
are the actual app components on `window.VideoTrimmerUI.*`, not a reimplementation.
Two notes on faithful use:

- **Dark theme.** Every component is designed for the app's dark surface
  `#101114`. Place them on a dark background or they read low-contrast (a few
  use `text-white` / translucent fills). Set the page/container to
  `var(--background)` (`#101114`); body text is `var(--foreground)` (`#d9dce3`).
- **VideoPlayerView is a placeholder shell** (the video engine is mocked); use
  it for layout, not live playback.

## Styling idiom — Tailwind v4 + theme CSS variables

Components are styled with **Tailwind v4 utility classes**. For your own layout
glue around them, use Tailwind utilities too (`flex`, `gap-2`/`gap-4`, `px-4`,
`rounded-sm`, `text-white`, `bg-white/10`, arbitrary `bg-[#2962ff]`). The design
language's colors are CSS custom properties — reference them, don't hardcode:

| Variable | Value | Use |
|---|---|---|
| `--background` | `#101114` | app/page surface |
| `--foreground` | `#d9dce3` | body text |
| `--timeline-bg` | `#1c1d20` | timeline track surface |
| `--primary-blue` | `#2962ff` | primary actions, progress, playhead controls |
| `--accent-yellow` | `#ffee65` | trim handles / markers |

Read `styles.css` (and its `@import` of `_ds_bundle.css`) for the full compiled
stylesheet, and `components/<group>/<Name>/<Name>.prompt.md` + `<Name>.d.ts` per
component before composing it.

## Data: most components read a global Zustand store

Many components don't take their data as props — they read a shared **Zustand
store** at `window.VideoTrimmerUI.useStore`. To populate them, set the store
before/while they render:

```jsx
const { useStore, Playhead, ExportProgress } = window.VideoTrimmerUI;
useStore.setState({
  phase: 'editing',
  videoFile: { source: 'url', name: 'clip.mp4', duration: 300, file: null, size: 0, type: 'video/mp4', url: '...' },
  player:   { currentTime: 150, isPlaying: false, volume: 1, isMuted: false, isScrubbing: false },
  timeline: { inPoint: 60, outPoint: 240, playhead: 150, isInPointLocked: false, isOutPointLocked: false, zoom: 1 },
});
```

Store-driven: `Playhead`, `TimelineBar`, `TimelineEditor`, `TrimHandle`,
`WaveformBackground`, `UploadProgress`, `DownloadButton`, `ExportProgress`,
`ErrorDisplay`, `UrlInputZone`, `UploadZone`. Pure-prop (pass args directly):
`TimelineControls`, `TimeInput`, `ProgressBar`.

Timeline components that interact with the player expect the player context —
wrap them in `window.VideoTrimmerUI.VideoPlayerProvider` with a value of
`{ player, play, pause, seek, togglePlay, setIsScrubbing }` (a no-op-fn value is
fine for static layouts).

## Idiomatic example

```jsx
const { ProgressBar, TimelineControls } = window.VideoTrimmerUI;
<div className="bg-[var(--background)] text-[var(--foreground)] p-4 flex flex-col gap-4">
  <ProgressBar progress={42} label="Processing…" />
  <TimelineControls
    inPoint={30} outPoint={150} duration={300}
    isInPointLocked={false} isOutPointLocked={false}
    onInPointChange={() => {}} onOutPointChange={() => {}}
    onInPointLockToggle={() => {}} onOutPointLockToggle={() => {}}
    onPreviewEdges={() => {}}
  />
</div>
```
