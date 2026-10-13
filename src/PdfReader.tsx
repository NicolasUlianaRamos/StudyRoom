import { useEffect, useRef, useState } from 'react';
import { getDocument, PDFWorker, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfMaterial, Snapshot } from './shared';

export function PdfReader({
  material,
  state,
  started,
}: {
  material: PdfMaterial;
  state: Snapshot;
  started?: (state: Snapshot) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(material.page);
  const [zoom, setZoom] = useState(1);
  const [minutes, setMinutes] = useState(25);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(200, entries[0].contentRect.width - 32)),
    );
    if (area.current) observer.observe(area.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let canceled = false;
    const native = new Worker(workerUrl, { type: 'module' });
    const worker = PDFWorker.create({ port: native });
    let task: ReturnType<typeof getDocument> | undefined;
    setError('');
    setDoc(null);
    setReady(false);
    void (async () => {
      try {
        const data = await window.studyroom.pdfData(material.id);
        if (canceled) return;
        const root = new URL('./pdfjs/', window.location.href).href;
        task = getDocument({
          data: new Uint8Array(data),
          worker,
          cMapUrl: root + 'cmaps/',
          cMapPacked: true,
          standardFontDataUrl: root + 'standard_fonts/',
          wasmUrl: root + 'wasm/',
          iccUrl: root + 'iccs/',
          enableXfa: false,
          maxImageSize: 25000000,
          canvasMaxAreaInBytes: 64 * 1024 * 1024,
        });
        const loaded = await task.promise;
        if (loaded.numPages > 10000) throw new Error('O leitor suporta até 10 mil páginas.');
        if (!canceled) {
          setPage(Math.min(material.page, loaded.numPages));
          setDoc(loaded);
        }
      } catch (e) {
        if (!canceled) {
          const name = e instanceof Error ? e.name : '';
          setError(
            name === 'PasswordException'
              ? 'Este PDF exige senha. Importe uma cópia desbloqueada para ler nesta versão.'
              : 'Não foi possível abrir este PDF. Confira se o arquivo é válido e importe novamente.',
          );
          if (state.active?.pdfId === material.id) void window.studyroom.command({ type: 'pause' });
        }
      }
    })();
    return () => {
      canceled = true;
      void task?.destroy().catch(() => {});
      worker.destroy();
      native.terminate();
    };
  }, [material.id]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let canceled = false;
    let task: RenderTask | undefined;
    setReady(false);
    setText('');
    void (async () => {
      try {
        const pdfPage = await doc.getPage(page);
        if (canceled || !canvas.current) return;
        const original = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(3, width / original.width) * zoom;
        const viewport = pdfPage.getViewport({ scale });
        const output = Math.min(2, window.devicePixelRatio || 1);
        const target = canvas.current;
        // Bound bitmap allocation even for PDFs with extreme page dimensions.
        if (viewport.width * viewport.height * output * output > 16000000)
          throw new Error('Página muito grande para renderizar. Reduza o zoom.');
        target.width = Math.ceil(viewport.width * output);
        target.height = Math.ceil(viewport.height * output);
        target.style.width = viewport.width + 'px';
        target.style.height = viewport.height + 'px';
        task = pdfPage.render({
          canvas: target,
          viewport,
          transform: output === 1 ? undefined : [output, 0, 0, output, 0, 0],
        });
        await task.promise;
        const content = await pdfPage.getTextContent();
        if (!canceled) {
          setText(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
          setReady(true);
          setError('');
          await window.studyroom.command({
            type: 'pdf:progress',
            id: material.id,
            page,
            pageCount: doc.numPages,
          });
        }
      } catch (e) {
        if (!canceled)
          setError(e instanceof Error ? e.message : 'Não foi possível renderizar a página.');
      }
    })();
    return () => {
      canceled = true;
      task?.cancel();
    };
  }, [doc, page, zoom, width]);
  return (
    <div className="pdf-reader">
      <div className="pdf-toolbar">
        <strong>{material.name}</strong>
        <button
          className="secondary"
          disabled={!doc || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Página anterior
        </button>
        <label>
          Página do PDF
          <input
            aria-label="Página do PDF"
            type="number"
            min={1}
            max={doc?.numPages ?? 1}
            value={page}
            disabled={!doc}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (doc && Number.isInteger(n) && n >= 1 && n <= doc.numPages) setPage(n);
            }}
          />
        </label>
        <span>de {doc?.numPages ?? '…'}</span>
        <button
          className="secondary"
          disabled={!doc || page >= doc.numPages}
          onClick={() => setPage(page + 1)}
        >
          Próxima página
        </button>
        <select
          aria-label="Zoom do PDF"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        >
          {[0.75, 1, 1.25, 1.5, 2].map((z) => (
            <option key={z} value={z}>
              {z === 1 ? 'Ajustar à largura' : Math.round(z * 100) + '%'}
            </option>
          ))}
        </select>
      </div>
      {started && (
        <form
          className="custom-time"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              started(
                await window.studyroom.command({ type: 'pdf:start', id: material.id, minutes }),
              );
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          <label htmlFor="pdf-minutes">Tempo de estudo</label>
          <input
            id="pdf-minutes"
            type="number"
            min={1}
            max={480}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            required
          />
          <span>minutos</span>
          <button className="primary" disabled={!ready || !!state.active}>
            Estudar este PDF
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {!doc && !error && <p role="status">Abrindo PDF local…</p>}
      <div className="pdf-canvas-area" ref={area}>
        <canvas ref={canvas} aria-label={'Página ' + page + ' de ' + material.name} />
      </div>
      {ready && (
        <details className="pdf-text">
          <summary>Texto da página</summary>
          <p>
            {text || 'Esta página não contém texto selecionável. Pode ser uma imagem digitalizada.'}
          </p>
        </details>
      )}
      <span className="sr-only" role="status">
        {ready ? 'Página carregada' : ''}
      </span>
    </div>
  );
}
