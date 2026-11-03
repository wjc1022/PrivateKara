# Video fullscreen and orientation

English | [Chinese](VIDEO_FULLSCREEN.zh-CN.md)

Refs #6; depends on the responsive container layout in #7. Request HTML container fullscreen, then attempt screen.orientation.lock('landscape'). Confirm native fullscreen with document.fullscreenElement, not only promise fulfillment. Missing/rejected APIs retain upright page fill with the same responsive layout. The exit button explicitly labels page fill; it cannot remove browser chrome.

Fullscreen and orientation status are independent. Missing/failed orientation lock shows persistent localized manual-rotation guidance, including iOS Control Center orientation lock and checking the AirPlay external display. iOS detection only selects guidance; actual capabilities and promise results select behavior. Never rotate HTML to imitate physical rotation. Native video-only fullscreen is not requested because it excludes custom HTML lyrics. The app cannot detect/control the AirPlay receiver orientation or infer mirroring success from a lock promise. Manifest orientation is any so the app no longer requests portrait locking; OS/PWA restrictions can remain. Try Safari if installed mode stays portrait.

Close, track change (including video-to-video), native fullscreen exit, navigation, page hide and backgrounding invalidate pending entry and release orientation. Entry/exit are serialized so late fullscreen/lock results cannot revive a closed player or unlock a later session. A refused native exit retains the actual native state and permits retry or browser exit controls. Seeking always uses horizontal coordinates; video keeps object-fit: contain.

## Evidence boundaries

Node controller tests mock native APIs: success, unsupported/denied/synchronous failures, native exit, repeat entry, late fullscreen/lock results, cancellation, exit refusal and exit/entry serialization. Chromium video checks exercise actual page-fill geometry, horizontal touch seeking, guidance, lifecycle cleanup and responsive layout. Base Chromium checks include offline caching of the new module. Mocked success and desktop tests do NOT verify native mobile rotation or AirPlay. Browser output is muted and does not prove audible output.

Platform references (not device verification):
- [WebKit Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/) describes macOS/iPadOS container fullscreen and preliminary orientation support. Do not infer universal iPhone support from a historical release note.
- [ScreenOrientation.lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock) has limited availability and may require mobile fullscreen; detect capabilities and handle rejection.

## Pending physical-device checklist - NOT VERIFIED

Record device, OS version, Safari/PWA mode, orientation-lock setting, receiver/TV and commit for each result. Serve over HTTPS; retain originals/backups. Use an MV with enhanced LRC and a bare MV.

1. iPad Safari and installed PWA: enter from portrait and landscape; exit by button/browser controls; repeat three times. Rotate/resize while paused/playing, including Split View. Check right lyrics, aspect ratio, safe areas, More/queue, readable guidance and horizontal touch seeking.
2. Real iPhone Safari + AirPlay SCREEN MIRRORING via Control Center (not video-only AirPlay): with portrait orientation lock both on/off, enter from portrait. Record native fullscreen/landscape or upright page fill/guidance. Inspect the actual external screen for upright video, controls and custom lyrics. If locking is unavailable, disable orientation lock and physically rotate as instructed, then recheck the receiver. The app cannot force receiver rotation.
3. Enter from landscape, exit, return to portrait and repeat at least three times. Check for sideways content, stale lock and unusable controls. Check touch seeks at 25%/75%, subtitle toggles and lyric timing on both screens.
4. While expanded: change MV, change to audio, close/reopen, navigate, background/return and disconnect/reconnect mirroring. Check cleanup and that foreground resume requires Play. Repeat in installed PWA; if rotation stays restricted, try Safari and record the difference.
5. Separately check actual audible output, receiver latency and sustained playback. Desktop success, advancing currentTime and API promises prove none of these. An external screen still sideways is a failed device check requiring investigation, not a passing fallback.
