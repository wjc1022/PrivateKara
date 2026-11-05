# Width-based player layout and validation

English | [Chinese](PLAYER_LAYOUT.zh-CN.md)

Refs #7 / Draft PR #8. The user's revision supersedes the original Issue allowance for narrow lyric overlays. Video has exactly two layout modes: separate horizontal regions or hidden lyrics. Device type, UA, physical resolution and viewport orientation do not choose the mode.

## Single video threshold

The named CSS container is the .player-sheet content box. At **656 CSS px or more** show the dedicated physical-right lyric region; below that width hide it entirely and return all available space to video. Content width excludes padding, safe-area space and borders, so this is not a viewport breakpoint.

The **656 CSS px threshold stays fixed**, independently of lyric sizing. With lyrics present and subtitles enabled, lyrics take clamp(180px, 25cqw, 280px) first, and video takes the remaining width after the 16px gap. Below the threshold, or with missing/disabled lyrics, video takes the full available width. Shared safe-area variables constrain visuals and controls together. Lyrics remain in normal horizontal flex flow and on the physical right in RTL UI. Video keeps object-fit: contain. Progress, transport, menus and the bottom gradient stop at the video boundary. Disabled or empty lyrics also release their space.

All lyric lines use 18px, weight 600, line-height 1.85 and no transform. Current/next/past line states change color only; Enhanced LRC word colors and active-word marking remain. Text wraps naturally. There are no font-size changes by width, line state or fullscreen.

## Immersive playback boundary

Issue #13 removes the fullscreen button and its native fullscreen requests, orientation lock, page-fill state and CSS rotation fallback. Expanded video still covers the catalog. The legacy landscape-video class selects immersive controls for every expanded video, not orientation. Responsive portrait/landscape layout, the 656px content threshold and control auto-hide/reveal remain. The app does not control system or AirPlay receiver orientation.

## Automated coverage

Video browser tests inspect computed styles and bounding boxes at 390x844, 568x320, 844x390, 768x1024, 820x1180, 1024x768 and 1280x800. Opposite viewport orientations also use identical constrained content widths of 655/656/657/720/760/1120/1200px with asymmetric 40/44px safe-area variables. Checks cover identical modes at identical widths, the boundary, exact clamped lyric widths and remaining video widths, no overlap or stacking, RTL physical-right placement, control boundaries, fixed typography, natural wrapping, word colors, pointer seeking, immersive controls and legacy button preferences. Base checks cover fixed audio-lyric typography in light/dark themes and updated offline shell caching. Node coverage retains LRC/Enhanced LRC synchronization regressions.

Desktop checks do not establish iOS Safari, installed-PWA, audible-output or AirPlay compatibility.

## Pending real-device acceptance - NOT VERIFIED

- iPad Safari and installed PWA: portrait/landscape, Split View and resizing around 656px while playing/paused. Confirm separate right lyrics when sufficient, hidden lyrics otherwise, and undistorted video.
- iPhone Safari: narrow portrait hides lyrics; landscape follows usable width. Check safe areas, subtitles, More/queue, touch seeking and readable fixed 18px multilingual lyrics.
- Repeated player expansion/collapse and device rotation: inspect catalog coverage, layout, typography and control hide/reveal.
- Actual AirPlay SCREEN MIRRORING: portrait/landscape entry, exit and repeat; observe the physical external display orientation, lyrics and audible output. Desktop results cannot replace these checks. Use HTTPS for full PWA acceptance; HTTP LAN is suitable for basic visual testing only.
