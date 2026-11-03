'use strict';

/* Draws the day as the printed Tamil sales sheet (A4) and turns it into PNG / PDF.
   Uses calc(), EXPENSES, NOTES, num() and state from app.js. */

const SHEET_W = 1654, SHEET_H = 2339;        // A4 at 200 dpi
const MM = SHEET_W / 210;                    // pixels per millimetre
const INK = '#111111', PEN = '#1d3f8f', RULE = '#333333';
const TA_DAYS = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];

async function drawSheet(day) {
  await Promise.all([
    document.fonts.load(`40px 'Noto Sans Tamil'`, 'தமிழ்'),
    document.fonts.load(`40px 'Manrope'`, '0123'),
    document.fonts.load(`bold 40px 'Manrope'`, '0123'),
  ]).catch(() => {});

  const c = calc(day);
  const info = day.info || {};
  const cv = document.createElement('canvas');
  cv.width = SHEET_W; cv.height = SHEET_H;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, SHEET_W, SHEET_H);
  g.textBaseline = 'middle';

  const font = (size, bold) => `${bold ? '700' : '500'} ${size * MM}px 'Manrope', 'Noto Sans Tamil', sans-serif`;
  const text = (s, x, y, o = {}) => {
    g.font = font(o.size || 3.6, o.bold);
    g.fillStyle = o.color || INK;
    g.textAlign = o.align || 'left';
    g.fillText(String(s), x * MM, y * MM);
  };
  const width = (s, size = 3.6, bold) => { g.font = font(size, bold); return g.measureText(String(s)).width / MM; };
  const line = (x1, y1, x2, y2, w = 0.3) => {
    g.strokeStyle = RULE; g.lineWidth = w * MM;
    g.beginPath(); g.moveTo(x1 * MM, y1 * MM); g.lineTo(x2 * MM, y2 * MM); g.stroke();
  };
  const n = v => (v ? Number(v).toLocaleString('en-IN') : '');
  const pen = (s, x, y, align = 'right', size = 3.8) => s !== '' && text(s, x, y, { color: PEN, bold: true, align, size });

  // Title
  text('பசுபதி பேக்கரி', 105, 13, { size: 5.2, bold: true, align: 'center' });

  // Header fields with underlines
  const field = (label, value, x, y, end) => {
    text(label, x, y);
    const vx = x + width(label) + 2;
    line(vx, y + 2.2, end, y + 2.2, 0.2);
    if (value) text(value, vx + 1, y, { color: PEN, bold: true, size: 3.8 });
  };
  const [yy, mm, dd] = day.date.split('-');
  const dow = TA_DAYS[new Date(day.date + 'T00:00').getDay()];
  const hours = (() => {
    if (!info.start || !info.end) return '';
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    let d = toMin(info.end) - toMin(info.start);
    if (d < 0) d += 24 * 60;
    return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')} மணி`;
  })();
  const run = info.startKm && info.endKm ? Math.max(0, num(info.endKm) - num(info.startKm)) : '';
  const t12 = t => {
    if (!t) return '';
    let [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  };

  field('பெயர் :', info.name || '', 14, 24, 110);
  field('தேதி :', `${dd}-${mm}-${yy}`, 118, 24, 196);
  field('ஊர் :', info.town || '', 14, 31.5, 110);
  field('கிழமை :', dow, 118, 31.5, 196);
  field('புறப்பட்ட நேரம்', t12(info.start), 14, 39, 70);
  field('வந்து சேர்ந்த நேரம்', t12(info.end), 73, 39, 136);
  field('வியாபார நேரம்', hours, 139, 39, 196);
  field('வாகன ஆரம்ப கி.மீ', n(info.startKm), 14, 46.5, 70);
  field('வாகன முடிவு கி.மீ', n(info.endKm), 73, 46.5, 136);
  field('வாகன ஓடிய கி.மீ', run === '' ? '' : n(run) || '0', 139, 46.5, 196);

  // Item table
  const X = [12, 22, 74, 94, 114, 134, 152, 178, 198];   // column edges
  const top = 54, headH = 12, rowH = 7.5, ROWS = 13;
  const tableBottom = top + headH + ROWS * rowH;
  const heads = [['வ.', 'எண்'], ['எடுத்த சரக்கின் பெயர்'], ['வ.', 'இருப்பு'], ['எடுத்தது'], ['மொத்தம்'], ['ரிட்டன்'], ['விற்பனை', 'விலை'], ['ரூபாய்']];
  heads.forEach((h, i) => h.forEach((s, j) => text(s, X[i] + 1.5, top + 3.5 + j * 4.6, { size: 3.3 })));

  for (let i = 0; i < ROWS; i++) {
    const y = top + headH + i * rowH + rowH / 2;
    text(i + 1, X[0] + 1.5, y, { size: 3.4 });
    const r = c.rows[i];
    if (!r) continue;
    text(r.it.ta, X[1] + 1.5, y, { size: 3.4 });
    text(`X ${r.it.price}`, X[7] - 1.5, y, { size: 3.6, align: 'right' });
    if (!r.total && !r.sold) continue;
    pen(n(r.open) || '0', X[3] - 2, y);
    pen(n(r.taken) || '0', X[4] - 2, y);
    pen(n(r.total) || '0', X[5] - 2, y);
    pen(n(r.closing) || '0', X[6] - 2, y);
    pen(n(r.sold) || '0', X[6] + 2, y, 'left');
    pen(n(r.amount) || '0', X[8] - 2, y);
  }

  // Bottom block: cash count (left), expenses (middle), balance chain (right)
  const B = 12, bTop = tableBottom, bBottom = bTop + B * rowH;
  const rowY = i => bTop + i * rowH + rowH / 2;

  // Right-hand chain, exactly as on the paper.
  let bal = c.sales;
  const chain = [['மொத்தம்', c.sales]];
  const step = (label, amount, sign) => { chain.push([label, amount]); bal += sign * amount; chain.push(['மீதம்', bal]); };
  step('செலவு', c.expenses, -1);
  step('தள்ளுபடி', c.discount, -1);
  step('டேமேஜ்', c.damage, -1);
  step('வா.பற்று', c.creditGiven, -1);
  step('வா.வரவு', c.creditRecv, +1);
  chain.push(['ரொக்கம்', c.expected]);   // 12 rows: மொத்தம் + 5 × (item, மீதம்) + ரொக்கம்
  chain.forEach(([label, v], i) => {
    text(label, X[7] - 2, rowY(i), { align: 'right', size: 3.5 });
    pen(v || v === 0 ? (v < 0 ? '-' : '') + Math.abs(v).toLocaleString('en-IN') : '', X[8] - 2, rowY(i));
  });

  // Left: Phone Pay and notes
  const cash = day.cash || {};
  text('Phone Pay', X[1] + 1.5, rowY(1), { size: 3.6 });
  pen(n(c.upiCount), X[2] - 2, rowY(1));
  NOTES.forEach((note, i) => {
    const y = rowY(2 + i);
    text(`${note}X`, X[1] + 1.5, y, { size: 3.6 });
    const cnt = num(cash[note]);
    if (cnt) {
      pen(cnt, X[1] + 15, y, 'left');
      pen(`= ${(note * cnt).toLocaleString('en-IN')}`, X[2] - 2, y);
    }
  });
  text('சில்லரை', X[1] + 1.5, rowY(9), { size: 3.5 });
  pen(n(cash.coins), X[2] - 2, rowY(9));
  text('மொத்தம்', X[1] + 1.5, bTop + 11 * rowH, { size: 3.6, bold: true });   // merged rows 11–12
  if (c.counting) pen(c.counted.toLocaleString('en-IN'), X[2] - 2, bTop + 11 * rowH);

  // Middle: expenses
  text('செலவுகள்', X[2] + 1.5, rowY(4), { size: 3.5, bold: true });
  EXPENSES.forEach((e, i) => {
    const y = rowY(5 + i);
    text(e.ta, X[2] + 1.5, y, { size: 3.5 });
    text('-', 128, y, { size: 3.5 });
    pen(n(day.exp[e.id]), 148, y);
  });
  text('மொத்தம்', X[2] + 1.5, rowY(11), { size: 3.5, bold: true });
  text('-', 128, rowY(11), { size: 3.5 });
  pen(n(c.expenses) || '0', 148, rowY(11));

  // Grid lines
  line(X[0], top, X[8], top, 0.4);
  line(X[0], top + headH, X[8], top + headH);
  for (let i = 1; i <= ROWS; i++) line(X[0], top + headH + i * rowH, X[8], top + headH + i * rowH);
  X.forEach((x, i) => line(x, top, x, tableBottom, i === 0 || i === X.length - 1 ? 0.4 : 0.3));
  for (let i = 1; i <= B; i++) {
    const y = bTop + i * rowH;
    if (i === 11) { line(X[2], y, X[8], y); line(X[0], y, X[1], y); continue; }  // merged மொத்தம் cell on the left
    line(X[0], y, X[8], y, i === B ? 0.4 : 0.3);
  }
  [X[0], X[1], X[2], X[7], X[8]].forEach((x, i) => line(x, bTop, x, bBottom, i === 0 || i === 4 ? 0.4 : 0.3));

  // Result below the sheet
  const ry = bBottom + 9;
  if (c.counting) {
    const msg = c.diff > 0 ? `குறைவு / Short ₹${c.diff.toLocaleString('en-IN')}`
              : c.diff < 0 ? `அதிகம் / Excess ₹${(-c.diff).toLocaleString('en-IN')}` : 'சரி / Balanced';
    text(`ரொக்கம் ₹${c.expected.toLocaleString('en-IN')}  ·  எண்ணியது ₹${c.counted.toLocaleString('en-IN')}  ·  ${msg}`, 105, ry,
      { align: 'center', bold: true, size: 3.8, color: c.diff > 0 ? '#b91c1c' : c.diff < 0 ? '#15803d' : INK });
  }
  const credits = day.deliveries.filter(d => d.total > paid(d));
  if (credits.length) {
    text('பாக்கி: ' + credits.map(d => `${d.customer} ₹${(d.total - paid(d)).toLocaleString('en-IN')}`).join(', '), 14, ry + 7, { size: 3.2 });
  }
  text('Pasupathi Bakery · Van Sales', 105, 290, { align: 'center', size: 2.6, color: '#888888' });

  return cv;
}

// Minimal single-page A4 PDF with the sheet as a JPEG image.
function sheetPdf(canvas) {
  const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
  const bin = atob(b64);
  const jpg = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);

  const enc = new TextEncoder();
  const parts = [], offsets = [];
  let len = 0;
  const push = p => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); len += b.length; };
  const obj = (id, body) => { offsets[id] = len; push(`${id} 0 obj\n${body}\nendobj\n`); };

  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
  const content = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
  obj(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  offsets[5] = len;
  push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
  push(jpg);
  push('\nendstream\nendobj\n');
  const xref = len;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(`${x}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
