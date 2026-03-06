const TECH_COLUMNS = [
  { key: 'nombre', label: 'Nombre', type: 'text', required: true },
  { key: 'rol', label: 'Rol', type: 'text', required: true },
  { key: 'activo', label: 'Activo', type: 'boolean', required: true },
  { key: 'turnos_dia', label: 'Turnos/día', type: 'number', required: true },
  { key: 'horas_turno', label: 'Horas/turno', type: 'number', required: true },
  { key: 'dedicacion_ensayo', label: 'Dedicación', type: 'number', required: true },
  { key: 'eficiencia', label: 'Eficiencia', type: 'number', required: true },
  { key: 'min_efectivos_dia', label: 'Min efectivos/día', type: 'number', required: false }
];

const EQUIP_COLUMNS = [
  { key: 'nombre_equipo', label: 'Nombre equipo', type: 'text', required: true },
  { key: 'tipo_equipo', label: 'Tipo equipo', type: 'text', required: true },
  { key: 'activo', label: 'Activo', type: 'boolean', required: true },
  { key: 'turnos_dia', label: 'Turnos/día', type: 'number', required: true },
  { key: 'horas_turno', label: 'Horas/turno', type: 'number', required: true },
  { key: 'oee', label: 'OEE', type: 'number', required: true },
  { key: 'unidades_en_paralelo', label: 'Unidades paralelo', type: 'number', required: true },
  { key: 'min_efectivos_dia', label: 'Min efectivos/día', type: 'number', required: false },
  { key: 'requiere_rol_operador', label: 'Requiere rol operador', type: 'text', required: false }
];

const TASK_COLUMNS = [
  { key: 'nombre_tarea', label: 'Nombre tarea', type: 'text', required: true },
  { key: 'orden', label: 'Orden', type: 'number', required: true },
  { key: 'min_por_unidad', label: 'Min por unidad', type: 'number', required: true },
  { key: 'modo', label: 'Modo', type: 'text', required: true },
  { key: 'rol_requerido', label: 'Rol requerido', type: 'text', required: false },
  { key: 'tipo_equipo_requerido', label: 'Tipo equipo requerido', type: 'text', required: false },
  { key: 'ratio_persona', label: 'Ratio persona', type: 'number', required: false },
  { key: 'ratio_equipo', label: 'Ratio equipo', type: 'number', required: false }
];

let processes = [];
let activeProcessId = null;
let currentStep = 0;

const els = {
  processSelect: document.getElementById('processSelect'),
  alerts: document.getElementById('alerts'),
  tabButtons: [...document.querySelectorAll('.tab-btn')],
  steps: [...document.querySelectorAll('.wizard-step')],
  prevBtn: document.getElementById('prevStepBtn'),
  nextBtn: document.getElementById('nextStepBtn'),
  baseProcessName: document.getElementById('baseProcessName'),
  baseUnits: document.getElementById('baseUnits'),
  baseDemand: document.getElementById('baseDemand'),
  baseUnitsPerDay: document.getElementById('baseUnitsPerDay'),
  baseExtraJson: document.getElementById('baseExtraJson'),
  techniciansTable: document.getElementById('techniciansTable'),
  equipmentTable: document.getElementById('equipmentTable'),
  tasksTable: document.getElementById('tasksTable'),
  resultCards: document.getElementById('resultCards'),
  resourcesResultTable: document.getElementById('resourcesResultTable'),
  tasksResultTable: document.getElementById('tasksResultTable'),
  excelFileInput: document.getElementById('excelFileInput'),
  jsonFileInput: document.getElementById('jsonFileInput')
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() { return new Date().toISOString(); }

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const v = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'si', 'sí', 'yes', 'y', 'activo'].includes(v);
}

function parseNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function blankProcess(name = `Process ${processes.length + 1}`) {
  return { id: uid(), name, base: {}, technicians: [], equipment: [], tasks: [], lastUpdated: nowIso() };
}

function activeProcess() {
  return processes.find(p => p.id === activeProcessId);
}

function saveActiveBase() {
  const p = activeProcess();
  if (!p) return;
  p.name = els.baseProcessName.value.trim() || p.name;
  p.base.unidades_dia = parseNum(els.baseUnits.value);
  p.base.demanda = parseNum(els.baseDemand.value);
  p.base.units_per_day = parseNum(els.baseUnitsPerDay.value);
  try {
    const extra = els.baseExtraJson.value.trim();
    if (extra) Object.assign(p.base, JSON.parse(extra));
  } catch (e) {
    pushAlert('El JSON de campos base adicionales es inválido.', 'warning');
  }
  p.lastUpdated = nowIso();
}

