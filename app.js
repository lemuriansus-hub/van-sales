'use strict';

/* ---------- data ---------- */

const KEY = 'pasupathi-van-v1';

const DEFAULT_ITEMS = [
  { id: 'ooty',     ta: 'ஊட்டி வரிக்கி',   en: 'Ooty Varkey',   price: 50 },
  { id: 'varki',    ta: 'வரிக்கி',          en: 'Varkey',        price: 240 },
  { id: 'thattu',   ta: 'தட்டு வரிக்கி',    en: 'Thattu Varkey', price: 200 },
  { id: 'spl',      ta: 'SPL',              en: 'Special',       price: 100 },
  { id: 'bun',      ta: 'பன்',              en: 'Bun',           price: 50 },
  { id: 'mittai2',  ta: 'கடலை மிட்டாய் ₹2', en: 'Peanut Candy ₹2', price: 120 },
  { id: 'urundai2', ta: 'கடலை உருண்டை ₹2',  en: 'Peanut Ball ₹2',  price: 75 },
  { id: 'mittai5',  ta: 'கடலை மிட்டாய் ₹5', en: 'Peanut Candy ₹5', price: 160 },
  { id: 'salt',     ta: 'சால்ட் பிஸ்கட்',  en: 'Salt Biscuit',  price: 100 },
  { id: 'chips',    ta: 'சிப்ஸ்',           en: 'Chips',         price: 40 },
];

// Same order as the printed sheet.
const EXPENSES = [
  { id: 'rent',     ta: 'வாடகை',    en: 'Rent' },
  { id: 'poopathi', ta: 'பூபத்தி',   en: 'Poopathi' },
  { id: 'petrol',   ta: 'பெட்ரோல்', en: 'Petrol' },
  { id: 'diesel',   ta: 'டீசல்',    en: 'Diesel' },
  { id: 'batta',    ta: 'பேட்டா',   en: 'Batta' },
  { id: 'magamai',  ta: 'மகமை',     en: 'Magamai' },
];

const NOTES = [500, 200, 100, 50, 20, 10, 5];

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const newDay = (date, open = {}, info = {}) => ({
  date, open, taken: {}, deliveries: [], received: [],
  exp: {}, discount: 0, damage: 0, cash: {}, upiCount: null, info,
});

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.current) {
      // v2: new item list and prices replace the first preloaded list.
      if (s.itemsVer !== 2) { s.items = DEFAULT_ITEMS.map(i => ({ ...i })); s.itemsVer = 2; }
      return s;
    }
  } catch (e) { /* storage blocked or corrupt: start fresh */ }
  return { items: DEFAULT_ITEMS.map(i => ({ ...i })), itemsVer: 2, current: newDay(today()), history: [] };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('சேமிக்க முடியவில்லை / Could not save'); }
}

/* ---------- helpers ---------- */

const $ = s => document.querySelector(s);
const num = v => Math.max(0, Math.round(Number(v) || 0));
const rs = n => (n < 0 ? '-₹' : '₹') + Math.abs(n || 0).toLocaleString('en-IN');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = arr => arr.reduce((a, b) => a + b, 0);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' });
const itemName = id => (state.items.find(i => i.id === id) || { ta: id }).ta;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- calculations (same as the paper sheet) ---------- */

function paid(d) { return num(d.cash) + num(d.upi); }

function calc(day) {
  const rows = state.items.map(it => {
    const open = num(day.open[it.id]);
    const taken = num(day.taken[it.id]);
    const total = open + taken;
    let sold = 0, amount = 0;
    for (const d of day.deliveries) for (const l of d.lines) {
      if (l.id === it.id) { sold += l.qty; amount += l.qty * l.price; }
    }
    return { it, open, taken, total, sold, closing: total - sold, amount };
  });
  const sales = sum(rows.map(r => r.amount));
  const dTotals = day.deliveries.map(d => ({ total: d.total, paid: paid(d) }));
  const creditGiven = sum(dTotals.map(x => Math.max(0, x.total - x.paid)));            // வா.பற்று
  const creditRecv = sum(dTotals.map(x => Math.max(0, x.paid - x.total)))
                   + sum(day.received.map(r => num(r.amount)));                         // வா.வரவு
  const expenses = sum(EXPENSES.map(e => num(day.exp[e.id])));
  const discount = num(day.discount), damage = num(day.damage);
  const expected = sales - expenses - discount - damage - creditGiven + creditRecv;    // ரொக்கம்
  const cashRecv = sum(day.deliveries.map(d => num(d.cash))) + sum(day.received.filter(r => r.mode !== 'upi').map(r => num(r.amount)));
  const upiRecv = sum(day.deliveries.map(d => num(d.upi))) + sum(day.received.filter(r => r.mode === 'upi').map(r => num(r.amount)));
  const notes = sum(NOTES.map(n => n * num(day.cash[n])));
  const upiCount = day.upiCount == null ? upiRecv : num(day.upiCount);
  const counted = notes + num(day.cash.coins) + upiCount;
  const counting = notes + num(day.cash.coins) > 0;
  return { rows, sales, creditGiven, creditRecv, expenses, discount, damage, expected,
           cashRecv, upiRecv, notes, upiCount, counted, counting, diff: expected - counted };
}

