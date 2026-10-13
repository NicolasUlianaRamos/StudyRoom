import { open, mkdir, writeFile, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Store } from './database';
import type { PdfMaterial } from '../src/shared';
import { noteId } from './notes';

const MAX_BYTES = 50 * 1024 * 1024;
export async function readPdf(path: string) {
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 5 || stat.size > MAX_BYTES)
      throw new Error('Escolha um PDF de até 50 MB.');
    const buffer = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset !== stat.size)
      throw new Error('O arquivo mudou durante a leitura. Tente novamente.');
    const data = buffer.subarray(0, offset);
    if (data.subarray(0, 5).toString('ascii') !== '%PDF-')
      throw new Error('O arquivo escolhido não tem um cabeçalho PDF válido.');
    return data;
  } finally {
    await file.close();
  }
}

export class Pdfs {
  constructor(
    private store: Store,
    private directory: string,
  ) {}
  list(): PdfMaterial[] {
    return this.store.db
      .prepare(
        'SELECT id,name,bytes,importedAt,page,pageCount FROM pdfs ORDER BY importedAt DESC,id',
      )
      .all()
      .map((r) => ({
        id: String(r.id),
        name: String(r.name),
        bytes: Number(r.bytes),
        importedAt: Number(r.importedAt),
        page: Number(r.page),
        pageCount: Number(r.pageCount),
      }));
  }
  get(id: string) {
    const pdf = this.list().find((p) => p.id === noteId(id));
    if (!pdf) throw new Error('PDF não encontrado na biblioteca.');
    return pdf;
  }
  async import(path: string) {
    const data = await readPdf(path);
    const hash = createHash('sha256').update(data).digest('hex');
    if (this.store.db.prepare('SELECT id FROM pdfs WHERE hash=?').get(hash)) return;
    const items = this.list();
    if (
      items.length >= 100 ||
      items.reduce((sum, p) => sum + p.bytes, data.length) > 500 * 1024 * 1024
    )
      throw new Error(
        'Limite da biblioteca: 100 PDFs ou 500 MB. Remova materiais que não precisa mais.',
      );
    await mkdir(this.directory, { recursive: true });
    const id = randomUUID();
    const target = join(this.directory, id + '.pdf');
    await writeFile(target, data, { flag: 'wx' });
    try {
      const name =
        basename(path)
          .replace(/[\x00-\x1f]/g, '')
          .slice(0, 160) || 'Material.pdf';
      this.store.db
        .prepare('INSERT INTO pdfs(id,name,hash,bytes,importedAt) VALUES(?,?,?,?,?)')
        .run(id, name, hash, data.length, Date.now());
    } catch (e) {
      await unlink(target).catch(() => {});
      throw e;
    }
  }
  async data(id: string) {
    this.get(id);
    try {
      return await readPdf(join(this.directory, noteId(id) + '.pdf'));
    } catch {
      throw new Error(
        'Não foi possível ler a cópia local. Remova este item e importe o PDF novamente.',
      );
    }
  }
  progress(id: string, page: number, pageCount: number) {
    this.get(id);
    if (
      !Number.isInteger(page) ||
      !Number.isInteger(pageCount) ||
      page < 1 ||
      page > pageCount ||
      pageCount > 10000
    )
      throw new Error('Página inválida. O leitor suporta até 10 mil páginas.');
    this.store.db.prepare('UPDATE pdfs SET page=?,pageCount=? WHERE id=?').run(page, pageCount, id);
  }
  async remove(id: string) {
    this.get(id);
    try {
      await unlink(join(this.directory, noteId(id) + '.pdf'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('Não foi possível remover a cópia local.');
    }
    this.store.db.prepare('DELETE FROM pdfs WHERE id=?').run(id);
  }
}