function renderProcessSelect() {
  els.processSelect.innerHTML = '';
  processes.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    els.processSelect.appendChild(opt);
  });
  els.processSelect.value = activeProcessId;
}

function renderBase() {
  const p = activeProcess();
  if (!p) return;
  els.baseProcessName.value = p.name || '';
  els.baseUnits.value = p.base.unidades_dia ?? '';
  els.baseDemand.value = p.base.demanda ?? '';
  els.baseUnitsPerDay.value = p.base.units_per_day ?? '';
  const known = new Set(['unidades_dia', 'demanda', 'units_per_day']);
  const extra = Object.fromEntries(Object.entries(p.base).filter(([k]) => !known.has(k)));
  els.baseExtraJson.value = Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '';
}

function renderTable(tableEl, columns, rows, rowDeleteHandler) {
  tableEl.innerHTML = '';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  columns.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c.label;
    hr.appendChild(th);
  });
  hr.appendChild(document.createElement('th')).textContent = 'Acciones';
  thead.appendChild(hr);
  tableEl.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    let invalid = false;
    columns.forEach(col => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = col.type === 'number' ? 'number' : 'text';
      if (col.type === 'number') input.step = 'any';
      input.value = row[col.key] ?? '';
      input.dataset.key = col.key;
      input.addEventListener('change', (e) => {
        row[col.key] = e.target.value;
        activeProcess().lastUpdated = nowIso();
      });
      td.appendChild(input);
      tr.appendChild(td);

      const val = row[col.key];
      if (col.required && (val === null || val === undefined || val === '')) invalid = true;
      if (col.type === 'number' && val !== '' && val !== null && parseNum(val) === null) invalid = true;
      if (col.type === 'boolean' && val !== '' && !['true', 'false', '1', '0', 'si', 'sí', 'no', 'yes'].includes(String(val).toLowerCase())) invalid = true;
    });
    if (invalid) tr.classList.add('invalid');

    const actionTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Eliminar fila';
    delBtn.className = 'danger';
    delBtn.addEventListener('click', () => rowDeleteHandler(idx));
    actionTd.appendChild(delBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
  tableEl.appendChild(tbody);
}

function renderAll() {
  renderProcessSelect();
  renderBase();
  const p = activeProcess();
  if (!p) return;
  renderTable(els.techniciansTable, TECH_COLUMNS, p.technicians, idx => { p.technicians.splice(idx, 1); renderAll(); });
  renderTable(els.equipmentTable, EQUIP_COLUMNS, p.equipment, idx => { p.equipment.splice(idx, 1); renderAll(); });
  renderTable(els.tasksTable, TASK_COLUMNS, p.tasks, idx => { p.tasks.splice(idx, 1); renderAll(); });
}

function showStep(step) {
  currentStep = Math.max(0, Math.min(4, step));
  els.tabButtons.forEach((b, i) => b.classList.toggle('active', i === currentStep));
  els.steps.forEach((s, i) => s.classList.toggle('active', i === currentStep));
}

function pushAlert(message, type = 'info') {
  const tpl = document.getElementById('alertTemplate');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.classList.add(type);
  node.querySelector('.alert-text').textContent = message;
  node.querySelector('.close-alert').addEventListener('click', () => node.remove());
  els.alerts.appendChild(node);
}

function mapRowWithColumns(row, columns) {
  const mapped = {};
  const rowNorm = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeKey(k), v]));
  columns.forEach(c => mapped[c.key] = rowNorm[c.key] ?? '');
  return mapped;
}

function parseSheetTable(workbook, name, columns) {
  const sheetName = workbook.SheetNames.find(n => normalizeKey(n) === normalizeKey(name));
  if (!sheetName) throw new Error(`Falta la pestaña "${name}" en el Excel.`);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  return rows.map(r => mapRowWithColumns(r, columns));
}

