# Video subtitle layout and validation

English | [Chinese](PLAYER_LAYOUT.zh-CN.md)

Issue #17 extends the side-only layout with bottom subtitles. The legacy `landscape-video` class still selects immersive controls for every expanded video; actual viewport orientation selects the subtitle preference using `matchMedia('(orientation: landscape)')`.

## Modes and persistence

Landscape cycles **side → bottom → off → side**, defaulting to side. Portrait cycles **bottom → off → bottom**, defaulting to bottom. The subtitle button names the next action in English, Simplified Chinese and Persian. `lumen.lyricModes` in localStorage stores the two choices separately, independently of `lumen.playerButtons`, media IndexedDB and audio subtitle visibility. Choices survive song changes, player close/reopen and app reload. A narrow side selection remains side, even while its lyrics are hidden by the width rule.

## Side mode

The named CSS container is the `.player-sheet` content box. At **656 CSS px or more**, side mode shows the dedicated physical-right lyric region; below that width it hides the region and returns its space to video. Content width excludes padding, safe-area space and borders. The sidebar remains `clamp(180px, 25cqw, 280px)` with a 16px gap. It stays in normal flex flow, including in RTL. Controls and their gradient share the video/sidebar boundary. Missing lyrics release sidebar space.

Side and audio modes retain the entire lyric list, scrolling and current-line auto-centering. Audio lyric presentation is unchanged.

## Bottom mode

Both orientations use one absolutely positioned overlay directly under the player sheet, outside the clipped video row. The existing lyric DOM moves back into the row for side/audio modes. Bottom scrolling is instantaneous. The overlay is anchored to the player container, only the bottom safe area above its bottom edge. Video, lyrics, controls and menus use ascending layers; visible controls may cover subtitles. Horizontal safe-area variables are shared with the controls; the overlay ignores pointer events, and menus remain above controls. The subtitle inset remains fixed when controls auto-hide, so lyrics do not jump. The overlay can occupy blank space or cover video. It never participates in video flex sizing: **bottom and off have identical video geometry**, with `object-fit: contain` throughout.

The entire lyric DOM and existing `findActiveLine`, next timed nonblank line and Enhanced LRC word-state logic are retained. CSS displays only current/next nodes, with a blank text-line slot for an absent current or next line. Timed blank interlude markers keep their timing and the next valid preview. Bottom mode resets scrolling and never auto-centers. Missing or untimed-only lyrics produce no bottom overlay; the existing lyric content/no-lyrics feedback DOM is preserved.

For the space rule, the player computes the actual centered contain-picture bounds using the host rectangle and intrinsic video dimensions. If the naturally wrapped subtitle content fits wholly below the picture, it may use that blank space. Otherwise its visible height is capped at two text line heights and overflow is clipped. Metadata loading, host/body resizing, orientation changes, font loading and lyric DOM/state changes trigger recalculation. There is no text-length algorithm.

All lyric modes retain **18px / weight 600**. Side/audio retain line-height **1.85**; bottom mode uses the user-requested compact **1.5** line-height (27px, with a 54px two-line cap). All modes retain current/next/past colors, Enhanced LRC word colors, `white-space: pre-wrap` and `overflow-wrap: anywhere`. Bottom layout removes line padding to make the two-line cap correspond to text line heights. Long current lines may consume the region and clip the preview. No font shrinking or ellipsis is used.

## Automated coverage

Run from the repository root:

```powershell
node --test tests/lrc.test.mjs
$testFiles = (Get-ChildItem tests/*.test.mjs).FullName
node --experimental-vm-modules --test $testFiles
node tests/browser-runner.mjs
node tests/browser-runner.mjs --video
```

Node checks cover preference cycles, independent persisted choices, malformed preferences, lyric playback/pause/seek/track changes, stale async results, interludes, absent next lines and Enhanced LRC. Bottom checks verify that centering stays disabled while side/audio retain it.

The isolated, muted desktop Chromium suite uses actual locally recorded wide/tall videos and page reloads. It checks mode cycles and next labels, orientation restoration, bottom/off rectangles, actual text visibility after switching from a scrolled full-song sidebar and during playback with hidden controls, contain overlap/non-overlap, wrapping/clipping, RTL and localized labels, simulated asymmetric horizontal and bottom safe areas, controls/More and visibility preferences. Side-mode regressions retain explicit 655/656/657 CSS px content widths and clamped widths. The base browser suite retains audio, instrumental, lyrics, import/backup and offline shell checks. No new runtime module or cache namespace is needed; modified runtime files are already in the network-first app shell.

## Pending real-device acceptance — NOT VERIFIED

- iPhone Safari and installed PWA over HTTPS: both mode cycles, rotation-specific choices, repeated expansion/collapse, restart persistence, touch seeking, safe areas, wrapping, lyric timing and control/menu access.
- iPad Safari/PWA: portrait/landscape, Split View and resizing around 656px while playing/paused; confirm side selection is retained while hidden below the threshold.
- Actual AirPlay **screen mirroring**: entry/exit/repeat in both orientations, physical receiver output, readable bottom/side subtitles, audible output and sustained synchronization.
- Real device safe areas and installed-PWA lifecycle remain manual pending. Simulated desktop safe-area values and advancing playback do not establish iPhone or AirPlay reliability. No native fullscreen, remote control or independent TV display is introduced.
