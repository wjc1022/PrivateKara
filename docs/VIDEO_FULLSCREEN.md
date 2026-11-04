# Video fullscreen and orientation

English | [Chinese](VIDEO_FULLSCREEN.zh-CN.md)

Refs #6, based on the merged #7 layout in main. Request HTML container fullscreen while preserving the current orientation. Confirm entry with document.fullscreenElement, not promise fulfillment alone. Missing/rejected native fullscreen retains upright page fill. The exit button explicitly labels page fill; it cannot remove browser chrome.

There is no UA/model/device-category guessing. Available capabilities cannot reliably distinguish phones from tablets, so ordinary fullscreen entry preserves orientation for every device. This lets portrait tablets remain portrait. For a phone landscape experience, rotate physically or explicitly choose Try landscape (possibly in More). That action is offered only in confirmed native fullscreen with a portrait viewport and a lock method. It makes one landscape-lock attempt, never in page fill or an already-landscape viewport. Success exposes Follow device to release the owned lock; failure/unsupported results show manual-rotation guidance and never auto-retry. Conservatively preserving orientation means tapping ordinary fullscreen does not automatically force phone landscape: this is the deliberate tradeoff when device category cannot be established reliably.

Physical orientation, viewport dimensions, native fullscreen, the orientation API result, CSS transforms and AirPlay output are independent. A successful lock promise is not proof that the viewport or receiver rotated. Layout follows actual content width: 784px dedicated physical-right lyrics, otherwise hidden, fixed 18px typography, no stacked/overlaid lyrics, object-fit: contain. Removed CSS 90-degree rotation and dvw/dvh swapping. No video-only native fullscreen, receiver API, external-display detection or television rendering is introduced. Localized guidance covers Safari/iOS Control Center rotation lock for all platforms, without UA detection. Manifest orientation is any; OS/PWA restrictions can remain, so try Safari if installed mode stays portrait.

Close, track change (including video-to-video), native exit, navigation, page hide and backgrounding invalidate pending requests. Unlock only a lock successfully acquired by this controller; rejected/unsupported/no-lock sessions never release another orientation state. A late successful lock after cancellation is released. Entry/exit/lock operations are serialized. Refused native exit retains actual native state for retry/browser exit controls. Seeking always uses horizontal coordinates.

## Evidence boundaries

Node controller tests mock native APIs: default no-lock entry, explicit requests, success/unsupported/rejection, ownership, manual viewport changes, native exit, close/reopen, late results and refused exit. Chromium checks actual upright page-fill geometry, seeking, three-language guidance and the merged layout. Clearly labelled native API mocks exercise native states and action controls; they do not exercise real mobile fullscreen. Base checks include audio, lyric synchronization, persistence and offline caching. Mocked native/lock results and desktop tests do NOT verify iOS rotation or AirPlay. Browser output is muted and does not prove audible output.

Platform references (not device verification):
- [WebKit Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/) describes macOS/iPadOS container fullscreen and preliminary orientation support. Do not infer universal iPhone support from a historical release note.
- [ScreenOrientation.lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock) has limited availability and may require mobile fullscreen; detect capabilities and handle rejection.

## Pending physical-device checklist - NOT VERIFIED

Record device, OS version, Safari/PWA mode, orientation-lock setting, receiver/TV and commit for each result. Serve over HTTPS; retain originals/backups. Use an MV with enhanced LRC and a bare MV.

1. iPad Safari and installed PWA: portrait entry must remain portrait; landscape entry must not add a 90-degree rotation. Check physical-right lyrics above 784px content width, hidden lyrics below it in Split View, fixed 18px typography, aspect ratio, safe areas, More/queue and touch seeking. Exit by button/browser controls and repeat three times.
2. Real iPhone Safari + AirPlay SCREEN MIRRORING via Control Center (not video-only AirPlay): with orientation lock on/off, enter from portrait and record native fullscreen or page fill. If Try landscape is offered, request it and record API result separately from actual viewport orientation; test Follow device. If unavailable/rejected, rotate physically and check upright usable controls. Inspect the real external screen video, controls and lyrics; phone rendering alone is not proof.
3. Enter from landscape, exit, return to portrait and repeat at least three times. Check for sideways content, stale lock and unusable controls. Check touch seeks at 25%/75%, subtitle toggles and lyric timing on both screens.
4. While expanded: change MV, change to audio, close/reopen, navigate, background/return and disconnect/reconnect mirroring. Check cleanup and that foreground resume requires Play. Repeat in installed PWA; if rotation stays restricted, try Safari and record the difference.
5. Separately check actual audible output, receiver latency and sustained playback. Desktop success, advancing currentTime and API promises prove none of these. An external screen still sideways is a failed device check requiring investigation, not a passing fallback.
