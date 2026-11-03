import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const eventIds = ['ranni-joga-v-parku', 'pilates-stred-tela', 'workshop-dech-a-uvolneni', 'jarni-vikend-v-prirode', 'den-pohybu'];
const paths = ['/', '/admin', ...eventIds.flatMap(id => [`/akce/${id}`, `/rezervace/${id}`])];
async function prepare() {
  await mkdir('.output/pages-public', { recursive: true });
  await cp('public', '.output/pages-public', { recursive: true });
  for (const name of ['dve-logo.png', 'dve-symbol.png', 'zakladatelky-o-nas.jpg', 'zakladatelky-trava.jpg']) {
    const pointer = JSON.parse(await readFile(`src/assets/${name}.asset.json`, 'utf8'));
    const response = await fetch(new URL(pointer.url, 'https://id-preview--3f8d2e8b-6dd0-466f-ac03-a50ce0aa1898.lovable.app'));
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Fotografii ${name} nelze stáhnout (${response.status}).`);
    const destination = resolve('.output/pages-public', `.${pointer.url}`);
    await mkdir(resolve(destination, '..'), { recursive: true });
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  }
}
async function finalize() {
  const output = resolve('dist/client');
  const shell = resolve(output, '_shell.html');
  await access(shell);
  const html = await readFile(shell, 'utf8');
  if (!html.includes('<html') || !html.includes('<script')) throw new Error('Statická stránka není kompletní.');
  for (const path of paths) {
    const destination = resolve(output, `.${path}`, 'index.html');
    await mkdir(resolve(destination, '..'), { recursive: true });
    await cp(shell, destination);
  }
  await cp(shell, resolve(output, '404.html'));
  await writeFile(resolve(output, '.nojekyll'), '');
  console.log(`GitHub Pages: připraveno ${paths.length} stránek a 404.html v dist/client.`);
}
if (process.argv[2] === 'prepare') await prepare();
if (process.argv[2] === 'finalize') await finalize();
