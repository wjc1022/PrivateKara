# Responsive player validation

Refs #7. Video sheets use the available viewport, in both portrait and landscape. CSS container queries measure the sheet content width: at 700px and above video and lyrics are separate (75:25); below 700px lyrics overlay the physical right side; below 440px they overlay the center. Lyrics remain centered within the panel, with independent RTL text direction. Empty/disabled subtitles release video space. Audio lyrics prefer the right at content widths of at least 600px. Controls measure their actual row and move optional actions into More.

Automated desktop coverage: video.browser.html resizes the iframe through 390x844, 600x900, 768x1024, 820x1180, 1024x768, 1280x800 and compact landscape; checks actual panel geometry, contain sizing, resize, RTL, preferences and touch/keyboard seeking. These checks do not establish real iOS compatibility.

Pending manual checks (not verified):
- iPad Safari and installed PWA: portrait and landscape, Split View widths near 440/700px, rotation while paused/playing; verify right panel, undistorted MV and readable active lyrics.
- Test long/multilingual lyrics and Persian UI, subtitles off/on, More and queue, seek by touch, large text and all safe-area edges.
- Repeat resizing and fullscreen entry/exit; inspect controls after browser chrome changes. iPhone/AirPlay orientation handling is tracked separately in #6.
