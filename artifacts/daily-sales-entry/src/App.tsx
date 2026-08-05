import { useMemo, useState } from 'react';
import { Clipboard, FileText, MessageCircle, RotateCcw, Send, X } from 'lucide-react';
import modelCatalogText from '@assets/Pasted-FFC-AW-T26D2000QM-MG-FFC-AW-T26D1800MM-MG-FFC-AW-T26D14_1785926348305.txt?raw';

type ProductCode = 'FFC' | 'REF' | 'KWH' | 'MOA' | 'SDA' | 'RAC';
type ProductEntry = { model: string; quantity: string; price: string };
type ReportForm = {
  storeName: string;
  date: string;
  target: string;
  mtdSales: string;
  todaySales: string;
  feedback: string;
  products: Record<ProductCode, ProductEntry>;
};

const PRODUCT_CODES: ProductCode[] = ['FFC', 'REF', 'KWH', 'MOA', 'SDA', 'RAC'];
const PRODUCT_NAMES: Record<ProductCode, string> = {
  FFC: 'Fan / Fan Coil',
  REF: 'Refrigerator',
  KWH: 'Kitchen & Home',
  MOA: 'Microwave Oven',
  SDA: 'Small Domestic Appliance',
  RAC: 'Room Air Conditioner',
};

const modelsByCategory = PRODUCT_CODES.reduce((catalog, code) => {
  catalog[code] = [];
  return catalog;
}, {} as Record<ProductCode, string[]>);

modelCatalogText.split(/\r?\n/).forEach((line) => {
  const [category, model] = line.split('\t', 2);
  if (category && model?.trim() && PRODUCT_CODES.includes(category as ProductCode)) {
    modelsByCategory[category as ProductCode].push(model.trim());
  }
});

const MODEL_OPTIONS_BY_CATEGORY = PRODUCT_CODES.reduce((options, code) => {
  options[code] = ['-- Select model --', ...modelsByCategory[code]];
  return options;
}, {} as Record<ProductCode, string[]>);

