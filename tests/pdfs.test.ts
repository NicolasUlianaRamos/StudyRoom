import { it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, unlink, open } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../electron/database';
import { Pdfs, readPdf } from '../electron/pdfs';
import { pdfFixture } from './pdf-fixture';

it('copia somente PDFs escolhidos, deduplica, persiste página e remove apenas a cópia', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studyroom-pdf-'));
  const store = new Store(join(directory, 'db.sqlite'));
  try {
    const source = join(directory, 'Estudos.pdf');
    const bytes = pdfFixture();
    await writeFile(source, bytes);
    const library = new Pdfs(store, join(directory, 'copies'));
    await library.import(source);
    await library.import(source);
    expect(library.list()).toHaveLength(1);
    const pdf = library.list()[0];
    expect(await library.data(pdf.id)).toEqual(bytes);
    library.progress(pdf.id, 2, 2);
    expect(new Pdfs(store, join(directory, 'copies')).get(pdf.id)).toMatchObject({
      page: 2,
      pageCount: 2,
    });
    expect(() => library.progress(pdf.id, 3, 2)).toThrow();
    expect(() => library.progress(pdf.id, 1, 10001)).toThrow();
    await expect(library.data('../arquivo')).rejects.toThrow();
    expect(() => library.get('00000000-0000-4000-8000-000000000000')).toThrow('não encontrado');
    await library.remove(pdf.id);
    expect(library.list()).toEqual([]);
    expect(await readFile(source)).toEqual(bytes);
    await library.import(source);
    const imported = library.list()[0];
    await unlink(source);
    expect(await library.data(imported.id)).toEqual(bytes);
    await unlink(join(directory, 'copies', imported.id + '.pdf'));
    await expect(library.data(imported.id)).rejects.toThrow('cópia local');
    await library.remove(imported.id);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('rejeita cabeçalhos e tamanho inválidos sem copiar conteúdo', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studyroom-pdf-limits-'));
  const store = new Store(':memory:');
  try {
    const source = join(directory, 'falso.pdf');
    await writeFile(source, 'Arquivo de texto');
    const library = new Pdfs(store, join(directory, 'copies'));
    await expect(library.import(source)).rejects.toThrow('cabeçalho');
    const large = await open(source, 'w');
    await large.truncate(50 * 1024 * 1024 + 1);
    await large.close();
    await expect(readPdf(source)).rejects.toThrow('50 MB');
    expect(library.list()).toEqual([]);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
