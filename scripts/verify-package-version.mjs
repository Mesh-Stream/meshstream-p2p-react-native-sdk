import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageVersion = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
const sourceVersion = readFileSync(resolve(root, 'src/version.ts'), 'utf8')
  .match(/MESHSTREAM_REACT_NATIVE_VERSION\s*=\s*'([^']+)'/)?.[1];
const podVersion = readFileSync(resolve(root, 'MeshStreamP2P.podspec'), 'utf8')
  .match(/s\.version\s*=\s*'([^']+)'/)?.[1];

if (sourceVersion !== packageVersion || podVersion !== packageVersion) {
  throw new Error(
    `Release version mismatch: package.json=${packageVersion}, src/version.ts=${sourceVersion ?? 'missing'}, podspec=${podVersion ?? 'missing'}.`,
  );
}

console.log(`Release version ${packageVersion} is consistent.`);
