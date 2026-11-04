# Application version and manual releases

English | [Chinese](BUILD_IDENTIFICATION.zh-CN.md)

Maintain only version.json: application version (three numeric components), a positive integer build, and optional release date/changelog. Increment build for every release, including releases with the same application version. Current release: consult version.json; do not copy version numbers into JavaScript, HTML or the worker.

Serve repository files directly (no packaging or dist requirement):

```sh
python -m http.server 8080
```

Use HTTPS for phone/PWA acceptance; HTTP LAN supports basic layout testing but not service workers. Installing a local certificate requires separate permission and device trust.

## Display and updates

At boot, versionService reads ordinary version.json once and freezes its version/build for the page. With an installed worker, this response comes from that worker's shell cache, including offline. About shows these loaded values; navigation uses the same version. A cache-busted, network-only request checks the latest server release separately and cannot relabel the current page. Initial uncontrolled loads depend on the deployed repository files.

The worker registration URL includes the build number; changing that number installs a worker even if sw.js itself is unchanged. Its cache is lumen-shell-build-N. Installation requires the complete listed static shell and matching version.json. Existing clients retain their active worker until they accept the update. Acceptance registers the newer build, sends SKIP_WAITING, waits for controllerchange, then reloads. Failure/timeout leaves the current page running. Offline reopening retains the installed version/build. Activation removes only older lumen-shell- caches; unrelated caches and IndexedDB (including imported songs) are untouched.

## Release checklist and limits

1. Change version.json, increment build, and deploy all application files together. Do not publish partial releases; no hash verification or atomic deployment guarantee is provided.
2. Test About/footer, update detection, explicit activation/reload, and offline reopening with an existing library. No data reset is necessary.
3. Forgetting to increment build can prevent update detection and replace content under an existing cache identity. This is a documented manual-release limitation. Build numbers must increase across releases, not reset with a version change.
4. Already-open tabs retain their page version until reload; after another tab activates an update, reload old tabs before acceptance testing. Plain static hosting does not guarantee immutable assets or mixed-tab source provenance.
5. Older experimental immutable releases must be refreshed from the repository entry after deployment; this correction does not provide an automatic migration path for every old experimental tab.

Desktop automated tests use isolated browser profiles, simulated releases and synthetic media. Real iPhone/iPad Safari/PWA, offline restart persistence, audible playback, fullscreen/orientation and AirPlay screen mirroring remain physical-device checks. Desktop simulations do not prove those behaviors.
