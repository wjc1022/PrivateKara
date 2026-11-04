import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function prepareBuild({ root = fileURLToPath(new URL('..', import.meta.url)), out = resolve(root, 'dist'), overrides = {} } = {}) {
  root = resolve(root); out = resolve(out);
  if (out === root || ['src', 'assets', 'scripts'].includes(relative(root, out).split(/[\\/]/)[0].toLowerCase())) throw Error('Output must not overwrite source inputs');
  const inputs = new Map();
  async function collect(path) {
    for (const entry of (await readdir(join(root, path), { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = path + '/' + entry.name;
      if (entry.isSymbolicLink()) throw Error('Symlink input is not supported: ' + name);
      if (entry.isDirectory()) await collect(name);
      else inputs.set(name, await readFile(join(root, name)));
    }
  }
  for (const path of ['index.html', 'manifest.json', 'version.json', 'sw.js', 'build-info.js']) inputs.set(path, await readFile(join(root, path)));
  await collect('src'); await collect('assets');
  for (const [path, bytes] of Object.entries(overrides)) {
    if (!inputs.has(path)) throw Error('Unknown overridden input: ' + path);
    inputs.set(path, Buffer.from(bytes));
  }
  const generator = await readFile(new URL('./prepare-build.mjs', import.meta.url));
  const inputDigest = [...inputs].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, bytes]) => [path, sha(bytes)]);
  const sourceRevision = 'sha256:' + sha(JSON.stringify([...inputDigest, ['generator', sha(generator)]]));
  let git = { commit: null, dirty: null };
  try {
    const committed = new Map(execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map(entry => {
      const [header, path] = entry.split('\t'); return [path, header.split(' ')[2]];
    }));
    const captured = [...inputs, ['scripts/prepare-build.mjs', generator]];
    const differsFromCommit = captured.some(([path, bytes]) => {
      const expected = committed.get(path);
      if (!expected) return true; // Includes ignored/generated runtime inputs.
      const blob = createHash(expected.length === 64 ? 'sha256' : 'sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
      return blob !== expected;
    });
    git = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      dirty: differsFromCommit || Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim()) || Object.keys(overrides).length > 0 };
  } catch { /* Exported source trees still have an immutable content revision. */ }
  const version = JSON.parse(inputs.get('version.json'));
  if (!/^\d+\.\d+\.\d+$/.test(version.version)) throw Error('version.json requires a numeric semantic version');
  const identity = { ...version, sourceRevision, git, prepared: true };
  delete identity.build;
  const build = sha(JSON.stringify(identity));
  const info = { ...identity, build };
  const prefix = 'builds/' + build + '/';
  const files = new Map();
  for (const [path, bytes] of inputs) if (!['sw.js', 'index.html', 'version.json', 'manifest.json', 'build-info.js'].includes(path)) files.set(prefix + path, bytes);
  files.set(prefix + 'build-info.js', Buffer.from('export const buildInfo = Object.freeze(' + JSON.stringify(info) + ');\nexport const deploymentRoot = new URL("../../", import.meta.url);\n'));
  const manifest = JSON.parse(inputs.get('manifest.json'));
  manifest.icons = manifest.icons.map(icon => ({ ...icon, src: prefix + icon.src }));
  files.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  files.set('version.json', Buffer.from(JSON.stringify(info, null, 2) + '\n'));
  let html = inputs.get('index.html').toString().replace('<head>', '<head>\n<base href="./' + prefix + '" />');
  html = html.replace('href="manifest.json"', 'href="../../manifest.json"').replace('href="#main"', 'href="../../index.html#main"');
  files.set('index.html', Buffer.from(html));
  const assets = Object.fromEntries([...files].map(([path, bytes]) => [path, sha(bytes)]));
  const worker = inputs.get('sw.js').toString().replace('/* BUILD_MANIFEST */ null', JSON.stringify({ info, assets }));
  if (worker === inputs.get('sw.js').toString()) throw Error('Missing worker generation marker');
  files.set('sw.js', Buffer.from(worker));
  await mkdir(out, { recursive: true });
  const entries = await readdir(out);
  if (entries.length && !entries.includes('.privatekara-release')) throw Error('Refusing to overwrite a non-release directory');
  await writeFile(join(out, '.privatekara-release'), 'PrivateKara prepared release\n');
  // Immutable resources first; mutable entry points last. Never remove old builds.
  for (const [path, bytes] of files) {
    const target = resolve(out, path);
    await mkdir(dirname(target), { recursive: true });
    if (path.startsWith('builds/')) {
      try { if (!(await readFile(target)).equals(bytes)) throw Error('Immutable build collision: ' + path); continue; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const temporary = target + '.tmp-' + process.pid;
    await writeFile(temporary, bytes); await rename(temporary, target);
  }
  return { info, prefix, assets, out };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await prepareBuild({ out: process.argv[2] ? resolve(process.argv[2]) : undefined });
  console.log(JSON.stringify({ directory: result.out, ...result.info }, null, 2));
}
