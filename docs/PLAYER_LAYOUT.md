# Width-based player layout and validation

English | [Chinese](PLAYER_LAYOUT.zh-CN.md)

Refs #7 / Draft PR #8. The user's revision supersedes the original Issue allowance for narrow lyric overlays. Video has exactly two layout modes: separate horizontal regions or hidden lyrics. Device type, UA, physical resolution and viewport orientation do not choose the mode.

## Single video threshold

The named CSS container is the .player-sheet content box. At **656 CSS px or more** show the dedicated physical-right lyric region; below that width hide it entirely and return all available space to video. Content width excludes padding, safe-area space and borders, so this is not a viewport breakpoint.

The threshold budgets **360px minimum video + 16px gap + 280px minimum lyrics**. Lyrics use clamp(280px, 30cqw, 360px), allowing some growth on wider surfaces while preserving video space. Shared safe-area variables constrain visuals and controls together. Lyrics remain in normal horizontal flex flow and on the physical right in RTL UI. Video keeps object-fit: contain. Progress, transport, menus and the bottom gradient stop at the video boundary. Disabled or empty lyrics also release their space.

All lyric lines use 18px, weight 600, line-height 1.85 and no transform. Current/next/past line states change color only; Enhanced LRC word colors and active-word marking remain. Text wraps naturally. There are no font-size changes by width, line state or fullscreen.

## Fullscreen boundary

This PR leaves native fullscreen requests, orientation locking, page fill and CSS rotation fallback unchanged. The rule uses the player's actual logical content width in those states. The legacy landscape-video class selects video-control styling, not orientation. Existing portrait rotation fallback rotates the entire player: logical right can appear vertically on the physical screen. It does not rotate the OS or AirPlay receiver. That limitation belongs to #6 / PR #9, which this revision does not modify.

## Automated coverage

Video browser tests inspect computed styles and bounding boxes at 390x844, 568x320, 844x390, 768x1024, 820x1180, 1024x768 and 1280x800. Opposite viewport orientations also use identical constrained content widths of 655/656/657/760px with asymmetric 40/44px safe-area variables. Checks cover identical modes at identical widths, the boundary, minimum video/lyric widths, no overlap or stacking, RTL physical-right placement, control boundaries, fixed typography, natural wrapping, word colors, page fill and rotated seeking. Base checks cover fixed audio-lyric typography in light/dark themes and updated offline shell caching. Node coverage retains LRC/Enhanced LRC synchronization regressions.

Desktop checks do not establish iOS Safari, installed-PWA, audible-output or AirPlay compatibility.

## Pending real-device acceptance - NOT VERIFIED

- iPad Safari and installed PWA: portrait/landscape, Split View and resizing around 656px while playing/paused. Confirm separate right lyrics when sufficient, hidden lyrics otherwise, and undistorted video.
- iPhone Safari: narrow portrait hides lyrics; landscape follows usable width. Check safe areas, subtitles, More/queue, touch seeking and readable fixed 18px multilingual lyrics.
- Repeated fullscreen/page-fill entry and exit: inspect layout and typography. Record the unchanged rotation fallback limitation for #6.
- Actual AirPlay SCREEN MIRRORING: portrait/landscape entry, exit and repeat; observe the physical external display orientation, lyrics and audible output. Desktop results cannot replace these checks. Use HTTPS for full PWA acceptance; HTTP LAN is suitable for basic visual testing only.
