# Build identification and deployment

English | [Chinese](BUILD_IDENTIFICATION.zh-CN.md)

## Identify the running iPhone build

In a prepared site, open Menu > About and record the running version, full build ID and immutable source snapshot. These values come from the JavaScript module loaded by that page, never from latest server version.json. Check server build updates a separate field only. Current identity changes after accepting an update and reloading; offline reload retains the cached identity.

Git SHA is checkout provenance, not the primary build identity. Only a clean checkout with byte-identical captured inputs is labelled clean; modified, untracked or ignored generated runtime inputs cannot impersonate an exact commit build. Content snapshot/build hashes remain authoritative. Raw source preview is explicitly unverified and must not be used to identify an acceptance build.

## One metadata input, immutable static output

Maintain only version.json application version, release date and changelog. Do not manually maintain build numbers, footer versions or SW cache versions. The dependency-free Node packager generates:

- sourceRevision: SHA-256 snapshot of runtime inputs, paths and generator, including actual independently generated asset bytes.
- build: SHA-256 identity of configuration, content snapshot and Git provenance. Asset changes produce a new ID even without a semantic version bump.
- builds/BUILD_ID/: immutable JS/CSS/locales/resources, including a generated build-info.js with the same frozen metadata used by the running application.
- Root index.html/manifest.json/version.json/sw.js: entry bound to immutable resources; worker cache name lumen-shell-BUILD_ID and SHA-256 manifest of every precached response.

Root version.json describes the available server release. Update checks fetch it network-only with a cache-busting query. Current identity always comes from the loaded module, even if IndexedDB still contains an old update result. Same-version new builds are updates; dismissal is keyed by build ID.

## Local acceptance and future releases

~~~powershell
node scripts/prepare-build.mjs
py -3 -m http.server 8081 --bind 0.0.0.0 --directory dist
~~~

Prefer a separate testing port to avoid a previous source-preview origin. Do not clear existing libraries or browser data. LAN HTTP can identify the static artifact and test basic layout; full worker/PWA acceptance requires trusted HTTPS or Windows localhost. iPhone/iPad certificate trust and AirPlay still need physical validation.

1. Finish code/tests/logical commits; edit version.json version/changelog as appropriate (no manual build-counter bump per asset change).
2. Package from a clean checkout. Record full build/sourceRevision/Git status. Exported source without Git still gets a content revision and unknown Git provenance.
3. Deploy the complete dist artifact. Upload immutable build directories first, then mutable root metadata/entry, and sw.js last. Retain older directories for old tabs; never modify generated files or overwrite an immutable build directory.
4. Record the iPhone current identity, check available identity, accept update and reload, then confirm new identity. Test offline reopen, media persistence and audible playback separately.

No .github/workflows deployment configuration was available during inspection. This task does not alter remote hosting or publish a site. Hosting that currently publishes the repository root must switch to the prepared artifact; otherwise it serves unverified source preview without the new offline guarantees. Source preview can still be served directly, but does not register a worker or claim a release identity.

## Lifecycle and limitations

Installation validates the complete asset set before caching. Missing/corrupt responses reject installation, preserving the old complete worker. An installed update waits for user activation rather than interrupting playback. Already-waiting workers receive SKIP_WAITING immediately; timeout/failure does not blindly reload. Controller changes cannot relabel loaded modules: page reload is required to change the running build.

Old immutable caches are retained so other old tabs cannot mix in new modules. No unrelated caches, IndexedDB or media are purged. Historical cache/directory storage can grow; safe active-client-aware garbage collection is future work, not an automatic reset. An initial uncontrolled load still depends on a complete immutable deployment; missing resources can fail loading. Content IDs/integrity checking do not replace HTTPS or establish iOS/AirPlay reliability.

Checks cover deterministic packaging/content changes, provenance, current-versus-server builds, same-version updates, waiting activation, corrupt deployment rejection, offline reload and existing persistence. Desktop checks are not physical-iPhone acceptance.