// Pending balance per customer across every day.
function customerDues() {
  const dues = {};
  for (const day of [...state.history, state.current]) {
    for (const d of day.deliveries) dues[d.customer] = (dues[d.customer] || 0) + d.total - paid(d);
    for (const r of day.received) dues[r.customer] = (dues[r.customer] || 0) - num(r.amount);
  }
  return dues;
}

function customerNames() {
  return Object.keys(customerDues()).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/* ---------- screens ---------- */

let tab = 'stock';
let draft = blankDraft();
const S = () => state.current;

function blankDraft() { return { editId: null, customer: '', qty: {}, cash: '', upi: '', cashTouched: false }; }

function render() {
  $('#topDate').textContent = fmtDate(S().date);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('#view').innerHTML = VIEWS[tab]();
  refresh();
  if (tab === 'more') showPreview('cur', 'sheetPreview');
}

// Update only computed text, so typing never loses focus.
function refresh() {
  const out = OUTPUTS[tab] ? OUTPUTS[tab]() : {};
  document.querySelectorAll('[data-o]').forEach(el => {
    const v = out[el.dataset.o];
    if (v !== undefined) el.innerHTML = v;
  });
  document.querySelectorAll('[data-cls]').forEach(el => {
    const v = out[el.dataset.cls];
    if (v !== undefined) el.className = v;
  });
  document.querySelectorAll('[data-dis]').forEach(el => {
    const v = out[el.dataset.dis];
    if (v !== undefined) el.disabled = v;
  });
}

const VIEWS = {};
const OUTPUTS = {};

/* Stock */
const INFO = [
  { id: 'name',    ta: 'பெயர்',              en: 'Name',        type: 'text' },
  { id: 'town',    ta: 'ஊர்',                en: 'Town',        type: 'text' },
  { id: 'start',   ta: 'புறப்பட்ட நேரம்',    en: 'Start time',  type: 'time' },
  { id: 'end',     ta: 'வந்து சேர்ந்த நேரம்', en: 'Return time', type: 'time' },
  { id: 'startKm', ta: 'வாகன ஆரம்ப கி.மீ',   en: 'Start km',    type: 'num' },
  { id: 'endKm',   ta: 'வாகன முடிவு கி.மீ',  en: 'End km',      type: 'num' },
];

VIEWS.stock = () => {
  const info = S().info || {};
  return `
  <div class="card">
    <div class="row"><label class="grow">தேதி <span class="en">Date</span></label>
    <input type="date" style="width:auto" data-f="date" value="${S().date}"></div>
    <details style="margin-top:8px">
      <summary class="link">தாள் விவரம் <span class="en">Sheet details (name, town, time, km)</span></summary>
      ${INFO.map(f => `<div class="row"><label class="grow">${f.ta} <span class="en">${f.en}</span></label>
        <input style="width:150px" ${f.type === 'time' ? 'type="time"' : f.type === 'num' ? 'inputmode="numeric"' : ''}
          data-f="info" data-id="${f.id}" value="${esc(info[f.id] || '')}"></div>`).join('')}
    </details>
  </div>
  <h2>வண்டியில் இருப்பு <small>Stock in van</small></h2>
  <div class="card">
    <table class="tbl">
      <thead><tr><th>பொருள்<br>Item</th><th>வ.இருப்பு<br>Opening</th><th>எடுத்தது<br>Taken</th><th>மொத்தம்<br>Total</th></tr></thead>
      <tbody>${state.items.map(it => `
        <tr><td>${esc(it.ta)}</td>
        <td><input class="n" inputmode="numeric" data-f="open" data-id="${it.id}" value="${S().open[it.id] || ''}" placeholder="0" ${S().lockOpen ? 'disabled' : ''}></td>
        <td><input class="n" inputmode="numeric" data-f="taken" data-id="${it.id}" value="${S().taken[it.id] || ''}" placeholder="0" ${S().lockTaken ? 'disabled' : ''}></td>
        <td data-o="t_${it.id}"></td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td>மொத்தம்</td><td data-o="openSum"></td><td data-o="takenSum"></td><td data-o="totalSum"></td></tr></tfoot>
    </table>
    ${lockButton('Open', 'வ.இருப்பு', 'Opening stock')}
    ${lockButton('Taken', 'எடுத்தது', 'Taken')}
  </div>
  <div class="muted" style="margin:-4px 0 10px">வ.இருப்பு = நேற்றைய ரிட்டன் (தானாக வரும்) / Opening = yesterday's return (filled automatically)</div>
  <button class="btn wide" data-go="deliver">விநியோகம் தொடங்கு / Start delivery →</button>`;
};

function lockButton(part, ta, en) {
  return S()['lock' + part]
    ? `<div class="row" style="margin-top:10px"><span class="grow">🔒 ${ta} உறுதி செய்யப்பட்டது <span class="en">${en} locked</span></span>
        <button class="btn ghost" data-unlock="${part}">திற / Unlock</button></div>`
    : `<button class="btn wide" style="margin-top:10px" data-lock="${part}">✔ ${ta} உறுதி செய் / Confirm ${en.toLowerCase()}</button>`;
}

const pin = () => state.pin || '1234';

OUTPUTS.stock = () => {
  const c = calc(S()), o = {};
  c.rows.forEach(r => o['t_' + r.it.id] = `<b>${r.total}</b>`);
  o.openSum = sum(c.rows.map(r => r.open));
  o.takenSum = sum(c.rows.map(r => r.taken));
  o.totalSum = sum(c.rows.map(r => r.total));
  return o;
};

/* Deliver */
function available(id) {
  const r = calc(S()).rows.find(r => r.it.id === id);
  let back = 0;
  if (draft.editId) {
    const d = S().deliveries.find(d => d.id === draft.editId);
    if (d) back = sum(d.lines.filter(l => l.id === id).map(l => l.qty));
  }
  return r ? r.closing + back : 0;
}

function draftTotal() {
  return sum(state.items.map(it => num(draft.qty[it.id]) * it.price));
}

VIEWS.deliver = () => {
  const names = customerNames();
  return `
  <h2>${draft.editId ? 'திருத்து / Edit delivery' : 'புதிய விநியோகம் / New delivery'}</h2>
  <div class="card">
    <label>வாடிக்கையாளர் <span class="en">Customer name</span></label>
    <input data-f="customer" list="custList" value="${esc(draft.customer)}" placeholder="கடை பெயர் / Shop name" autocomplete="off">
    <datalist id="custList">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="muted" data-o="oldDue" style="margin-top:6px"></div>
  </div>
  <div class="card">
    ${state.items.filter(it => available(it.id) > 0 || num(draft.qty[it.id])).map(it => `
      <div class="pick">
        <div class="name"><b>${esc(it.ta)}</b><span class="muted">${rs(it.price)} · <span data-o="av_${it.id}"></span></span></div>
        <button class="step" data-step="-1" data-id="${it.id}">−</button>
        <input class="n" inputmode="numeric" data-f="qty" data-id="${it.id}" value="${draft.qty[it.id] || ''}" placeholder="0">
        <button class="step" data-step="1" data-id="${it.id}">+</button>
      </div>`).join('') || `<div class="muted">வண்டியில் இருப்பு இல்லை – முதலில் இருப்பு டேபில் பதியவும். / No stock in van – enter it in the Stock tab first.</div>`}
  </div>
  <div class="big" data-cls="bigCls">
    <div class="lbl">வசூலிக்க வேண்டியது / To collect</div>
    <div class="val" data-o="dTotal"></div>
    <div class="lbl" data-o="dLines"></div>
  </div>
  <div class="card">
    <div class="row"><label class="grow">ரொக்கம் <span class="en">Cash received</span></label>
      <input class="n" style="width:110px" inputmode="numeric" data-f="dcash" value="${esc(draft.cash)}" placeholder="0"></div>
    <div class="row"><label class="grow">போன் பே <span class="en">PhonePe / UPI</span></label>
      <input class="n" style="width:110px" inputmode="numeric" data-f="dupi" value="${esc(draft.upi)}" placeholder="0"></div>
    <div class="row" style="margin-top:10px"><span class="grow" data-o="dBal"></span></div>
  </div>
  <div class="muted" data-o="needs" style="color:var(--bad);margin-bottom:6px"></div>
  <button class="btn wide" data-act="confirm" data-cls="confirmCls">✔ உறுதி செய் / Confirm</button>
  ${draft.editId ? `<div class="btns"><button class="btn ghost" data-act="cancelEdit">ரத்து / Cancel</button><button class="btn danger" data-act="delDelivery">நீக்கு / Delete</button></div>` : ''}
  ${S().deliveries.length ? `<h2>இன்றைய விநியோகம் <small>Today's deliveries (${S().deliveries.length})</small></h2>
  <div class="card">${[...S().deliveries].reverse().map(deliveryRow).join('')}</div>` : ''}`;
};

function deliveryRow(d) {
  const bal = d.total - paid(d);
  return `<div class="list-item">
    <div class="grow"><b>${esc(d.customer)}</b> <span class="muted">${d.time}</span>
      <div class="muted">${d.lines.map(l => `${esc(itemName(l.id))} × ${l.qty}`).join(', ')}</div></div>
    <div class="right"><b>${rs(d.total)}</b>
      ${bal > 0 ? `<div class="tag">பாக்கி ${rs(bal)}</div>` : bal < 0 ? `<div class="tag good">வரவு ${rs(-bal)}</div>` : ''}
      <div><button class="link" data-edit="${d.id}">திருத்து / Edit</button></div></div>
  </div>`;
}

OUTPUTS.deliver = () => {
  const o = {}, total = draftTotal();
  let over = false;
  state.items.forEach(it => {
    const av = available(it.id), q = num(draft.qty[it.id]);
    if (q > av) over = true;
    o['av_' + it.id] = q > av ? `<b style="color:var(--bad)">வண்டியில் ${av} மட்டும் / only ${av} in van</b>` : `வண்டியில் ${av - q} / ${av - q} left`;
  });
  if (!draft.cashTouched) {
    draft.cash = String(Math.max(0, total - num(draft.upi)) || '');
    const el = document.querySelector('[data-f=dcash]');
    if (el && document.activeElement !== el) el.value = draft.cash;
  }
  const lines = state.items.filter(it => num(draft.qty[it.id])).map(it => `${esc(it.ta)} ${num(draft.qty[it.id])}×${it.price}`);
  o.dTotal = rs(total);
  o.dLines = lines.join(' · ') || 'பொருள் தேர்வு செய் / Pick items';
  const bal = total - num(draft.cash) - num(draft.upi);
  o.dBal = bal > 0 ? `<span class="tag">வா.பற்று / Credit: ${rs(bal)}</span>`
         : bal < 0 ? `<span class="tag good">பழைய பாக்கி வரவு / Old due received: ${rs(-bal)}</span>`
         : total ? `<span class="tag good">முழு தொகை / Fully paid</span>` : '';
  const due = customerDues()[draft.customer.trim()] || 0;
  const editing = draft.editId && S().deliveries.find(d => d.id === draft.editId);
  const prevDue = due - (editing ? editing.total - paid(editing) : 0);
  o.oldDue = prevDue > 0 ? `பழைய பாக்கி / Old due: <b>${rs(prevDue)}</b>` : '';
  o.needs = deliveryProblem(over, total) || '';
  o.confirmCls = 'btn wide' + (o.needs ? ' ghost' : '');
  o.bigCls = 'big' + (over ? ' bad' : '');
  return o;
};

function deliveryProblem(over, total) {
  if (!draft.customer.trim()) return 'மேலே வாடிக்கையாளர் பெயர் எழுதவும் / Enter the customer name at the top';
  if (!total) return 'பொருள் தேர்வு செய்யவும் / Pick at least one item';
  if (over) return 'வண்டியில் உள்ளதை விட அதிகம் / More than the stock in the van';
  return null;
}

function confirmDelivery() {
  const over = state.items.some(it => num(draft.qty[it.id]) > available(it.id));
  const problem = deliveryProblem(over, draftTotal());
  if (problem) {
    toast(problem);
    if (!draft.customer.trim()) {
      const el = document.querySelector('[data-f=customer]');
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus();
    }
    return;
  }
  const lines = state.items.filter(it => num(draft.qty[it.id])).map(it => ({ id: it.id, qty: num(draft.qty[it.id]), price: it.price }));
  const total = sum(lines.map(l => l.qty * l.price));
  const rec = { customer: draft.customer.trim(), lines, total, cash: num(draft.cash), upi: num(draft.upi) };
  if (draft.editId) {
    const d = S().deliveries.find(d => d.id === draft.editId);
    Object.assign(d, rec);
  } else {
    S().deliveries.push({ id: uid(), time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), ...rec });
  }
  save();
  toast(`${rec.customer}: ${rs(total)} சேர்க்கப்பட்டது / saved`);
  draft = blankDraft();
  render();
  window.scrollTo(0, 0);
}

/* Sales */
VIEWS.sales = () => {
  const c = calc(S());
  const byCust = {};
  S().deliveries.forEach(d => byCust[d.customer] = (byCust[d.customer] || 0) + d.total);
  return `
  <h2>விற்பனை <small>Sales & balance stock</small></h2>
  <div class="card">
    <table class="tbl">
      <thead><tr><th>பொருள்</th><th>மொத்தம்<br>Total</th><th>விற்பனை<br>Sold</th><th>மீதி<br>Left</th><th>ரூபாய்<br>₹</th></tr></thead>
      <tbody>${c.rows.filter(r => r.total || r.sold).map(r => `
        <tr><td>${esc(r.it.ta)}<div class="muted">${r.sold} × ${rs(r.it.price)}</div></td>
        <td>${r.total}</td><td>${r.sold}</td><td><b>${r.closing}</b></td><td>${rs(r.amount)}</td></tr>`).join('') ||
        '<tr><td colspan="5" class="muted">இருப்பு இல்லை / No stock entered</td></tr>'}
      </tbody>
      <tfoot><tr><td>மொத்தம்</td><td>${sum(c.rows.map(r => r.total))}</td><td>${sum(c.rows.map(r => r.sold))}</td><td>${sum(c.rows.map(r => r.closing))}</td><td>${rs(c.sales)}</td></tr></tfoot>
    </table>
    <div class="muted" style="margin-top:6px">மீதி = வண்டியில் உள்ள இருப்பு (ரிட்டன்) / Left = closing stock (return)</div>
  </div>
  <h2>வாடிக்கையாளர் வாரியாக <small>By customer</small></h2>
  <div class="card">${Object.keys(byCust).length ? Object.entries(byCust).map(([n, t]) =>
    `<div class="list-item"><span>${esc(n)}</span><b>${rs(t)}</b></div>`).join('') : '<div class="muted">இன்னும் இல்லை / None yet</div>'}</div>`;
};

/* Amount */
VIEWS.amount = () => {
  const day = S();
  const names = customerNames();
  return `
  <div class="big" data-cls="resCls">
    <div class="lbl">கையில் இருக்க வேண்டியது (ரொக்கம்) / Should be in hand</div>
    <div class="val" data-o="expected"></div>
    <div class="lbl" data-o="result"></div>
  </div>

  <h2>பெறப்பட்ட தொகை <small>Amount received</small></h2>
  <div class="card chain">
    <div class="row"><span>ரொக்கம் <span class="en">Cash</span></span><b data-o="cashRecv"></b></div>
    <div class="row"><span>போன் பே <span class="en">PhonePe</span></span><b data-o="upiRecv"></b></div>
    <div class="row sub"><span>மொத்தம் <span class="en">Total received</span></span><b data-o="recvTotal"></b></div>
  </div>

  <h2>கணக்கு <small>Calculation</small></h2>
  <div class="card chain">
    <div class="row"><span>மொத்த விற்பனை <span class="en">Sales</span></span><b data-o="sales"></b></div>
    <div class="row"><span>− செலவு <span class="en">Expenses</span></span><span data-o="expenses"></span></div>
    <div class="row"><span>− தள்ளுபடி <span class="en">Discount</span></span><span data-o="discount"></span></div>
    <div class="row"><span>− டேமேஜ் <span class="en">Damage</span></span><span data-o="damage"></span></div>
    <div class="row"><span>− வா.பற்று <span class="en">Credit given</span></span><span data-o="creditGiven"></span></div>
    <div class="row"><span>+ வா.வரவு <span class="en">Old dues received</span></span><span data-o="creditRecv"></span></div>
    <div class="row final"><span>ரொக்கம்</span><span data-o="expected"></span></div>
  </div>

  <h2>செலவுகள் <small>Expenses</small></h2>
  <div class="card">
    ${EXPENSES.map(e => `<div class="row"><label class="grow">${e.ta} <span class="en">${e.en}</span></label>
      <input class="n" style="width:110px" inputmode="numeric" data-f="exp" data-id="${e.id}" value="${day.exp[e.id] || ''}" placeholder="0"></div>`).join('')}
    <div class="row"><label class="grow">தள்ளுபடி <span class="en">Discount</span></label>
      <input class="n" style="width:110px" inputmode="numeric" data-f="discount" value="${day.discount || ''}" placeholder="0"></div>
    <div class="row"><label class="grow">டேமேஜ் <span class="en">Damage ₹</span></label>
      <input class="n" style="width:110px" inputmode="numeric" data-f="damage" value="${day.damage || ''}" placeholder="0"></div>
  </div>

  <h2>பழைய பாக்கி வரவு <small>Old dues received (வா.வரவு)</small></h2>
  <div class="card">
    ${day.received.map((r, i) => `<div class="list-item"><span>${esc(r.customer)} <span class="muted">${r.mode === 'upi' ? 'PhonePe' : 'Cash'}</span></span>
      <span><b>${rs(num(r.amount))}</b> <button class="link" data-delrec="${i}">✕</button></span></div>`).join('')}
    <input list="custList2" id="recName" placeholder="வாடிக்கையாளர் / Customer" autocomplete="off">
    <datalist id="custList2">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="row" style="margin-top:8px">
      <input class="grow" id="recAmt" inputmode="numeric" placeholder="₹ தொகை / Amount">
      <select id="recMode" style="min-height:44px;border-radius:8px;border:1px solid var(--line);background:var(--bg)"><option value="cash">Cash</option><option value="upi">PhonePe</option></select>
      <button class="btn" data-act="addRec">+</button>
    </div>
  </div>

  <h2>பண எண்ணிக்கை <small>Cash count</small></h2>
  <div class="card">
    ${NOTES.map(n => `<div class="row"><span style="width:56px"><b>${n}</b> ×</span>
      <input class="n" inputmode="numeric" data-f="note" data-id="${n}" value="${day.cash[n] || ''}" placeholder="0">
      <span class="grow right" data-o="note_${n}"></span></div>`).join('')}
    <div class="row"><span class="grow">சில்லரை <span class="en">Coins</span></span>
      <input class="n" style="width:110px" inputmode="numeric" data-f="coins" value="${day.cash.coins || ''}" placeholder="0"></div>
    <div class="row"><span class="grow">போன் பே <span class="en">PhonePe total</span></span>
      <input class="n" style="width:110px" inputmode="numeric" data-f="upiCount" value="${day.upiCount ?? ''}" data-ph="upiPh"></div>
    <div class="row chain final"><span class="grow">மொத்தம் <span class="en">Counted</span></span><span data-o="counted"></span></div>
  </div>

  <h2>விற்பனை தாள் <small>Download today's sheet</small></h2>
  <div class="card">${sheetButtons('cur')}</div>`;
};

OUTPUTS.amount = () => {
  const c = calc(S()), o = {};
  Object.assign(o, {
    sales: rs(c.sales), expenses: rs(c.expenses), discount: rs(c.discount), damage: rs(c.damage),
    creditGiven: rs(c.creditGiven), creditRecv: rs(c.creditRecv), expected: rs(c.expected),
    cashRecv: rs(c.cashRecv), upiRecv: rs(c.upiRecv), recvTotal: rs(c.cashRecv + c.upiRecv),
    counted: rs(c.counted),
  });
  NOTES.forEach(n => o['note_' + n] = rs(n * num(S().cash[n])));
  const ph = document.querySelector('[data-f=upiCount]');
  if (ph) ph.placeholder = String(c.upiRecv);
  if (!c.counting) { o.result = 'பணம் எண்ணவும் / Count the cash below'; o.resCls = 'big'; }
  else if (c.diff > 0) { o.result = `குறைவு / SHORT ${rs(c.diff)}`; o.resCls = 'big bad'; }
  else if (c.diff < 0) { o.result = `அதிகம் / EXCESS ${rs(-c.diff)}`; o.resCls = 'big good'; }
  else { o.result = 'சரி / Balanced ✔'; o.resCls = 'big good'; }
  return o;
};

/* More */
VIEWS.more = () => {
  const dues = Object.entries(customerDues()).filter(([n, v]) => n && v > 0).sort((a, b) => b[1] - a[1]);
  return `
  <h2>இன்றைய விற்பனை தாள் <small>Today's sales sheet</small></h2>
  <div class="card">
    <img id="sheetPreview" class="sheet-img" alt="Sales sheet preview">
    ${sheetButtons('cur')}
  </div>

  <h2>இன்றைய சுருக்கம் <small>Today's summary</small></h2>
  <div class="card"><pre class="summary">${esc(summaryText(S()))}</pre>
    <div class="btns"><button class="btn" data-act="share">WhatsApp / Share</button></div></div>

  <div class="card">
    <button class="btn wide" data-act="closeDay">நாள் முடிவு / Close day →</button>
    <div class="muted" style="margin-top:6px">இன்றைய கணக்கை சேமித்து, மீதி இருப்புடன் புதிய நாள் தொடங்கும். / Saves today and starts the next day with the closing stock as opening.</div>
  </div>

  <h2>பாக்கி <small>Customer dues</small></h2>
  <div class="card">${dues.length ? dues.map(([n, v]) => `<div class="list-item"><span>${esc(n)}</span><b>${rs(v)}</b></div>`).join('')
    : '<div class="muted">பாக்கி இல்லை / No dues</div>'}</div>

  <h2>பழைய நாட்கள் <small>History</small></h2>
  <div class="card">${state.history.length ? state.history.map((d, i) => {
      const c = calc(d);
      return `<div class="list-item"><span>${fmtDate(d.date)}<div class="muted">விற்பனை ${rs(c.sales)} · ரொக்கம் ${rs(c.expected)}</div></span>
        <button class="link" data-hist="${i}">பார் / View</button></div>`;
    }).join('') : '<div class="muted">இன்னும் இல்லை / None yet</div>'}
    <div id="histView"></div></div>

  <h2>பொருட்கள் & விலை <small>Items & prices</small></h2>
  <div class="card">
    ${state.items.map((it, i) => `<div class="row">
      <input class="grow" data-f="itemTa" data-i="${i}" value="${esc(it.ta)}">
      <input class="n" inputmode="numeric" data-f="itemPrice" data-i="${i}" value="${it.price || ''}" placeholder="₹">
      <button class="link" data-delitem="${i}">✕</button></div>`).join('')}
    <div class="btns"><button class="btn ghost" data-act="addItem">+ பொருள் சேர் / Add item</button></div>
    <div class="muted" style="margin-top:6px">விலை மாற்றம் புதிய விநியோகத்திற்கு மட்டும். / Price changes apply to new deliveries only.</div>
  </div>

  <h2>PIN மாற்று <small>Change stock lock PIN</small></h2>
  <div class="card">
    <input id="pinOld" type="password" inputmode="numeric" placeholder="பழைய PIN / Old PIN" autocomplete="off">
    <div class="row" style="margin-top:8px">
      <input id="pinNew" type="password" inputmode="numeric" placeholder="புதிய PIN / New PIN" autocomplete="off">
      <button class="btn" data-act="changePin">மாற்று / Save</button>
    </div>
  </div>

  <h2>காப்பு <small>Backup</small></h2>
  <div class="card">
    <div class="btns">
      <button class="btn ghost" data-act="export">⬇ சேமி / Backup file</button>
      <button class="btn ghost" data-act="import">⬆ மீட்டெடு / Restore</button>
    </div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <div class="muted" style="margin-top:6px">தரவு இந்த போனில் மட்டும். வாரம் ஒருமுறை காப்பு எடுக்கவும். / Data lives only on this phone — back up weekly.</div>
  </div>`;
};

function summaryText(day) {
  const c = calc(day);
  const L = [];
  L.push(`பசுபதி பேக்கரி – ${fmtDate(day.date)}`);
  L.push('');
  L.push('பொருள்: மொத்தம் / விற்பனை / மீதி / ₹');
  c.rows.filter(r => r.total || r.sold).forEach(r =>
    L.push(`${r.it.ta}: ${r.total} / ${r.sold} / ${r.closing} / ${rs(r.amount)}`));
  L.push('');
  L.push(`மொத்த விற்பனை: ${rs(c.sales)}`);
  if (c.expenses) L.push(`செலவு: ${rs(c.expenses)} (${EXPENSES.filter(e => num(day.exp[e.id])).map(e => `${e.ta} ${num(day.exp[e.id])}`).join(', ')})`);
  if (c.discount) L.push(`தள்ளுபடி: ${rs(c.discount)}`);
  if (c.damage) L.push(`டேமேஜ்: ${rs(c.damage)}`);
  if (c.creditGiven) L.push(`வா.பற்று: ${rs(c.creditGiven)}`);
  if (c.creditRecv) L.push(`வா.வரவு: ${rs(c.creditRecv)}`);
  L.push(`ரொக்கம் (வர வேண்டியது): ${rs(c.expected)}`);
  L.push(`பெற்றது: Cash ${rs(c.cashRecv)} + PhonePe ${rs(c.upiRecv)}`);
  if (c.counting) {
    L.push(`எண்ணியது: ${rs(c.counted)}`);
    L.push(c.diff > 0 ? `குறைவு / SHORT: ${rs(c.diff)}` : c.diff < 0 ? `அதிகம் / EXCESS: ${rs(-c.diff)}` : 'சரி / Balanced');
  }
  const credits = day.deliveries.filter(d => d.total > paid(d));
  if (credits.length) {
    L.push('');
    L.push('பாக்கி:');
    credits.forEach(d => L.push(`${d.customer}: ${rs(d.total - paid(d))}`));
  }
  return L.join('\n');
}

// Saves the day to history and starts the next one with the return stock as opening (locked).
function closeDay(nextDate) {
  const prev = S(), c = calc(prev);
  const open = {};
  c.rows.forEach(r => { if (r.closing) open[r.it.id] = r.closing; });
  state.history.unshift(prev);
  let next = nextDate || today();
  if (next <= prev.date) {
    const n = new Date(prev.date + 'T00:00'); n.setDate(n.getDate() + 1);
    next = new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  const info = prev.info || {};
  state.current = newDay(next, open, { name: info.name || '', startKm: info.endKm || '' });
  state.current.lockOpen = Object.keys(open).length > 0;
  draft = blankDraft(); save(); tab = 'stock'; render();
  toast('புதிய நாள் – ரிட்டன் இருப்பு சேர்க்கப்பட்டது / New day – return stock added');
}

function hasActivity(day) {
  return day.deliveries.length || Object.values(day.taken).some(Boolean);
}

// Opening the app on a later date: offer to close the old day so the return carries over.
function startupCheck() {
  const day = S();
  if (day.date >= today()) return;
  if (!hasActivity(day)) { day.date = today(); save(); render(); return; }
  if (confirm(`${fmtDate(day.date)} கணக்கு இன்னும் முடிக்கவில்லை. முடித்து, ரிட்டன் இருப்புடன் இன்றைய நாளை தொடங்கவா?\n\n${fmtDate(day.date)} is still open. Close it and start today with the return stock?`)) closeDay();
}

function sheetDay(key) { return key === 'cur' || key === undefined ? S() : state.history[+key]; }

async function downloadSheet(key, kind) {
  const day = sheetDay(key);
  toast('தயாராகிறது… / Preparing…');
  const canvas = await drawSheet(day);
  const name = `pasupathi-sales-${day.date}.${kind}`;
  const blob = kind === 'png'
    ? await new Promise(r => canvas.toBlob(r, 'image/png'))
    : sheetPdf(canvas);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`${name} சேமிக்கப்பட்டது / downloaded`);
}

function sheetButtons(key) {
  return `<div class="btns">
    <button class="btn" data-act="png" data-day="${key}">⬇ PNG</button>
    <button class="btn" data-act="pdf" data-day="${key}">⬇ PDF</button></div>`;
}

async function showPreview(key, imgId) {
  const img = document.getElementById(imgId);
  if (!img) return;
  const canvas = await drawSheet(sheetDay(key));
  img.src = canvas.toDataURL('image/jpeg', 0.8);
}

/* ---------- events ---------- */

document.addEventListener('input', e => {
  const el = e.target, f = el.dataset.f, id = el.dataset.id;
  if (!f) return;
  const day = S();
  switch (f) {
    case 'open': day.open[id] = num(el.value); break;
    case 'taken': day.taken[id] = num(el.value); break;
    case 'customer': draft.customer = el.value; break;
    case 'qty': draft.qty[id] = num(el.value); break;
    case 'dcash': draft.cash = el.value; draft.cashTouched = el.value !== ''; break;
    case 'dupi': draft.upi = el.value; break;
    case 'exp': day.exp[id] = num(el.value); break;
    case 'discount': day.discount = num(el.value); break;
    case 'damage': day.damage = num(el.value); break;
    case 'note': day.cash[id] = num(el.value); break;
    case 'coins': day.cash.coins = num(el.value); break;
    case 'upiCount': day.upiCount = el.value === '' ? null : num(el.value); break;
    case 'itemTa': state.items[el.dataset.i].ta = el.value; break;
    case 'itemPrice': state.items[el.dataset.i].price = num(el.value); break;
    case 'info': day.info = day.info || {}; day.info[id] = el.value; break;
    case 'date': return;   // handled on 'change' below
  }
  if (!['customer', 'qty', 'dcash', 'dupi'].includes(f)) save();
  refresh();
});

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;

  if (d.tab || d.go) { tab = d.tab || d.go; render(); window.scrollTo(0, 0); return; }

  if (d.step) {
    const q = Math.max(0, num(draft.qty[d.id]) + Number(d.step));
    draft.qty[d.id] = q;
    document.querySelector(`[data-f=qty][data-id="${d.id}"]`).value = q || '';
    refresh();
    return;
  }

  if (d.edit) {
    const x = S().deliveries.find(x => x.id === d.edit);
    draft = { editId: x.id, customer: x.customer, qty: Object.fromEntries(x.lines.map(l => [l.id, l.qty])),
              cash: String(x.cash || ''), upi: String(x.upi || ''), cashTouched: true };
    render(); window.scrollTo(0, 0); return;
  }

  if (d.lock) {
    const ta = d.lock === 'Open' ? 'வ.இருப்பு / opening stock' : 'எடுத்தது / taken';
    if (confirm(`${ta} உறுதி செய்து பூட்டவா? / Confirm and lock?`)) {
      S()['lock' + d.lock] = true; save(); render(); toast('🔒 பூட்டப்பட்டது / Locked');
    }
    return;
  }

  if (d.unlock) {
    const p = prompt('PIN எண் / Enter PIN');
    if (p === null) return;
    if (p === pin()) { S()['lock' + d.unlock] = false; save(); render(); toast('🔓 திறக்கப்பட்டது / Unlocked'); }
    else toast('தவறான PIN / Wrong PIN');
    return;
  }

  if (d.delrec) { S().received.splice(+d.delrec, 1); save(); render(); return; }

  if (d.hist) {
    $('#histView').innerHTML = `<div class="card" style="margin-top:10px">
      <img id="histPreview" class="sheet-img" alt="Sales sheet">${sheetButtons(d.hist)}</div>`;
    showPreview(d.hist, 'histPreview');
    return;
  }

  if (d.delitem) {
    const it = state.items[+d.delitem];
    if (confirm(`"${it.ta}" நீக்கவா? / Remove this item?`)) { state.items.splice(+d.delitem, 1); save(); render(); }
    return;
  }

  switch (d.act) {
    case 'confirm': confirmDelivery(); break;
    case 'cancelEdit': draft = blankDraft(); render(); break;
    case 'delDelivery':
      if (confirm('இந்த விநியோகத்தை நீக்கவா? / Delete this delivery?')) {
        S().deliveries = S().deliveries.filter(x => x.id !== draft.editId);
        draft = blankDraft(); save(); render();
      }
      break;
    case 'addRec': {
      const name = $('#recName').value.trim(), amt = num($('#recAmt').value);
      if (!name || !amt) { toast('பெயர், தொகை தேவை / Enter name and amount'); break; }
      S().received.push({ customer: name, amount: amt, mode: $('#recMode').value });
      save(); render(); break;
    }
    case 'share': {
      const text = summaryText(S());
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
      break;
    }
    case 'closeDay':
      if (confirm('இன்றைய நாளை முடிக்கவா? / Close today and start a new day?')) closeDay();
      break;
    case 'png': case 'pdf': downloadSheet(d.day, d.act); break;
    case 'addItem': {
      const ta = prompt('பொருள் பெயர் / Item name');
      if (!ta) break;
      const price = num(prompt('விலை / Price ₹'));
      state.items.push({ id: uid(), ta, en: '', price });
      save(); render(); break;
    }
    case 'export': {
      const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pasupathi-backup-${S().date}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      break;
    }
    case 'import': $('#importFile').click(); break;
    case 'changePin': {
      const oldP = $('#pinOld').value, newP = $('#pinNew').value.trim();
      if (oldP !== pin()) { toast('பழைய PIN தவறு / Old PIN is wrong'); break; }
      if (!/^\d{4,8}$/.test(newP)) { toast('4–8 எண்கள் / Use 4–8 digits'); break; }
      state.pin = newP; save(); render(); toast('PIN மாற்றப்பட்டது / PIN changed');
      break;
    }
  }
});

// Picking a later date starts that day: today's sheet is saved and its return becomes the opening stock.
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.f !== 'date') return;
  const day = S(), picked = el.value;
  if (!picked || picked === day.date) return;
  if (picked > day.date && hasActivity(day)) {
    if (confirm(`${fmtDate(day.date)} கணக்கை முடித்து, ரிட்டன் இருப்புடன் ${fmtDate(picked)} தொடங்கவா?\n\nClose ${fmtDate(day.date)} and start ${fmtDate(picked)} with the return stock?`)) closeDay(picked);
    else el.value = day.date;
    return;
  }
  day.date = picked;   // no sales yet, or correcting to an earlier date: just change the date
  save();
  $('#topDate').textContent = fmtDate(day.date);
});

document.addEventListener('change', e => {
  if (e.target.id !== 'importFile' || !e.target.files[0]) return;
  e.target.files[0].text().then(t => {
    const s = JSON.parse(t);
    if (!s.current || !s.items) throw new Error('bad file');
    if (!confirm('தற்போதைய தரவை மாற்றவா? / Replace all data on this phone with the backup?')) return;
    state = s; draft = blankDraft(); save(); render(); toast('மீட்டெடுக்கப்பட்டது / Restored');
  }).catch(() => toast('தவறான கோப்பு / Not a valid backup file'));
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
startupCheck();