function parseBaseSheet(workbook) {
  const sheetName = workbook.SheetNames.find(n => normalizeKey(n) === normalizeKey('Datos base'));
  if (!sheetName) throw new Error('Falta la pestaña "Datos base" en el Excel.');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (!rows.length) return {};

  const firstNorm = Object.keys(rows[0]).map(normalizeKey);
  const hasCampoValor = firstNorm.includes('campo') && firstNorm.includes('valor');
  const base = {};
  if (hasCampoValor) {
    rows.forEach(r => {
      const entries = Object.entries(r).map(([k, v]) => [normalizeKey(k), v]);
      const field = entries.find(([k]) => k === 'campo')?.[1];
      const value = entries.find(([k]) => k === 'valor')?.[1];
      if (field) base[normalizeKey(field)] = parseNum(value) ?? value;
    });
  } else {
    Object.entries(rows[0]).forEach(([k, v]) => { base[normalizeKey(k)] = parseNum(v) ?? v; });
  }
  return base;
}

function importExcel(file) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const p = activeProcess();
      p.base = parseBaseSheet(wb);
      p.technicians = parseSheetTable(wb, 'Tecnicos', TECH_COLUMNS);
      p.equipment = parseSheetTable(wb, 'Equipos', EQUIP_COLUMNS);
      p.tasks = parseSheetTable(wb, 'Tareas', TASK_COLUMNS);
      p.lastUpdated = nowIso();
      renderAll();
      calculateAndRender();
      pushAlert('Excel importado correctamente.', 'info');
    } catch (e) {
      pushAlert(`Error al importar Excel: ${e.message}`, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportJson() {
  const data = { processes, activeProcessId, exportedAt: nowIso() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'capacity-wizard-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!Array.isArray(data.processes) || !data.processes.length) throw new Error('El JSON no contiene procesos válidos.');
      processes = data.processes;
      activeProcessId = data.activeProcessId && processes.some(p => p.id === data.activeProcessId)
        ? data.activeProcessId
        : processes[0].id;
      renderAll();
      pushAlert('JSON importado correctamente.', 'info');
    } catch (e) {
      pushAlert(`Error al importar JSON: ${e.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

function safeDemand(base) {
  return parseNum(base.unidades_dia) ?? parseNum(base.demanda) ?? parseNum(base.units_per_day);
}

function calculate(process) {
  const demand = safeDemand(process.base);
  if (!Number.isFinite(demand) || demand <= 0) throw new Error('Demanda no encontrada o inválida en Datos base.');

  const humans = process.technicians
    .filter(t => parseBool(t.activo))
    .map(t => {
      const minEff = parseNum(t.min_efectivos_dia) ?? (parseNum(t.turnos_dia) || 0) * (parseNum(t.horas_turno) || 0) * 60 * (parseNum(t.dedicacion_ensayo) || 0) * (parseNum(t.eficiencia) || 0);
      return { type: 'HUMANO', name: t.nombre || '(sin nombre)', role: String(t.rol || '').trim(), minEff, load: 0 };
    });

  const equips = process.equipment
    .filter(e => parseBool(e.activo))
    .map(e => {
      const minEff = parseNum(e.min_efectivos_dia) ?? (parseNum(e.turnos_dia) || 0) * (parseNum(e.horas_turno) || 0) * 60 * (parseNum(e.oee) || 0) * (parseNum(e.unidades_en_paralelo) || 0);
      return { type: 'EQUIPO', name: e.nombre_equipo || '(sin nombre)', equipmentType: String(e.tipo_equipo || '').trim(), minEff, load: 0 };
    });

  const resources = [...humans, ...equips];
  const tasksSorted = [...process.tasks].sort((a, b) => (parseNum(a.orden) || 0) - (parseNum(b.orden) || 0));
  const taskCaps = [];

  function assignLoad(candidates, load) {
    const valid = candidates.filter(c => c.minEff > 0);
    if (!valid.length) return false;
    const total = valid.reduce((sum, c) => sum + c.minEff, 0);
    valid.forEach(c => c.load += load * (c.minEff / total));
    return true;
  }

  tasksSorted.forEach(task => {
    const minPerUnit = parseNum(task.min_por_unidad);
    const mode = String(task.modo || '').trim().toUpperCase();
    if (!Number.isFinite(minPerUnit) || minPerUnit <= 0) {
      taskCaps.push({ orden: task.orden, nombre_tarea: task.nombre_tarea, modo: mode, cap_tarea: null, limitante: 'inválida' });
      return;
    }

    const load = demand * minPerUnit;
    const humanCandidates = humans.filter(h => h.role && h.role === String(task.rol_requerido || '').trim());
    const equipCandidates = equips.filter(e => e.equipmentType && e.equipmentType === String(task.tipo_equipo_requerido || '').trim());
    let cap = null;
    let limitante = 'N/A';

    if (mode === 'HUMANO') {
      if (!assignLoad(humanCandidates, load)) pushAlert(`Tarea "${task.nombre_tarea}": no hay humanos válidos para rol ${task.rol_requerido}.`, 'warning');
      const hm = humanCandidates.reduce((s, h) => s + Math.max(0, h.minEff), 0);
      cap = hm > 0 ? hm / minPerUnit : 0;
      limitante = 'humano';
    } else if (mode === 'EQUIPO') {
      if (!assignLoad(equipCandidates, load)) pushAlert(`Tarea "${task.nombre_tarea}": no hay equipos válidos para tipo ${task.tipo_equipo_requerido}.`, 'warning');
      const em = equipCandidates.reduce((s, e) => s + Math.max(0, e.minEff), 0);
      cap = em > 0 ? em / minPerUnit : 0;
      limitante = 'equipo';
    } else if (mode === 'MIXTO_AND') {
      const ratioP = parseNum(task.ratio_persona) || 1;
      const ratioE = parseNum(task.ratio_equipo) || 1;
      if (!assignLoad(humanCandidates, load * ratioP)) pushAlert(`Tarea "${task.nombre_tarea}": faltan humanos para modo mixto.`, 'warning');
      if (!assignLoad(equipCandidates, load * ratioE)) pushAlert(`Tarea "${task.nombre_tarea}": faltan equipos para modo mixto.`, 'warning');
      const hm = humanCandidates.reduce((s, h) => s + Math.max(0, h.minEff), 0);
      const em = equipCandidates.reduce((s, e) => s + Math.max(0, e.minEff), 0);
      const capH = hm > 0 ? hm / (minPerUnit * ratioP) : 0;
      const capE = em > 0 ? em / (minPerUnit * ratioE) : 0;
      cap = Math.min(capH, capE);
      limitante = capH <= capE ? 'humano' : 'equipo';
    } else {
      pushAlert(`Tarea "${task.nombre_tarea}": modo inválido (${task.modo}).`, 'warning');
    }

    taskCaps.push({ orden: task.orden, nombre_tarea: task.nombre_tarea, modo: mode, cap_tarea: cap, limitante });
  });

  resources.forEach(r => {
    r.utilization = r.minEff > 0 ? r.load / r.minEff : Infinity;
  });
  resources.sort((a, b) => b.utilization - a.utilization);

  const validCaps = taskCaps.map(t => t.cap_tarea).filter(c => Number.isFinite(c) && c > 0);
  const lineCapacity = validCaps.length ? Math.min(...validCaps) : 0;
  const bottleneck = resources[0] || null;

  return { demand, lineCapacity, bottleneck, resources, taskCaps };
}

function fmt(n, digits = 2) {
  if (!Number.isFinite(n)) return '∞';
  return Number(n).toLocaleString('es-EC', { maximumFractionDigits: digits });
}

function calculateAndRender() {
  const p = activeProcess();
  if (!p) return;
  saveActiveBase();
  try {
    const result = calculate(p);
    renderResults(result);
    pushAlert('Cálculo completado.', 'info');
  } catch (e) {
    renderResults(null);
    pushAlert(`No se pudo calcular: ${e.message}`, 'error');
  }
}

function renderResults(result) {
  els.resultCards.innerHTML = '';
  if (!result) {
    els.resultCards.innerHTML = '<p>Sin resultados.</p>';
    els.resourcesResultTable.innerHTML = '';
    els.tasksResultTable.innerHTML = '';
    return;
  }

  const cards = [
    { title: 'Demanda (unid/día)', value: fmt(result.demand) },
    { title: 'Capacidad máxima línea', value: fmt(result.lineCapacity) },
    {
      title: 'Bottleneck',
      value: result.bottleneck ? `${result.bottleneck.name} (${fmt(result.bottleneck.utilization * 100)}%)` : 'N/A'
    }
  ];
  cards.forEach(c => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<div class="title">${c.title}</div><div class="value">${c.value}</div>`;
    els.resultCards.appendChild(d);
  });

  els.resourcesResultTable.innerHTML = '<thead><tr><th>Tipo</th><th>Nombre</th><th>MinEff</th><th>Carga</th><th>Utilización</th></tr></thead>';
  const rb = document.createElement('tbody');
  result.resources.forEach(r => {
    const tr = document.createElement('tr');
    const utilPct = r.utilization * 100;
    const utilClass = utilPct > 90 ? 'util-high' : utilPct >= 80 ? 'util-mid' : '';
    tr.innerHTML = `<td>${r.type}</td><td>${r.name}</td><td>${fmt(r.minEff)}</td><td>${fmt(r.load)}</td><td class="${utilClass}">${fmt(utilPct)}%</td>`;
    rb.appendChild(tr);
  });
  els.resourcesResultTable.appendChild(rb);

  els.tasksResultTable.innerHTML = '<thead><tr><th>Orden</th><th>Nombre</th><th>Modo</th><th>Cap tarea (unid/día)</th><th>Recurso limitante</th></tr></thead>';
  const tb = document.createElement('tbody');
  result.taskCaps.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.orden ?? ''}</td><td>${t.nombre_tarea ?? ''}</td><td>${t.modo ?? ''}</td><td>${t.cap_tarea === null ? 'N/A' : fmt(t.cap_tarea)}</td><td>${t.limitante}</td>`;
    tb.appendChild(tr);
  });
  els.tasksResultTable.appendChild(tb);
}

function bindEvents() {
  document.getElementById('newProcessBtn').addEventListener('click', () => {
    saveActiveBase();
    const p = blankProcess();
    processes.push(p);
    activeProcessId = p.id;
    renderAll();
  });

  document.getElementById('duplicateProcessBtn').addEventListener('click', () => {
    const p = activeProcess();
    if (!p) return;
    const clone = JSON.parse(JSON.stringify(p));
    clone.id = uid();
    clone.name = `${p.name} (copia)`;
    clone.lastUpdated = nowIso();
    processes.push(clone);
    activeProcessId = clone.id;
    renderAll();
  });

  document.getElementById('deleteProcessBtn').addEventListener('click', () => {
    if (processes.length <= 1) return pushAlert('Debe existir al menos un proceso.', 'warning');
    processes = processes.filter(p => p.id !== activeProcessId);
    activeProcessId = processes[0].id;
    renderAll();
  });

  els.processSelect.addEventListener('change', (e) => {
    saveActiveBase();
    activeProcessId = e.target.value;
    renderAll();
  });

  els.tabButtons.forEach(btn => btn.addEventListener('click', () => showStep(Number(btn.dataset.step))));
  els.prevBtn.addEventListener('click', () => showStep(currentStep - 1));
  els.nextBtn.addEventListener('click', () => showStep(currentStep + 1));

  [els.baseProcessName, els.baseUnits, els.baseDemand, els.baseUnitsPerDay, els.baseExtraJson].forEach(el => {
    el.addEventListener('change', saveActiveBase);
  });

  document.getElementById('addTechnicianRow').addEventListener('click', () => {
    activeProcess().technicians.push(Object.fromEntries(TECH_COLUMNS.map(c => [c.key, ''])));
    renderAll();
  });
  document.getElementById('addEquipmentRow').addEventListener('click', () => {
    activeProcess().equipment.push(Object.fromEntries(EQUIP_COLUMNS.map(c => [c.key, ''])));
    renderAll();
  });
  document.getElementById('addTaskRow').addEventListener('click', () => {
    activeProcess().tasks.push(Object.fromEntries(TASK_COLUMNS.map(c => [c.key, ''])));
    renderAll();
  });

  document.getElementById('calculateBtn').addEventListener('click', calculateAndRender);

  document.getElementById('importExcelBtn').addEventListener('click', () => els.excelFileInput.click());
  els.excelFileInput.addEventListener('change', (e) => {
    const [file] = e.target.files;
    if (file) importExcel(file);
    e.target.value = '';
  });

  document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
  document.getElementById('importJsonBtn').addEventListener('click', () => els.jsonFileInput.click());
  els.jsonFileInput.addEventListener('change', (e) => {
    const [file] = e.target.files;
    if (file) importJson(file);
    e.target.value = '';
  });
}

function init() {
  const p = blankProcess('Process A');
  processes = [p];
  activeProcessId = p.id;
  bindEvents();
  renderAll();
  showStep(0);
}

init();
