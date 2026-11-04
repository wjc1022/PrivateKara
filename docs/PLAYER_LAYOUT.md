# Width-based player layout and validation

English | [Chinese](PLAYER_LAYOUT.zh-CN.md)

Based on merged #7, PR #9 now uses the requested video-first allocation. Video has exactly two layout modes: separate horizontal regions or hidden lyrics. Device type, UA, physical resolution and viewport orientation do not choose the mode.

## Single video threshold

The named CSS container is the .player-sheet content box. At **784 CSS px or more** show the dedicated physical-right lyric region; below that width hide it entirely and return all available space to video. Content width excludes padding, safe-area space and borders, so this is not a viewport breakpoint.

Video gets at least **75% of content width**, gap is **16px**, and lyrics use **min(300px, 25cqw - 16px)**. Requiring 180px minimum lyrics gives .25 * W - 16 >= 180, hence W >= 784px. Descendant cqw must resolve against the sheet content box; acceptance checks verify actual allocation rather than assuming container-unit behavior. Shared safe-area variables constrain visuals and controls together. Lyrics remain in normal horizontal flex flow and on the physical right in RTL UI. Video keeps object-fit: contain. Progress, transport, menus and the bottom gradient stop at the video boundary. Disabled or empty lyrics also release their space.

All lyric lines use 18px, weight 600, line-height 1.85 and no transform. Current/next/past line states change color only; Enhanced LRC word colors and active-word marking remain. Text wraps naturally. There are no font-size changes by width, line state or fullscreen.

| Content width | Lyrics | Gap | Video |
|---|---:|---:|---:|
| 700px | hidden | 0 | 700px |
| 780px | hidden | 0 | 780px |
| 784px | 180px | 16px | 588px |
| 900px | 209px | 16px | 675px |
| 1100px | 259px | 16px | 825px |
| 1400px | 300px | 16px | 1084px |

## Fullscreen boundary

Merged #7 established the width/typography rules above. #6 / PR #9 removes CSS rotation: native fullscreen preserves current orientation and failure uses upright page fill. Only explicit user intent can request a landscape lock in an appropriate native context. All modes follow actual content width. The legacy landscape-video class selects video-control styling, not orientation. See [fullscreen and orientation](VIDEO_FULLSCREEN.md).

## Automated coverage

Video browser tests inspect computed styles and bounding boxes at 390x844, 568x320, 844x390, 768x1024, 820x1180, 1024x768 and 1280x800. Opposite viewport orientations also use identical constrained content widths of 700/780/783/784/785/900/1100/1400px with asymmetric 40/44px safe-area variables. Checks cover identical modes at identical widths, the boundary, exact allocations, video >=75%, lyrics 180..300px and 16px gap, no overlap or stacking, RTL physical-right placement, control boundaries, fixed typography, natural wrapping, word colors, upright page fill (native/lock outcomes use explicitly labelled API mocks). Base checks cover fixed audio-lyric typography in light/dark themes and updated offline shell caching. Node coverage retains LRC/Enhanced LRC synchronization regressions.

Desktop checks do not establish iOS Safari, installed-PWA, audible-output or AirPlay compatibility.

## Pending real-device acceptance - NOT VERIFIED

- iPad Safari and installed PWA: portrait/landscape, Split View and resizing around 784px while playing/paused. Confirm separate right lyrics when sufficient, hidden lyrics otherwise, and undistorted video.
- iPhone Safari: narrow portrait hides lyrics; landscape follows usable width. Check safe areas, subtitles, More/queue, touch seeking and readable fixed 18px multilingual lyrics.
- Repeated native fullscreen/upright page-fill entry and exit: inspect layout/typography, explicit landscape requests, failure, Follow device and manual rotation; confirm no CSS rotation.
- Actual AirPlay SCREEN MIRRORING: portrait/landscape entry, exit and repeat; observe the physical external display orientation, lyrics and audible output. Desktop results cannot replace these checks. Use HTTPS for full PWA acceptance; HTTP LAN is suitable for basic visual testing only.
