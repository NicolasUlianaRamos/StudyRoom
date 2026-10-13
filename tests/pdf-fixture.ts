// A small, deterministic PDF fixture with two pages and a JavaScript action that must never run.
export function pdfFixture() {
  const texts = ['PDF pagina 1 - Estudos locais', 'PDF pagina 2 - Revisao'];
  const streams = texts.map(
    (text, i) =>
      `0.2 0.5 0.3 rg 30 210 ${180 + i * 30} 40 re f\nBT /F1 16 Tf 30 160 Td (${text}) Tj ET`,
  );
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /OpenAction 8 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 280] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 280] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...streams.map((s) => `<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}\nendstream`),
    '<< /S /JavaScript /JS (globalThis.pdfScriptRan = true;) >>',
  ];
  let body = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, '0') + ' 00000 n \n')
      .join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
