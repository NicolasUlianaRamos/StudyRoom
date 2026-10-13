import { useState } from 'react';
import type { Snapshot } from './shared';
import { Modal } from './components';
import { PdfReader } from './PdfReader';

export function Library({
  state,
  started,
}: {
  state: Snapshot;
  started: (state: Snapshot) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = state.pdfs.find((p) => p.id === openId);
  async function importPdf() {
    setBusy(true);
    setError('');
    try {
      await window.studyroom.command({ type: 'pdf:import' });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="eyebrow">SEUS MATERIAIS, AQUI</div>
      <h1>Biblioteca de PDFs</h1>
      <p className="lead">Importe uma cópia local e continue da última página.</p>
      {error && <p role="alert">{error}</p>}
      {selected ? (
        <>
          <button className="secondary" onClick={() => setOpenId(null)}>
            Voltar à biblioteca
          </button>
          <section className="card settings-card">
            <PdfReader key={selected.id} material={selected} state={state} started={started} />
          </section>
        </>
      ) : (
        <>
          <button className="primary" disabled={busy} onClick={() => void importPdf()}>
            {busy ? 'Importando…' : 'Importar PDF'}
          </button>
          <section className="card settings-card">
            {!state.pdfs.length && (
              <p>Seus materiais aparecerão aqui. Escolha um PDF do seu computador para começar.</p>
            )}
            {state.pdfs.map((pdf) => (
              <div className="site-row" key={pdf.id}>
                <div>
                  <strong>{pdf.name}</strong>
                  <small>
                    {(pdf.bytes / 1024 / 1024).toFixed(1)} MB ·{' '}
                    {pdf.pageCount
                      ? 'Página ' + pdf.page + ' de ' + pdf.pageCount
                      : 'Ainda não aberto'}
                  </small>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    setError('');
                    setOpenId(pdf.id);
                  }}
                >
                  Abrir PDF
                </button>
                <button
                  className="secondary"
                  disabled={state.active?.pdfId === pdf.id}
                  aria-label={'Remover ' + pdf.name}
                  onClick={() => setRemoveId(pdf.id)}
                >
                  Remover
                </button>
              </div>
            ))}
          </section>
          <p className="privacy">
            Até 100 PDFs, 50 MB por arquivo e 500 MB na biblioteca. A cópia fica neste computador e
            permite ler mesmo se o original for movido. Links, anexos e ações do PDF não são
            abertos. PDFs protegidos por senha e formulários interativos não são suportados nesta
            versão.
          </p>
        </>
      )}
      {removeId && (
        <Modal label="Remover PDF">
          <section className="modal">
            <h2>Remover este PDF?</h2>
            <p>
              A cópia da biblioteca será apagada. O arquivo original, as notas e o histórico de
              estudo serão preservados.
            </p>
            {error && <p role="alert">{error}</p>}
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await window.studyroom.command({ type: 'pdf:remove', id: removeId });
                  setRemoveId(null);
                  setError('');
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar remoção
            </button>
            <button className="secondary" disabled={busy} onClick={() => setRemoveId(null)}>
              Cancelar
            </button>
          </section>
        </Modal>
      )}
    </>
  );
}
