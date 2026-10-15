import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
const files = (await readdir('release'))
  .filter((name) => /\.(exe|dmg|deb|AppImage)$/.test(name))
  .sort();
if (!files.length) throw new Error('Nenhum instalador gerado');
const lines = await Promise.all(
  files.map(
    async (name) =>
      createHash('sha256')
        .update(await readFile('release/' + name))
        .digest('hex') +
      '  ' +
      name,
  ),
);
await writeFile('release/SHA256SUMS.txt', lines.join('\n') + '\n');