function localToday() {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function emptyProducts(): Record<ProductCode, ProductEntry> {
  return PRODUCT_CODES.reduce((result, code) => {
    result[code] = { model: '', quantity: '', price: '' };
    return result;
  }, {} as Record<ProductCode, ProductEntry>);
}

function initialForm(): ReportForm {
  return { storeName: '', date: localToday(), target: '', mtdSales: '', todaySales: '', feedback: '', products: emptyProducts() };
}

function formatDate(value: string) {
  if (!value) return '--/--/----';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatRM(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `RM ${numeric.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'RM 0.00';
}

function displayValue(value: string) {
  return value.trim() ? formatRM(value) : 'RM 0.00';
}

function buildReport(form: ReportForm) {
  const lines = [
    `*${form.storeName.trim() || '(Store name)'} Daily Sales*`,
    `Date: ${form.date ? formatDate(form.date) : '-'}`,
    `Target: RM ${form.target.trim() || '-'}`,
    `MTD Sales: RM ${form.mtdSales.trim() || '-'}`,
    `Today Sales: RM ${form.todaySales.trim() || '-'}`,
    '',
  ];
  const entered = PRODUCT_CODES.filter((code) => form.products[code].model && form.products[code].quantity.trim());
  if (!entered.length) lines.push('(No products entered)');
  entered.forEach((code) => {
    const product = form.products[code];
    lines.push(`*${code}:* ${product.model} x${product.quantity} - RM ${product.price.trim() || '0'}`);
  });
  if (form.feedback.trim()) {
    lines.push('', `*Feedback:* ${form.feedback.trim()}`);
  }
  return lines.join('\n');
}

function ProductRow({ code, entry, onChange }: { code: ProductCode; entry: ProductEntry; onChange: (field: keyof ProductEntry, value: string) => void }) {
  return (
    <div className="product-row" data-testid={`row-product-${code.toLowerCase()}`}>
      <div className="product-code" aria-hidden="true">{code}</div>
      <div className="product-fields">
        <div className="field">
          <label htmlFor={`model-${code}`}>Model</label>
          <select id={`model-${code}`} className="select" value={entry.model} onChange={(event) => onChange('model', event.target.value)} data-testid={`select-model-${code.toLowerCase()}`}>
            {MODEL_OPTIONS_BY_CATEGORY[code].map((model) => <option key={model} value={model === '-- Select model --' ? '' : model}>{model}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`quantity-${code}`}>Qty</label>
          <input id={`quantity-${code}`} className="input" type="number" min="1" step="1" inputMode="numeric" placeholder="0" value={entry.quantity} onChange={(event) => onChange('quantity', event.target.value)} data-testid={`input-quantity-${code.toLowerCase()}`} />
        </div>
        <div className="field">
          <label htmlFor={`price-${code}`}>Price</label>
          <div className="input-wrap">
            <span className="currency" aria-hidden="true">RM</span>
            <input id={`price-${code}`} className="input" type="text" inputMode="decimal" placeholder="0.00" value={entry.price} onChange={(event) => onChange('price', event.target.value)} data-testid={`input-price-${code.toLowerCase()}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [form, setForm] = useState<ReportForm>(initialForm);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [storeError, setStoreError] = useState('');

  const report = useMemo(() => buildReport(form), [form]);
  const enteredCount = useMemo(() => PRODUCT_CODES.filter((code) => form.products[code].model && form.products[code].quantity.trim()).length, [form.products]);

  const updateField = (field: keyof Omit<ReportForm, 'products'>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'storeName' && value.trim()) setStoreError('');
  };
  const updateProduct = (code: ProductCode, field: keyof ProductEntry, value: string) => {
    setForm((current) => ({ ...current, products: { ...current.products, [code]: { ...current.products[code], [field]: value } } }));
  };
  const flash = (message: string) => {
    setFeedbackMessage(message);
    window.setTimeout(() => setFeedbackMessage(''), 2800);
  };
  const submitToWhatsApp = () => {
    if (!form.storeName.trim()) {
      setStoreError('Add a store name before sending.');
      document.getElementById('store-name')?.focus();
      return;
    }
    const url = `https://wa.me/?text=${encodeURIComponent(report)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    flash('Report ready — opening WhatsApp.');
  };
  const copyReport = async () => {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(report);
      else throw new Error('Clipboard unavailable');
      flash('Report copied to clipboard.');
    } catch {
      flash('Copy is unavailable here — use Generate WhatsApp report instead.');
    }
  };
  const clearAll = () => {
    setForm(initialForm());
    setShowClearDialog(false);
    setStoreError('');
    flash('Entry cleared. Date reset to today.');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" data-testid="brand-daily-sales">
          <div className="brand-mark"><FileText size={19} strokeWidth={2.2} /></div>
          <div><div className="brand-name">Daily Sales</div><div className="brand-sub">Retail reporting desk</div></div>
        </div>
        <div className="day-chip"><i /> Client-side workspace</div>
      </header>

      <main className="main-grid">
        <section className="intro" aria-labelledby="page-title">
          <div className="eyebrow">End-of-day, made lighter</div>
          <h1 className="headline" id="page-title">Close the day.<br /><em>Send the numbers.</em></h1>
          <p className="intro-copy">A quick, dependable way to turn your store figures into a WhatsApp-ready update. Fill in what changed today and leave the formatting to us.</p>
        </section>

        <div className="form-column">
          <section className="section-card form-card" aria-labelledby="details-title">
            <div className="section-heading"><h2 className="section-title" id="details-title">Report details</h2><span className="section-index">01 / 03</span></div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="store-name">Store name</label>
                <input id="store-name" className="input" type="text" placeholder="e.g. Wah Lee Tanjung Tokong" value={form.storeName} onChange={(event) => updateField('storeName', event.target.value)} data-testid="input-store-name" aria-invalid={Boolean(storeError)} />
                {storeError && <span className="field-error" role="alert" data-testid="error-store-name">{storeError}</span>}
              </div>
              <div className="field">
                <label htmlFor="report-date">Report date</label>
                <input id="report-date" className="input" type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} data-testid="input-report-date" />
              </div>
              <div className="field">
                <label htmlFor="target">Target</label>
                <div className="input-wrap"><span className="currency" aria-hidden="true">RM</span><input id="target" className="input" type="text" inputMode="decimal" placeholder="0.00" value={form.target} onChange={(event) => updateField('target', event.target.value)} data-testid="input-target" /></div>
              </div>
              <div className="field">
                <label htmlFor="mtd-sales">MTD sales</label>
                <div className="input-wrap"><span className="currency" aria-hidden="true">RM</span><input id="mtd-sales" className="input" type="text" inputMode="decimal" placeholder="0.00" value={form.mtdSales} onChange={(event) => updateField('mtdSales', event.target.value)} data-testid="input-mtd-sales" /></div>
              </div>
              <div className="field">
                <label htmlFor="today-sales">Today's sales</label>
                <div className="input-wrap"><span className="currency" aria-hidden="true">RM</span><input id="today-sales" className="input" type="text" inputMode="decimal" placeholder="0.00" value={form.todaySales} onChange={(event) => updateField('todaySales', event.target.value)} data-testid="input-today-sales" /></div>
              </div>
            </div>
          </section>

          <section className="section-card products-card" aria-labelledby="products-title">
            <div className="section-heading"><h2 className="section-title" id="products-title">Product movement</h2><span className="section-index">02 / 03</span></div>
            <p className="products-intro">Only completed rows appear in your summary. Leave a category blank if there was no movement.</p>
            <div className="product-list">
              {PRODUCT_CODES.map((code) => <ProductRow key={code} code={code} entry={form.products[code]} onChange={(field, value) => updateProduct(code, field, value)} />)}
            </div>
          </section>

          <section className="section-card form-card remarks" aria-labelledby="remarks-title">
            <div className="section-heading"><h2 className="section-title" id="remarks-title">Feedback & remarks</h2><span className="section-index">03 / 03</span></div>
            <div className="field"><label htmlFor="feedback">Anything the group should know <span className="optional">optional</span></label><textarea id="feedback" className="textarea" placeholder="Stock notes, customer requests, wins from the floor..." value={form.feedback} onChange={(event) => updateField('feedback', event.target.value)} data-testid="textarea-feedback" /></div>
            <div className="form-actions">
              <button className="button button-quiet" type="button" onClick={() => setShowClearDialog(true)} data-testid="button-clear-all"><RotateCcw size={15} /> Clear all</button>
              <button className="button button-primary" type="button" onClick={submitToWhatsApp} data-testid="button-send-whatsapp"><MessageCircle size={17} /> Generate WhatsApp report <Send size={14} /></button>
            </div>
          </section>
        </div>

        <aside className="preview-column" aria-labelledby="preview-title">
          <div className="preview-sticky">
            <section className="section-card preview-card">
              <div className="section-heading"><h2 className="section-title" id="preview-title">Live summary</h2><span className="preview-status" data-testid="status-live-preview">Live preview</span></div>
              <div className="report-paper" data-testid="content-report-preview">
                <div className="report-kicker">WhatsApp handoff / {formatDate(form.date)}</div>
                <h3 className="report-heading">Daily Sales Report</h3>
                <dl className="report-details">
                  <div className="report-line"><dt>Store Name</dt><dd>{form.storeName.trim() || 'Your store'}</dd></div>
                  <div className="report-line"><dt>Date</dt><dd>{formatDate(form.date)}</dd></div>
                  <div className="report-line"><dt>Target</dt><dd>{displayValue(form.target)}</dd></div>
                  <div className="report-line"><dt>MTD Sales</dt><dd>{displayValue(form.mtdSales)}</dd></div>
                  <div className="report-line"><dt>Today's Sales</dt><dd>{displayValue(form.todaySales)}</dd></div>
                </dl>
                <div className="product-preview">
                  <h4 className="product-preview-title">Products / {enteredCount} entered</h4>
                  {enteredCount === 0 && <div className="empty-products" data-testid="text-no-products">(No products entered)</div>}
                  {PRODUCT_CODES.filter((code) => form.products[code].model && form.products[code].quantity.trim()).map((code) => <div className="product-preview-line" key={code} data-testid={`text-product-preview-${code.toLowerCase()}`}><span><strong>{code}</strong> · {form.products[code].model} × {form.products[code].quantity}</span><span>{displayValue(form.products[code].price)}</span></div>)}
                </div>
                <div className="feedback-preview" data-testid="text-feedback-preview"><strong>Feedback:</strong> {form.feedback.trim() || 'None'}</div>
              </div>
              <div className="preview-footer">
                <p className="preview-footer-note">Your report is formatted with bold labels for a clean group chat handoff.</p>
                <button className="button copy-button" type="button" onClick={copyReport} data-testid="button-copy-report"><Clipboard size={14} /> Copy</button>
              </div>
            </section>
          </div>
        </aside>
      </main>
      <div className="footer-note">No account. No saved data. Your figures stay in this browser until you clear them.</div>

      {feedbackMessage && <div className="toast-message" role="status" data-testid="status-feedback">{feedbackMessage}</div>}
      {showClearDialog && <div className="clear-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowClearDialog(false); }}>
        <div className="clear-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-dialog-title">
          <button className="button button-quiet" type="button" aria-label="Close clear confirmation" onClick={() => setShowClearDialog(false)} data-testid="button-close-clear-dialog" style={{ position: 'absolute', margin: '-12px -12px 0 0', right: '22px' }}><X size={17} /></button>
          <h2 id="clear-dialog-title">Start a fresh report?</h2>
          <p>This clears the store details, sales figures, product rows, and remarks. The report date will return to today.</p>
          <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={() => setShowClearDialog(false)} data-testid="button-cancel-clear">Keep editing</button><button className="button button-primary" type="button" onClick={clearAll} data-testid="button-confirm-clear">Clear report</button></div>
        </div>
      </div>}
    </div>
  );
}

export default App;
