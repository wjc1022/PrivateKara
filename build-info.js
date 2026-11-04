// Source preview only. scripts/prepare-build.mjs emits a frozen snapshot here
// inside each immutable release; never fetch latest version.json as "current".
export const buildInfo = Object.freeze({ version: 'development', build: null, sourceRevision: null, prepared: false });
export const deploymentRoot = new URL('./', import.meta.url);
