'use strict';

const form           = document.getElementById('audit-form');
const submitBtn      = document.getElementById('submit-btn');
const alertBox       = document.getElementById('alert-box');
const loading        = document.getElementById('loading');
const resultsSection = document.getElementById('results-section');
const tbody          = document.getElementById('results-tbody');
const exportBtn      = document.getElementById('export-btn');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const statTotalPages    = document.getElementById('stat-total-pages');
const statClientPages   = document.getElementById('stat-client-pages');
const statInternalPages = document.getElementById('stat-internal-pages');
const statAnomalies     = document.getElementById('stat-anomalies');
const statAnomaliesCard = document.getElementById('stat-anomalies-card');

function initDropZone(inputId, dropId, nameId) {
  const input    = document.getElementById(inputId);
  const dropZone = document.getElementById(dropId);
  const nameEl   = document.getElementById(nameId);

  function setFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { showAlert('Sono accettati solo file PDF.'); return; }
    nameEl.textContent = file.name;
    dropZone.classList.add('has-file');
  }

  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', ()  => { dropZone.classList.remove('drag-over'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; setFile(file); }
  });
  input.addEventListener('change', () => setFile(input.files[0]));
}

initDropZone('task-card-input', 'drop-tc',  'tc-name');
initDropZone('manual-input',    'drop-man', 'man-name');

