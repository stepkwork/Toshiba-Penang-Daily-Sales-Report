import { useMemo, useState } from 'react';
import { Clipboard, MessageCircle, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import modelsText from "@assets/models.txt?raw";
import toshibaLogo from '@assets/image_1785926761492.png';

type ProductCode = 'FFC' | 'REF' | 'KWH' | 'MOA' | 'SDA' | 'RAC';
type ProductEntry = { model: string; quantity: string; price: string };
type ProductEntries = Record<ProductCode, ProductEntry[]>;
type ErrorMap = Record<string, string>;
type ReportForm = {
  storeName: string;
  date: string;
  target: string;
  mtdSales: string;
  todaySales: string;
  feedback: string;
  products: ProductEntries;
};

const PRODUCT_CODES: ProductCode[] = ['FFC', 'REF', 'KWH', 'MOA', 'SDA', 'RAC'];

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

function emptyProducts(): ProductEntries {
  return PRODUCT_CODES.reduce((result, code) => {
    result[code] = [{ model: '', quantity: '', price: '' }];
    return result;
  }, {} as ProductEntries);
}

function initialForm(): ReportForm {
  return { storeName: '', date: localToday(), target: '', mtdSales: '', todaySales: '', feedback: '', products: emptyProducts() };
}

function formatDate(value: string) {
  if (!value) return '--/--/----';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatRM(value: string, emptyValue = 'RM 0.00') {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) return emptyValue;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? `RM ${numeric.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : emptyValue;
}

function isMoney(value: string) {
  return /^\d+(?:\.\d{1,2})?$/.test(value) || /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(value);
}

function isQuantity(value: string) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function productErrorKey(code: ProductCode, index: number, field: keyof ProductEntry) {
  return `product-${code}-${index}-${field}`;
}

function validateForm(form: ReportForm): ErrorMap {
  const errors: ErrorMap = {};
  const requiredFields: Array<[keyof Omit<ReportForm, 'products'>, string]> = [
    ['storeName', 'Enter a store name.'],
    ['date', 'Select a report date.'],
    ['target', 'Enter a target amount.'],
    ['mtdSales', 'Enter the MTD sales amount.'],
    ['todaySales', "Enter today's sales amount."],
  ];

  requiredFields.forEach(([field, message]) => {
    const value = form[field];
    if (!value.trim()) errors[field] = message;
  });

  (['target', 'mtdSales', 'todaySales'] as const).forEach((field) => {
    const value = form[field].trim();
    if (value && !isMoney(value)) errors[field] = 'Enter numbers only, with an optional decimal value.';
  });

  PRODUCT_CODES.forEach((code) => {
    form.products[code].forEach((entry, index) => {
      const hasValue = Boolean(entry.model.trim() || entry.quantity.trim() || entry.price.trim());
      if (!hasValue) return;

      if (!entry.model.trim()) errors[productErrorKey(code, index, 'model')] = 'Select a model.';
      if (!entry.quantity.trim()) errors[productErrorKey(code, index, 'quantity')] = 'Enter a quantity.';
      else if (!isQuantity(entry.quantity.trim())) errors[productErrorKey(code, index, 'quantity')] = 'Use a whole number greater than 0.';
      if (!entry.price.trim()) errors[productErrorKey(code, index, 'price')] = 'Enter a price.';
      else if (!isMoney(entry.price.trim())) errors[productErrorKey(code, index, 'price')] = 'Enter a valid numeric price.';
    });
  });

  return errors;
}

function buildReport(form: ReportForm) {
  const lines = [
    `*${form.storeName.trim() || '(Store name)'}*`,
    `Date: ${form.date ? formatDate(form.date) : '-'}`,
    `Target: ${formatRM(form.target, 'RM -')}`,
    `MTD Sales: ${formatRM(form.mtdSales, 'RM -')}`,
    `Today Sales: ${formatRM(form.todaySales, 'RM -')}`,
    '',
  ];
  const enteredCategories = PRODUCT_CODES.filter((code) =>
    form.products[code].some((product) => product.model.trim() && product.quantity.trim()),
  );
  if (!enteredCategories.length) lines.push('(No products entered)');
  enteredCategories.forEach((code, categoryIndex) => {
    if (categoryIndex > 0) lines.push('');
    lines.push(`*${code}:*`, '');
    form.products[code]
      .filter((product) => product.model.trim() && product.quantity.trim())
      .forEach((product) => {
        lines.push(`${product.model} x${product.quantity} - ${formatRM(product.price, 'RM 0')}`);
      });
  });
  if (form.feedback.trim()) {
    lines.push('', `*Feedback:* ${form.feedback.trim()}`);
  }
  return lines.join('\n');
}

function ProductRow({
  code,
  index,
  entry,
  errors,
  canRemove,
  onChange,
  onRemove,
}: {
  code: ProductCode;
  index: number;
  entry: ProductEntry;
  errors: ErrorMap;
  canRemove: boolean;
  onChange: (field: keyof ProductEntry, value: string) => void;
  onRemove: () => void;
}) {
  const errorFor = (field: keyof ProductEntry) => errors[productErrorKey(code, index, field)];

  return (
    <div className="product-row" data-testid={`row-product-${code.toLowerCase()}-${index}`}>
      <div className="product-code" aria-hidden="true">{index + 1}</div>
      <div className="product-fields">
        <div className="field">
          <label htmlFor={`model-${code}-${index}`}>Model</label>
          <select id={`model-${code}-${index}`} className={`select${errorFor('model') ? ' input-error' : ''}`} value={entry.model} onChange={(event) => onChange('model', event.target.value)} data-testid={`select-model-${code.toLowerCase()}-${index}`} aria-invalid={Boolean(errorFor('model'))}>
            {MODEL_OPTIONS_BY_CATEGORY[code].map((model) => <option key={model} value={model === '-- Select model --' ? '' : model}>{model}</option>)}
          </select>
          {errorFor('model') && <span className="field-error" role="alert">{errorFor('model')}</span>}
        </div>
        <div className="field">
          <label htmlFor={`quantity-${code}-${index}`}>Qty</label>
          <input id={`quantity-${code}-${index}`} className={`input${errorFor('quantity') ? ' input-error' : ''}`} type="text" inputMode="numeric" placeholder="0" value={entry.quantity} onChange={(event) => onChange('quantity', event.target.value)} data-testid={`input-quantity-${code.toLowerCase()}-${index}`} aria-invalid={Boolean(errorFor('quantity'))} />
          {errorFor('quantity') && <span className="field-error" role="alert">{errorFor('quantity')}</span>}
        </div>
        <div className="field">
          <label htmlFor={`price-${code}-${index}`}>Price</label>
          <div className="input-wrap">
            <span className="currency" aria-hidden="true">RM</span>
            <input id={`price-${code}-${index}`} className={`input${errorFor('price') ? ' input-error' : ''}`} type="text" inputMode="decimal" placeholder="0.00" value={entry.price} onChange={(event) => onChange('price', event.target.value)} data-testid={`input-price-${code.toLowerCase()}-${index}`} aria-invalid={Boolean(errorFor('price'))} />
          </div>
          {errorFor('price') && <span className="field-error" role="alert">{errorFor('price')}</span>}
        </div>
        {canRemove && <button className="remove-product" type="button" aria-label={`Remove ${code} model ${index + 1}`} onClick={onRemove} data-testid={`button-remove-${code.toLowerCase()}-${index}`}><Trash2 size={14} /></button>}
      </div>
    </div>
  );
}

function App() {
  const [form, setForm] = useState<ReportForm>(initialForm);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [errors, setErrors] = useState<ErrorMap>({});

  const report = useMemo(() => buildReport(form), [form]);
  const enteredCount = useMemo(
    () => PRODUCT_CODES.reduce((count, code) => count + form.products[code].filter((product) => product.model.trim() && product.quantity.trim()).length, 0),
    [form.products],
  );

  const updateField = (field: keyof Omit<ReportForm, 'products'>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const updateProduct = (code: ProductCode, index: number, field: keyof ProductEntry, value: string) => {
    setForm((current) => ({
      ...current,
      products: {
        ...current.products,
        [code]: current.products[code].map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry),
      },
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next[productErrorKey(code, index, field)];
      return next;
    });
  };
  const addProduct = (code: ProductCode) => {
    setForm((current) => ({
      ...current,
      products: { ...current.products, [code]: [...current.products[code], { model: '', quantity: '', price: '' }] },
    }));
  };
  const removeProduct = (code: ProductCode, index: number) => {
    setForm((current) => ({
      ...current,
      products: { ...current.products, [code]: current.products[code].filter((_, entryIndex) => entryIndex !== index) },
    }));
    setErrors((current) => {
      const next = { ...current };
      Object.keys(next).filter((key) => key.startsWith(`product-${code}-`)).forEach((key) => delete next[key]);
      return next;
    });
  };
  const flash = (message: string) => {
    setFeedbackMessage(message);
    window.setTimeout(() => setFeedbackMessage(''), 2800);
  };
  const validateBeforeSubmit = () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      const targetId = firstError.startsWith('product-')
        ? firstError.replace(/^product-([A-Z]+)-(\d+)-(\w+)$/, '$3-$1-$2')
        : firstError === 'storeName' ? 'store-name' : firstError === 'mtdSales' ? 'mtd-sales' : firstError === 'todaySales' ? 'today-sales' : firstError;
      document.getElementById(targetId)?.focus();
      return;
    }
    return true;
  };
  const submitToWhatsApp = () => {
    if (!validateBeforeSubmit()) return;
    const url = `https://wa.me/?text=${encodeURIComponent(report)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    flash('Report ready — opening WhatsApp.');
  };
  const copyReport = async () => {
    if (!validateBeforeSubmit()) return;
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
    setErrors({});
    flash('Entry cleared. Date reset to today.');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" data-testid="brand-daily-sales">
          <img className="toshiba-logo" src={toshibaLogo} alt="Toshiba" />
        </div>
        <div className="day-chip"><i /> Client-side workspace</div>
      </header>

      <main className="main-grid">
        <div className="form-column">
          <section className="section-card form-card" aria-labelledby="details-title">
            <div className="section-heading"><h2 className="section-title" id="details-title">Report details</h2><span className="section-index">01 / 03</span></div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="store-name">Store name</label>
                <input id="store-name" className={`input${errors.storeName ? ' input-error' : ''}`} type="text" placeholder="e.g. Wah Lee Tanjung Tokong" value={form.storeName} onChange={(event) => updateField('storeName', event.target.value)} data-testid="input-store-name" aria-invalid={Boolean(errors.storeName)} />
                {errors.storeName && <span className="field-error" role="alert" data-testid="error-store-name">{errors.storeName}</span>}
              </div>
              <div className="field">
                <label htmlFor="report-date">Report date</label>
                <input id="report-date" className={`input${errors.date ? ' input-error' : ''}`} type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} data-testid="input-report-date" aria-invalid={Boolean(errors.date)} />
                {errors.date && <span className="field-error" role="alert">{errors.date}</span>}
              </div>
              <div className="field">
                <label htmlFor="target">Target</label>
                <div className="input-wrap"><span className="currency" aria-hidden="true">RM</span><input id="target" className={`input${errors.target ? ' input-error' : ''}`} type="text" inputMode="decimal" placeholder="0.00" value={form.target} onChange={(event) => updateField('target', event.target.value)} data-testid="input-target" aria-invalid={Boolean(errors.target)} /></div>
                {errors.target && <span className="field-error" role="alert">{errors.target}</span>}
              </div>
              <div className="field">
                <label htmlFor="mtd-sales">MTD sales</label>
                <div className="input-wrap"><span className="currency" aria-hidden="true">RM</span><input id="mtd-sales" className={`input${errors.mtdSales ? ' input-error' : ''}`} type="text" inputMode="decimal" placeholder="0.00" value={form.mtdSales} onChange={(event) => updateField('mtdSales', event.target.value)} data-testid="input-mtd-sales" aria-invalid={Boolean(errors.mtdSales)} /></div>
                {errors.mtdSales && <span className="field-error" role="alert">{errors.mtdSales}</span>}
              </div>
              <div className="field">
                <label htmlFor="today-sales">Today's sales</label>
                <div className="input-wrap"><span className="currency" aria-hidden="true">RM</span><input id="today-sales" className={`input${errors.todaySales ? ' input-error' : ''}`} type="text" inputMode="decimal" placeholder="0.00" value={form.todaySales} onChange={(event) => updateField('todaySales', event.target.value)} data-testid="input-today-sales" aria-invalid={Boolean(errors.todaySales)} /></div>
                {errors.todaySales && <span className="field-error" role="alert">{errors.todaySales}</span>}
              </div>
            </div>
          </section>

          <section className="section-card products-card" aria-labelledby="products-title">
            <div className="section-heading"><h2 className="section-title" id="products-title">Product movement</h2><span className="section-index">02 / 03</span></div>
            <p className="products-intro">Only completed rows appear in your summary. Leave a category blank if there was no movement.</p>
            <div className="product-list">
              {PRODUCT_CODES.map((code) => (
                <section className="category-group" key={code} aria-label={`${code} products`}>
                  <div className="category-heading">
                    <div>
                      <span className="category-code">{code}</span>
                    </div>
                    <button className="add-product" type="button" onClick={() => addProduct(code)} data-testid={`button-add-${code.toLowerCase()}`}><Plus size={14} /> Add model</button>
                  </div>
                  {form.products[code].map((entry, index) => (
                    <ProductRow
                      key={`${code}-${index}`}
                      code={code}
                      index={index}
                      entry={entry}
                      errors={errors}
                      canRemove={form.products[code].length > 1}
                      onChange={(field, value) => updateProduct(code, index, field, value)}
                      onRemove={() => removeProduct(code, index)}
                    />
                  ))}
                </section>
              ))}
            </div>
          </section>

          <section className="section-card form-card remarks" aria-labelledby="remarks-title">
            <div className="section-heading"><h2 className="section-title" id="remarks-title">Feedback & remarks</h2><span className="section-index">03 / 03</span></div>
            <div className="field"><label htmlFor="feedback">Anything the group should know <span className="optional">optional</span></label><textarea id="feedback" className="textarea" placeholder="Stock notes, customer requests, wins from the floor..." value={form.feedback} onChange={(event) => updateField('feedback', event.target.value)} data-testid="textarea-feedback" /></div>
            <div className="form-actions">
              <button className="button button-quiet" type="button" onClick={() => setShowClearDialog(true)} data-testid="button-clear-all"><RotateCcw size={15} /> Clear all</button>
              <button className="button button-primary button-whatsapp" type="button" onClick={submitToWhatsApp} data-testid="button-send-whatsapp"><MessageCircle size={17} /> Generate WhatsApp report <Send size={14} /></button>
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
                  <div className="report-line"><dt>Target</dt><dd>{form.target.trim() ? formatRM(form.target) : 'RM 0.00'}</dd></div>
                  <div className="report-line"><dt>MTD Sales</dt><dd>{form.mtdSales.trim() ? formatRM(form.mtdSales) : 'RM 0.00'}</dd></div>
                  <div className="report-line"><dt>Today's Sales</dt><dd>{form.todaySales.trim() ? formatRM(form.todaySales) : 'RM 0.00'}</dd></div>
                </dl>
                <div className="product-preview">
                  <h4 className="product-preview-title">Products / {enteredCount} entered</h4>
                  {enteredCount === 0 && <div className="empty-products" data-testid="text-no-products">(No products entered)</div>}
                  {PRODUCT_CODES.map((code) => {
                    const enteredProducts = form.products[code].filter((product) => product.model.trim() && product.quantity.trim());
                    if (!enteredProducts.length) return null;
                    return (
                      <div className="preview-category" key={code} data-testid={`text-product-preview-${code.toLowerCase()}`}>
                        <div className="preview-category-title"><strong>{code}</strong></div>
                        {enteredProducts.map((product, index) => (
                          <div className="product-preview-line" key={`${code}-${index}`}>
                            <span>{product.model} × {product.quantity}</span>
                            <span>{formatRM(product.price, 'RM 0')}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
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