function showAlert(msg) {
  alertBox.textContent = msg;
  alertBox.classList.remove('hidden');
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideAlert() { alertBox.textContent = ''; alertBox.classList.add('hidden'); }

let stepTimer = null;
function startLoadingAnimation() {
  let phase = 0;
  step1.className = 'step active'; step2.className = 'step'; step3.className = 'step';
  stepTimer = setInterval(() => {
    phase++;
    if (phase === 1) { step1.className = 'step done'; step2.className = 'step active'; }
    else if (phase === 2) { step2.className = 'step done'; step3.className = 'step active'; }
    else clearInterval(stepTimer);
  }, 4000);
}
function stopLoadingAnimation() {
  clearInterval(stepTimer);
  step1.className = 'step done'; step2.className = 'step done'; step3.className = 'step done';
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderResults(results) {
  tbody.innerHTML = '';
  results.forEach((page) => {
    const isInternal = (page.tipo_modulo || '').toLowerCase() === 'interno';
    const anomalies  = Array.isArray(page.anomalie) ? page.anomalie : [];
    const rowClass   = isInternal ? 'row-internal' : (anomalies.length > 0 ? 'row-anomaly' : 'row-ok');

    if (anomalies.length === 0) {
      const tr = document.createElement('tr');
      tr.className = rowClass;
      tr.innerHTML = `
        <td class="page-num">${esc(page.pagina)}</td>
        <td><div>${esc(page.modulo||'—')}</div>${isInternal ? '<span class="badge-internal">Modulo Interno</span>' : '<span class="badge-ok">Conforme</span>'}</td>
        <td colspan="3" style="color:var(--gray);font-style:italic">${isInternal ? 'Pagina interna — non sottoposta ad audit' : 'Nessuna anomalia rilevata'}</td>`;
      tbody.appendChild(tr);
    } else {
      anomalies.forEach((a, idx) => {
        const tr = document.createElement('tr');
        tr.className = rowClass;
        tr.innerHTML = `
          <td class="page-num">${idx === 0 ? esc(page.pagina) : ''}</td>
          <td>${idx === 0 ? `<div>${esc(page.modulo||'—')}</div><span class="badge-anomaly">Non Conforme</span>` : ''}</td>
          <td><span class="anomaly-text">${esc(a.anomalia)}</span></td>
          <td><span class="zone-text">${esc(a.zona_posizione)}</span></td>
          <td><span class="ref-text">${esc(a.riferimento_manuale)}</span></td>`;
        tbody.appendChild(tr);
      });
    }
  });
  if (!tbody.children.length) {
    const tr = document.createElement('tr');
    tr.className = 'no-anomalies-row';
    tr.innerHTML = '<td colspan="5">Nessun risultato disponibile.</td>';
    tbody.appendChild(tr);
  }
}

exportBtn.addEventListener('click', () => {
  const now = new Date().toLocaleString('it-IT');
  const blob = new Blob([`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>MRO Audit Report — ${now}</title><style>
body{font-family:system-ui,sans-serif;background:#f0f4f8;color:#1a2a3a;padding:2rem}
h1{color:#1A3A5C;margin-bottom:1rem}.meta{color:#546070;font-size:.85rem;margin-bottom:1.5rem}
.stats-bar{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}
.stat-card{background:#fff;border:1px solid #c8d8e8;border-radius:8px;padding:1rem;min-width:120px;text-align:center}
.stat-value{display:block;font-size:1.8rem;font-weight:700;color:#1A3A5C}
.stat-label{display:block;font-size:.7rem;color:#546070;text-transform:uppercase;letter-spacing:.06em}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.1)}
th{background:#1A3A5C;color:#4A9EFF;padding:.7rem .9rem;text-align:left;font-size:.72rem;text-transform:uppercase}
td{padding:.65rem .9rem;vertical-align:top;border-bottom:1px solid #e2eaf4;font-size:.82rem;line-height:1.5}
tr:last-child td{border-bottom:none}
.badge-ok{background:#f0fff4;color:#276749;display:inline-block;padding:.15rem .55rem;border-radius:20px;font-size:.68rem;font-weight:700}
.badge-internal{background:#f0f4f8;color:#546070;display:inline-block;padding:.15rem .55rem;border-radius:20px;font-size:.68rem;font-weight:700}
.badge-anomaly{background:#fff5f5;color:#e53e3e;display:inline-block;padding:.15rem .55rem;border-radius:20px;font-size:.68rem;font-weight:700}
.anomaly-text{color:#C53030;font-weight:500}.zone-text{color:#744210;font-family:monospace;font-size:.78rem}
.ref-text{color:#2B6CB0;font-style:italic;font-size:.8rem}.page-num{font-weight:700;font-size:.9rem}
</style></head><body>
<h1>MRO Smart Auditor — Report di Conformità</h1>
<p class="meta">Generato il ${now} — EASA Part-145 Compliance Audit</p>
${document.getElementById('stats-bar').outerHTML}
${document.getElementById('results-table').outerHTML}
</body></html>`], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `MRO_Audit_Report_${new Date().toISOString().slice(0,10)}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();
  const tcInput  = document.getElementById('task-card-input');
  const manInput = document.getElementById('manual-input');
  const apiKey   = document.getElementById('api-key').value.trim();

  if (!tcInput.files.length)  { showAlert('Seleziona il file PDF della Task Card.'); return; }
  if (!manInput.files.length) { showAlert('Seleziona il file PDF del Manuale Istruzioni Cliente.'); return; }

  submitBtn.disabled = true;
  resultsSection.classList.add('hidden');
  loading.classList.remove('hidden');
  startLoadingAnimation();

  const fd = new FormData();
  fd.append('task_card', tcInput.files[0]);
  fd.append('instructions_manual', manInput.files[0]);
  if (apiKey) fd.append('api_key', apiKey);

  try {
    const resp = await fetch('/analyze', { method: 'POST', body: fd });
    const data = await resp.json();
    stopLoadingAnimation();
    loading.classList.add('hidden');

    if (!resp.ok || data.error) { showAlert('Errore: ' + (data.error || 'Risposta inattesa.')); return; }

    const s = data.stats;
    statTotalPages.textContent    = s.total_pages;
    statClientPages.textContent   = s.client_pages;
    statInternalPages.textContent = s.internal_pages;
    statAnomalies.textContent     = s.total_anomalies;

    if (s.total_anomalies > 0) {
      statAnomaliesCard.classList.add('stat-card--danger');
      statAnomaliesCard.classList.remove('stat-card--highlight');
    } else {
      statAnomaliesCard.classList.remove('stat-card--danger');
      statAnomaliesCard.classList.add('stat-card--highlight');
    }

    renderResults(data.results);
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    stopLoadingAnimation();
    loading.classList.add('hidden');
    showAlert('Errore di rete: ' + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});
