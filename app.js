/*
  Aplicación estática de capacidad técnica para laboratorio.
  Todo el código está en JavaScript vanilla y se apoya en localStorage.
*/

// Estado central de la aplicación.
const estado = {
  pnt: {
    nombreEnsayo: "",
    pntAgq: "",
    demandaDiaria: "",
    turnosDia: 1,
    diasSemana: 5,
    mermas: "85",
    objetivoTat: "24h",
    horasTurnoGlobal: 8,
    dedicacionGlobal: "80",
    eficienciaGlobalPersonal: "85",
    eficienciaGlobalEquipo: "90",
    tamanoBatch: 24
  },
  tecnicos: [],
  equipos: [],
  tareas: [],
  resultados: null
};

// Configuración de claves y utilidades base.
const STORAGE_KEY = "capacidad_laboratorio_v1";
const $ = (sel) => document.querySelector(sel);

// Normaliza porcentajes aceptando 85, 0.85 o texto vacío.
function normalizarPorcentaje(valor, fallback = null) {
  if (valor === null || valor === undefined || valor === "") return fallback;
  const numero = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero)) return fallback;
  if (numero > 1) return numero / 100;
  if (numero >= 0) return numero;
  return fallback;
}

// Convierte a número positivo o devuelve null.
function aNumero(valor) {
  if (valor === "" || valor === null || valor === undefined) return null;
  const num = Number(String(valor).replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

// Redondeo visual para tablas y KPIs.
function redondear(valor, decimales = 2) {
  if (!Number.isFinite(valor)) return "-";
  return Number(valor).toFixed(decimales);
}

// Semáforo de utilización para operación.
function estadoSemaforo(utilizacion) {
  if (!Number.isFinite(utilizacion)) return "-";
  if (utilizacion <= 0.85) return "Verde";
  if (utilizacion <= 0.95) return "Ámbar";
  return "Rojo";
}

// Muestra alertas operativas en interfaz.
function mostrarAlertas(mensajes = [], esError = false) {
  const cont = $("#alertas");
  cont.innerHTML = "";
  mensajes.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `alerta ${esError ? "error" : ""}`;
    div.textContent = msg;
    cont.appendChild(div);
  });
}

// Cálculo de minutos disponibles diarios por técnico.
function calcularMinutosTecnicos(pnt, tecnicos) {
  return tecnicos.map((t) => {
    const activo = String(t.activo || "NO").toUpperCase() === "SI";
    if (!activo) return { ...t, minutosDisponiblesDia: 0 };

    const horasTurno = aNumero(t.horasTurno) ?? aNumero(pnt.horasTurnoGlobal) ?? 0;
    const dedicacion = normalizarPorcentaje(t.dedicacion, normalizarPorcentaje(pnt.dedicacionGlobal, 0));
    const eficiencia = normalizarPorcentaje(t.eficiencia, normalizarPorcentaje(pnt.eficienciaGlobalPersonal, 0.85));

    const minutosDisponiblesDia = 60 * horasTurno * dedicacion * eficiencia;
    return { ...t, minutosDisponiblesDia };
  });
}

// Cálculo de minutos efectivos diarios por equipo.
function calcularMinutosEquipos(pnt, equipos) {
  return equipos.map((e) => {
    const activo = String(e.activo || "NO").toUpperCase() === "SI";
    if (!activo) return { ...e, minutosEfectivosDia: 0 };

    const minutosDia = aNumero(e.minutosDisponiblesDia) ?? 0;
    const dedicacion = normalizarPorcentaje(e.dedicacion, normalizarPorcentaje(pnt.dedicacionGlobal, 0));
    const eficiencia = normalizarPorcentaje(e.eficiencia, normalizarPorcentaje(pnt.eficienciaGlobalEquipo, 0.9));

    const minutosEfectivosDia = minutosDia * dedicacion * eficiencia;
    return { ...e, minutosEfectivosDia };
  });
}

// Minutos por muestra para cada tarea, usando tiempo directo o equivalencia batch.
function calcularMinutosPorMuestraTarea(tarea) {
  const tiempoMuestra = aNumero(tarea.tiempoMuestra);
  if (tiempoMuestra && tiempoMuestra > 0) return tiempoMuestra;
  const muestrasBatch = aNumero(tarea.muestrasBatch);
  const tiempoBatch = aNumero(tarea.tiempoBatch);
  if (!muestrasBatch || muestrasBatch <= 0 || !tiempoBatch || tiempoBatch <= 0) return null;
  return tiempoBatch / muestrasBatch;
}

// Carga de minutos requeridos por técnico considerando solo tareas bloqueantes.
function calcularCargaTecnicos(tecnicosCalculados, tareas) {
  const mapa = new Map(tecnicosCalculados.map((t) => [t.idTecnico, 0]));

  tareas.forEach((tarea) => {
    const bloqueante = String(tarea.bloqueante || "NO").toUpperCase() === "SI";
    if (!bloqueante) return;

    const recurso = String(tarea.recurso || "").toUpperCase();
    const consumeTecnico = recurso === "TECNICO" || recurso === "AMBOS";
    if (!consumeTecnico) return;

    const minPorMuestra = calcularMinutosPorMuestraTarea(tarea);
    if (!Number.isFinite(minPorMuestra)) return;

    const idTecnico = tarea.tecnicoAsignado;
    if (!mapa.has(idTecnico)) return;
    mapa.set(idTecnico, mapa.get(idTecnico) + minPorMuestra);
  });

  return tecnicosCalculados.map((t) => {
    const minReq = mapa.get(t.idTecnico) ?? 0;
    const capacidad = minReq > 0 ? t.minutosDisponiblesDia / minReq : null;
    return { ...t, minRequeridosPorMuestra: minReq, capacidadMuestrasDia: capacidad };
  });
}

// Carga de minutos requeridos por equipo con capacidad nominal opcional.
function calcularCargaEquipos(equiposCalculados, tareas) {
  const mapa = new Map(equiposCalculados.map((e) => [e.idEquipo, 0]));

  tareas.forEach((tarea) => {
    const bloqueante = String(tarea.bloqueante || "NO").toUpperCase() === "SI";
    if (!bloqueante) return;

    const recurso = String(tarea.recurso || "").toUpperCase();
    const consumeEquipo = recurso === "EQUIPO" || recurso === "AMBOS";
    if (!consumeEquipo) return;

    const minPorMuestra = calcularMinutosPorMuestraTarea(tarea);
    if (!Number.isFinite(minPorMuestra)) return;

    const idsEquipos = String(tarea.equiposAsignados || "").split(",").map((x) => x.trim()).filter(Boolean);
    idsEquipos.forEach((id) => {
      if (mapa.has(id)) mapa.set(id, mapa.get(id) + minPorMuestra);
    });
  });

  return equiposCalculados.map((e) => {
    const minReq = mapa.get(e.idEquipo) ?? 0;
    const capacidadPorMinutos = minReq > 0 ? e.minutosEfectivosDia / minReq : null;
    const nominal = aNumero(e.capacidadNominal);
    const capacidadFinal = Number.isFinite(capacidadPorMinutos)
      ? (Number.isFinite(nominal) ? Math.min(capacidadPorMinutos, nominal) : capacidadPorMinutos)
      : null;

    return {
      ...e,
      minRequeridosPorMuestra: minReq,
      capacidadPorMinutos,
      capacidadMuestrasDia: capacidadFinal
    };
  });
}

// Capacidad final del proceso tomando el mínimo entre recursos limitantes válidos.
function calcularCapacidadProceso(tecnicosConCarga, equiposConCarga) {
  const capacidades = [];
  tecnicosConCarga.forEach((t) => {
    if (Number.isFinite(t.capacidadMuestrasDia) && t.minRequeridosPorMuestra > 0) capacidades.push({ ...t, tipo: "TECNICO" });
  });
  equiposConCarga.forEach((e) => {
    if (Number.isFinite(e.capacidadMuestrasDia) && e.minRequeridosPorMuestra > 0) capacidades.push({ ...e, tipo: "EQUIPO" });
  });

  if (!capacidades.length) return { capacidadProcesoMuestrasDia: null, recursoLimitante: null, listaLimitantes: [] };
  const limitante = capacidades.reduce((min, actual) => (actual.capacidadMuestrasDia < min.capacidadMuestrasDia ? actual : min));
  return {
    capacidadProcesoMuestrasDia: limitante.capacidadMuestrasDia,
    recursoLimitante: limitante,
    listaLimitantes: capacidades
  };
}

// Cálculo de utilización de técnicos y equipos para una demanda diaria dada.
function calcularUtilizaciones(demandaDiaria, tecnicosConCarga, equiposConCarga) {
  const tecnicos = tecnicosConCarga.map((t) => {
    const util = t.minutosDisponiblesDia > 0
      ? (demandaDiaria * t.minRequeridosPorMuestra) / t.minutosDisponiblesDia
      : null;
    return { ...t, utilizacion: util };
  });

  const equipos = equiposConCarga.map((e) => {
    const util = e.minutosEfectivosDia > 0
      ? (demandaDiaria * e.minRequeridosPorMuestra) / e.minutosEfectivosDia
      : null;
    return { ...e, utilizacion: util };
  });

  return { tecnicos, equipos };
}

// Detecta recurso cuello de botella y etapas causantes.
function detectarCuelloBotella(utilizaciones, tareas) {
  const recursos = [];
  utilizaciones.tecnicos.forEach((t) => {
    if (Number.isFinite(t.utilizacion)) recursos.push({ id: t.idTecnico, nombre: t.nombreTecnico, tipo: "TECNICO", utilizacion: t.utilizacion });
  });
  utilizaciones.equipos.forEach((e) => {
    if (Number.isFinite(e.utilizacion)) recursos.push({ id: e.idEquipo, nombre: e.tipoEquipo, tipo: "EQUIPO", utilizacion: e.utilizacion });
  });
  if (!recursos.length) return null;

  const cuello = recursos.reduce((max, r) => (r.utilizacion > max.utilizacion ? r : max));
  const etapas = tareas.filter((t) => {
    const bloqueante = String(t.bloqueante || "NO").toUpperCase() === "SI";
    if (!bloqueante) return false;
    if (cuello.tipo === "TECNICO") return t.tecnicoAsignado === cuello.id;
    return String(t.equiposAsignados || "").split(",").map((x) => x.trim()).includes(cuello.id);
  }).map((t) => `${t.idEtapa} - ${t.nombreEtapa}`);

  return { ...cuello, etapas };
}

// Render principal de tablas editables.
function renderTablas() {
  renderTablaTecnicos();
  renderTablaEquipos();
  renderTablaTareas();
}

function crearCeldaInput(valor, onChange, tipo = "text") {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = tipo;
  input.value = valor ?? "";
  input.addEventListener("input", (e) => onChange(e.target.value));
  td.appendChild(input);
  return td;
}

function crearCeldaSelect(valor, opciones, onChange) {
  const td = document.createElement("td");
  const select = document.createElement("select");
  opciones.forEach((op) => {
    const o = document.createElement("option");
    o.value = op;
    o.textContent = op;
    if (op === valor) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener("change", (e) => onChange(e.target.value));
  td.appendChild(select);
  return td;
}

function renderTablaTecnicos() {
  const tabla = $("#tablaTecnicos");
  tabla.innerHTML = "";
  const head = document.createElement("tr");
  ["Id Técnico", "Nombre", "Horas por turno", "Horas semana", "Dedicación %", "Eficiencia %", "Activo", "Minutos disponibles/día", "Acción"].forEach((h) => {
    const th = document.createElement("th"); th.textContent = h; head.appendChild(th);
  });
  tabla.appendChild(head);

  estado.tecnicos.forEach((t, i) => {
    const tr = document.createElement("tr");
    tr.appendChild(crearCeldaInput(t.idTecnico, (v) => { t.idTecnico = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(t.nombreTecnico, (v) => { t.nombreTecnico = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(t.horasTurno, (v) => { t.horasTurno = v; recalcular(); }, "number"));
    tr.appendChild(crearCeldaInput(t.horasSemana, (v) => { t.horasSemana = v; recalcular(); }, "number"));
    tr.appendChild(crearCeldaInput(t.dedicacion, (v) => { t.dedicacion = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(t.eficiencia, (v) => { t.eficiencia = v; recalcular(); }));
    tr.appendChild(crearCeldaSelect(t.activo || "SI", ["SI", "NO"], (v) => { t.activo = v; recalcular(); }));

    const tdMin = document.createElement("td");
    tdMin.textContent = redondear(t.minutosDisponiblesDia, 1);
    tr.appendChild(tdMin);

    const tdAcc = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = "Eliminar";
    btn.onclick = () => { estado.tecnicos.splice(i, 1); recalcular(); };
    tdAcc.appendChild(btn);
    tr.appendChild(tdAcc);

    tabla.appendChild(tr);
  });
}

function renderTablaEquipos() {
  const tabla = $("#tablaEquipos");
  tabla.innerHTML = "";
  const head = document.createElement("tr");
  ["Id equipo", "Tipo", "Agrupar", "Minutos día", "Capacidad nominal", "Dedicación %", "Eficiencia %", "Activo", "Minutos efectivos/día", "Acción"].forEach((h) => {
    const th = document.createElement("th"); th.textContent = h; head.appendChild(th);
  });
  tabla.appendChild(head);

  estado.equipos.forEach((e, i) => {
    const tr = document.createElement("tr");
    tr.appendChild(crearCeldaInput(e.idEquipo, (v) => { e.idEquipo = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(e.tipoEquipo, (v) => { e.tipoEquipo = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(e.agrupar, (v) => { e.agrupar = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(e.minutosDisponiblesDia, (v) => { e.minutosDisponiblesDia = v; recalcular(); }, "number"));
    tr.appendChild(crearCeldaInput(e.capacidadNominal, (v) => { e.capacidadNominal = v; recalcular(); }, "number"));
    tr.appendChild(crearCeldaInput(e.dedicacion, (v) => { e.dedicacion = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(e.eficiencia, (v) => { e.eficiencia = v; recalcular(); }));
    tr.appendChild(crearCeldaSelect(e.activo || "SI", ["SI", "NO"], (v) => { e.activo = v; recalcular(); }));

    const tdMin = document.createElement("td");
    tdMin.textContent = redondear(e.minutosEfectivosDia, 1);
    tr.appendChild(tdMin);

    const tdAcc = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = "Eliminar";
    btn.onclick = () => { estado.equipos.splice(i, 1); recalcular(); };
    tdAcc.appendChild(btn);
    tr.appendChild(tdAcc);

    tabla.appendChild(tr);
  });
}

function renderTablaTareas() {
  const tabla = $("#tablaTareas");
  tabla.innerHTML = "";
  const head = document.createElement("tr");
  ["Id etapa", "Nombre etapa", "Dependencia", "Recursos", "Tiempo min/muestra", "Muestras/batch", "Tiempo min/batch", "Técnico asignado", "Equipo(s) asignado(s)", "Bloqueante", "Min/muestra calc.", "Acción"].forEach((h) => {
    const th = document.createElement("th"); th.textContent = h; head.appendChild(th);
  });
  tabla.appendChild(head);

  estado.tareas.forEach((t, i) => {
    const tr = document.createElement("tr");
    tr.appendChild(crearCeldaInput(t.idEtapa, (v) => { t.idEtapa = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(t.nombreEtapa, (v) => { t.nombreEtapa = v; recalcular(); }));
    tr.appendChild(crearCeldaSelect(t.dependencia || "FIN_ANTERIOR", ["FIN_ANTERIOR", "INICIO_ANTERIOR"], (v) => { t.dependencia = v; recalcular(); }));
    tr.appendChild(crearCeldaSelect(t.recurso || "TECNICO", ["TECNICO", "EQUIPO", "AMBOS"], (v) => { t.recurso = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(t.tiempoMuestra, (v) => { t.tiempoMuestra = v; recalcular(); }, "number"));
    tr.appendChild(crearCeldaInput(t.muestrasBatch, (v) => { t.muestrasBatch = v; recalcular(); }, "number"));
    tr.appendChild(crearCeldaInput(t.tiempoBatch, (v) => { t.tiempoBatch = v; recalcular(); }, "number"));
    tr.appendChild(crearCeldaInput(t.tecnicoAsignado, (v) => { t.tecnicoAsignado = v; recalcular(); }));
    tr.appendChild(crearCeldaInput(t.equiposAsignados, (v) => { t.equiposAsignados = v; recalcular(); }));
    tr.appendChild(crearCeldaSelect(t.bloqueante || "SI", ["SI", "NO"], (v) => { t.bloqueante = v; recalcular(); }));

    const tdCalc = document.createElement("td");
    tdCalc.textContent = redondear(calcularMinutosPorMuestraTarea(t), 2);
    tr.appendChild(tdCalc);

    const tdAcc = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = "Eliminar";
    btn.onclick = () => { estado.tareas.splice(i, 1); recalcular(); };
    tdAcc.appendChild(btn);
    tr.appendChild(tdAcc);

    tabla.appendChild(tr);
  });
}

// Render de KPIs ejecutivos.
function renderKPIs(resultados) {
  const cont = $("#kpis");
  cont.innerHTML = "";
  if (!resultados) return;

  const kpis = [
    ["Capacidad proceso (muestras/día)", redondear(resultados.capacidadProcesoMuestrasDia, 2)],
    ["Capacidad proceso (batches/día)", redondear(resultados.batchesDia, 2)],
    ["Capacidad proceso (muestras/semana)", redondear(resultados.capacidadSemanal, 2)],
    ["Demanda diaria", redondear(resultados.demandaDiaria, 2)],
    ["Gap capacidad vs demanda", redondear(resultados.gap, 2)],
    ["Recurso cuello de botella", resultados.cuello?.nombre || "-"],
    ["Tipo de cuello", resultados.cuello?.tipo || "-"],
    ["Etapa causante", (resultados.cuello?.etapas || []).join(" | ") || "-"],
    ["Utilización máxima", Number.isFinite(resultados.cuello?.utilizacion) ? `${redondear(resultados.cuello.utilizacion * 100, 1)}%` : "-"],
    ["Cumplimiento demanda", resultados.cumpleDemanda ? "SI" : "NO"],
    ["Riesgo TAT", resultados.riesgoTat]
  ];

  kpis.forEach(([titulo, valor]) => {
    const card = document.createElement("article");
    card.className = "kpi";
    card.innerHTML = `<h4>${titulo}</h4><p>${valor}</p>`;
    cont.appendChild(card);
  });
}

// Render de tablas resumen de técnicos y equipos.
function renderResumenes(resultados) {
  const t = $("#resumenTecnicos");
  const e = $("#resumenEquipos");
  t.innerHTML = "";
  e.innerHTML = "";
  if (!resultados) return;

  t.innerHTML = `<tr><th>Id Técnico</th><th>Nombre</th><th>Minutos disponibles/día</th><th>Min requeridos/muestra</th><th>Muestras máx./día</th><th>Utilización %</th><th>Semáforo</th></tr>`;
  resultados.utilizaciones.tecnicos.forEach((x) => {
    const util = Number.isFinite(x.utilizacion) ? x.utilizacion * 100 : null;
    const s = estadoSemaforo(x.utilizacion);
    const clase = s === "Verde" ? "estado-verde" : s === "Ámbar" ? "estado-ambar" : "estado-rojo";
    t.innerHTML += `<tr><td>${x.idTecnico || "-"}</td><td>${x.nombreTecnico || "-"}</td><td>${redondear(x.minutosDisponiblesDia, 1)}</td><td>${redondear(x.minRequeridosPorMuestra, 2)}</td><td>${redondear(x.capacidadMuestrasDia, 2)}</td><td>${util === null ? "-" : redondear(util, 1) + "%"}</td><td class="${clase}">${s}</td></tr>`;
  });

  e.innerHTML = `<tr><th>Id Equipo</th><th>Tipo</th><th>Minutos efectivos/día</th><th>Min requeridos/muestra</th><th>Capacidad nominal</th><th>Muestras máx./día</th><th>Utilización %</th><th>Semáforo</th></tr>`;
  resultados.utilizaciones.equipos.forEach((x) => {
    const util = Number.isFinite(x.utilizacion) ? x.utilizacion * 100 : null;
    const s = estadoSemaforo(x.utilizacion);
    const clase = s === "Verde" ? "estado-verde" : s === "Ámbar" ? "estado-ambar" : "estado-rojo";
    e.innerHTML += `<tr><td>${x.idEquipo || "-"}</td><td>${x.tipoEquipo || "-"}</td><td>${redondear(x.minutosEfectivosDia, 1)}</td><td>${redondear(x.minRequeridosPorMuestra, 2)}</td><td>${redondear(aNumero(x.capacidadNominal), 2)}</td><td>${redondear(x.capacidadMuestrasDia, 2)}</td><td>${util === null ? "-" : redondear(util, 1) + "%"}</td><td class="${clase}">${s}</td></tr>`;
  });
}

// Gráficos simples de barras en Canvas nativo.
function renderGraficos(resultados) {
  const recursos = [
    ...resultados.utilizaciones.tecnicos.map((t) => ({ nombre: `T:${t.idTecnico}`, capacidad: t.capacidadMuestrasDia, util: t.utilizacion, id: t.idTecnico, tipo: "TECNICO" })),
    ...resultados.utilizaciones.equipos.map((x) => ({ nombre: `E:${x.idEquipo}`, capacidad: x.capacidadMuestrasDia, util: x.utilizacion, id: x.idEquipo, tipo: "EQUIPO" }))
  ];

  dibujarBarras($("#graficoCapacidad"), recursos.map((r) => ({
    etiqueta: r.nombre,
    valor: r.capacidad,
    color: resultados.cuello && r.id === resultados.cuello.id && r.tipo === resultados.cuello.tipo ? "#b91c1c" : "#1d7bbf"
  })), "muestras/día");

  dibujarBarras($("#graficoUtilizacion"), recursos.map((r) => ({
    etiqueta: r.nombre,
    valor: Number.isFinite(r.util) ? r.util * 100 : 0,
    color: resultados.cuello && r.id === resultados.cuello.id && r.tipo === resultados.cuello.tipo ? "#b91c1c" : "#15803d"
  })), "%");
}

function dibujarBarras(canvas, items, unidad) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!items.length) return;

  const margen = 40;
  const baseY = canvas.height - margen;
  const ancho = (canvas.width - margen * 2) / items.length;
  const max = Math.max(...items.map((i) => Number.isFinite(i.valor) ? i.valor : 0), 1);

  ctx.font = "12px sans-serif";
  items.forEach((item, idx) => {
    const h = ((item.valor || 0) / max) * (canvas.height - 90);
    const x = margen + idx * ancho + 8;
    const y = baseY - h;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y, ancho - 16, h);

    ctx.fillStyle = "#111827";
    ctx.fillText(item.etiqueta, x, baseY + 14);
    ctx.fillText(`${redondear(item.valor, 1)} ${unidad}`, x, y - 6);
  });

  ctx.strokeStyle = "#9ca3af";
  ctx.beginPath();
  ctx.moveTo(margen, baseY);
  ctx.lineTo(canvas.width - margen, baseY);
  ctx.stroke();
}

// Guarda el estado completo en localStorage.
function guardarEnLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  mostrarAlertas(["Datos guardados localmente."]);
}

// Carga estado desde localStorage al iniciar.
function cargarDesdeLocalStorage() {
  const crudo = localStorage.getItem(STORAGE_KEY);
  if (!crudo) return;
  const cargado = JSON.parse(crudo);
  Object.assign(estado.pnt, cargado.pnt || {});
  estado.tecnicos = cargado.tecnicos || [];
  estado.equipos = cargado.equipos || [];
  estado.tareas = cargado.tareas || [];
}

// Carga un caso demo obligatorio con técnicos, equipos y tareas variadas.
function cargarEjemplo() {
  estado.pnt = {
    nombreEnsayo: "PCR Multiplex Respiratorio",
    pntAgq: "AGQ-PNT-RESP-017",
    demandaDiaria: 180,
    turnosDia: 2,
    diasSemana: 6,
    mermas: "88",
    objetivoTat: "24h",
    horasTurnoGlobal: 8,
    dedicacionGlobal: "75",
    eficienciaGlobalPersonal: "85",
    eficienciaGlobalEquipo: "90",
    tamanoBatch: 24
  };

  estado.tecnicos = [
    { idTecnico: "T1", nombreTecnico: "Ana", horasTurno: 8, horasSemana: 40, dedicacion: "80", eficiencia: "88", activo: "SI" },
    { idTecnico: "T2", nombreTecnico: "Luis", horasTurno: 8, horasSemana: 40, dedicacion: "70", eficiencia: "85", activo: "SI" },
    { idTecnico: "T3", nombreTecnico: "Marta", horasTurno: 6, horasSemana: 30, dedicacion: "60", eficiencia: "82", activo: "SI" }
  ];

  estado.equipos = [
    { idEquipo: "E1", tipoEquipo: "Extractor ARN", agrupar: "Linea1", minutosDisponiblesDia: 960, capacidadNominal: 220, dedicacion: "75", eficiencia: "90", activo: "SI" },
    { idEquipo: "E2", tipoEquipo: "Termociclador qPCR", agrupar: "Linea1", minutosDisponiblesDia: 960, capacidadNominal: 170, dedicacion: "80", eficiencia: "88", activo: "SI" },
    { idEquipo: "E3", tipoEquipo: "Cabina Bioseguridad", agrupar: "Prep", minutosDisponiblesDia: 720, capacidadNominal: 260, dedicacion: "65", eficiencia: "92", activo: "SI" }
  ];

  estado.tareas = [
    { idEtapa: "ET1", nombreEtapa: "Recepción y registro", dependencia: "INICIO_ANTERIOR", recurso: "TECNICO", tiempoMuestra: 1.8, muestrasBatch: "", tiempoBatch: "", tecnicoAsignado: "T1", equiposAsignados: "", bloqueante: "SI" },
    { idEtapa: "ET2", nombreEtapa: "Inactivación y alicuotado", dependencia: "FIN_ANTERIOR", recurso: "AMBOS", tiempoMuestra: "", muestrasBatch: 24, tiempoBatch: 80, tecnicoAsignado: "T2", equiposAsignados: "E3", bloqueante: "SI" },
    { idEtapa: "ET3", nombreEtapa: "Extracción ARN", dependencia: "FIN_ANTERIOR", recurso: "EQUIPO", tiempoMuestra: 2.9, muestrasBatch: "", tiempoBatch: "", tecnicoAsignado: "", equiposAsignados: "E1", bloqueante: "SI" },
    { idEtapa: "ET4", nombreEtapa: "Montaje de placa", dependencia: "FIN_ANTERIOR", recurso: "TECNICO", tiempoMuestra: 2.5, muestrasBatch: "", tiempoBatch: "", tecnicoAsignado: "T3", equiposAsignados: "", bloqueante: "SI" },
    { idEtapa: "ET5", nombreEtapa: "Amplificación qPCR", dependencia: "FIN_ANTERIOR", recurso: "EQUIPO", tiempoMuestra: "", muestrasBatch: 24, tiempoBatch: 120, tecnicoAsignado: "", equiposAsignados: "E2", bloqueante: "SI" },
    { idEtapa: "ET6", nombreEtapa: "Reporte exploratorio paralelo", dependencia: "INICIO_ANTERIOR", recurso: "TECNICO", tiempoMuestra: 0.8, muestrasBatch: "", tiempoBatch: "", tecnicoAsignado: "T1", equiposAsignados: "", bloqueante: "NO" }
  ];

  recalcular();
  mostrarAlertas(["Ejemplo cargado correctamente."]);
}

// Exporta estado JSON descargable.
function exportarJSON() {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "capacidad_laboratorio.json";
  a.click();
}

// Importa estado desde archivo JSON.
function importarJSON(file) {
  const lector = new FileReader();
  lector.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !data.pnt) throw new Error("Formato no válido");
      Object.assign(estado.pnt, data.pnt || {});
      estado.tecnicos = data.tecnicos || [];
      estado.equipos = data.equipos || [];
      estado.tareas = data.tareas || [];
      recalcular();
      mostrarAlertas(["JSON importado correctamente."]);
    } catch (err) {
      mostrarAlertas([`Error al importar JSON: ${err.message}`], true);
    }
  };
  lector.readAsText(file);
}

// Lee el formulario PNT y lo persiste en estado.
function sincronizarPNTDesdeUI() {
  ["nombreEnsayo", "pntAgq", "demandaDiaria", "turnosDia", "diasSemana", "mermas", "objetivoTat", "horasTurnoGlobal", "dedicacionGlobal", "eficienciaGlobalPersonal", "eficienciaGlobalEquipo", "tamanoBatch"].forEach((campo) => {
    estado.pnt[campo] = $(`#${campo}`).value;
  });
}

// Carga valores PNT de estado a formulario.
function renderPNT() {
  Object.entries(estado.pnt).forEach(([k, v]) => {
    const el = $(`#${k}`);
    if (el) el.value = v ?? "";
  });
}

// Motor principal: valida, calcula y renderiza.
function recalcular() {
  sincronizarPNTDesdeUI();

  const avisos = [];
  const demanda = aNumero(estado.pnt.demandaDiaria);
  if (!Number.isFinite(demanda) || demanda < 0) avisos.push("La demanda diaria es inválida o está vacía.");

  const tecnicosConMin = calcularMinutosTecnicos(estado.pnt, estado.tecnicos);
  const equiposConMin = calcularMinutosEquipos(estado.pnt, estado.equipos);
  const tecnicosCarga = calcularCargaTecnicos(tecnicosConMin, estado.tareas);
  const equiposCarga = calcularCargaEquipos(equiposConMin, estado.tareas);

  // Reescribe los minutos calculados para mostrar en tablas editables.
  estado.tecnicos = tecnicosCarga;
  estado.equipos = equiposCarga;

  const capacidad = calcularCapacidadProceso(tecnicosCarga, equiposCarga);
  const utilizaciones = calcularUtilizaciones(demanda || 0, tecnicosCarga, equiposCarga);
  const cuello = detectarCuelloBotella(utilizaciones, estado.tareas);

  const tamBatch = aNumero(estado.pnt.tamanoBatch) || 1;
  const diasSemana = aNumero(estado.pnt.diasSemana) || 5;
  const capacidadMuestras = capacidad.capacidadProcesoMuestrasDia;
  const gap = Number.isFinite(capacidadMuestras) && Number.isFinite(demanda) ? capacidadMuestras - demanda : null;
  const cumple = Number.isFinite(gap) ? gap >= 0 : false;

  const utilizacionMax = cuello?.utilizacion ?? 0;
  const riesgoTat = utilizacionMax <= 0.85 ? "Bajo" : utilizacionMax <= 0.95 ? "Medio" : "Alto";

  estado.resultados = {
    demandaDiaria: demanda,
    capacidadProcesoMuestrasDia: capacidadMuestras,
    batchesDia: Number.isFinite(capacidadMuestras) ? capacidadMuestras / tamBatch : null,
    capacidadSemanal: Number.isFinite(capacidadMuestras) ? capacidadMuestras * diasSemana : null,
    gap,
    cumpleDemanda: cumple,
    cuello,
    riesgoTat,
    utilizaciones
  };

  renderTablas();
  renderKPIs(estado.resultados);
  renderResumenes(estado.resultados);
  if (estado.resultados) renderGraficos(estado.resultados);

  mostrarAlertas(avisos.length ? avisos : ["Cálculo actualizado correctamente."] , avisos.length > 0);
}

// Inicializa listeners de UI.
function iniciarEventos() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("activa"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("activo"));
      btn.classList.add("activa");
      $(`#tab-${btn.dataset.tab}`).classList.add("activo");
    });
  });

  // Recalcula al cambiar datos generales.
  document.querySelectorAll("#tab-pnt input").forEach((inp) => inp.addEventListener("input", recalcular));

  $("#addTecnico").onclick = () => {
    estado.tecnicos.push({ idTecnico: "", nombreTecnico: "", horasTurno: "", horasSemana: "", dedicacion: "", eficiencia: "85", activo: "SI" });
    recalcular();
  };

  $("#addEquipo").onclick = () => {
    estado.equipos.push({ idEquipo: "", tipoEquipo: "", agrupar: "", minutosDisponiblesDia: "", capacidadNominal: "", dedicacion: "", eficiencia: "", activo: "SI" });
    recalcular();
  };

  $("#addTarea").onclick = () => {
    estado.tareas.push({ idEtapa: "", nombreEtapa: "", dependencia: "FIN_ANTERIOR", recurso: "TECNICO", tiempoMuestra: "", muestrasBatch: "", tiempoBatch: "", tecnicoAsignado: "", equiposAsignados: "", bloqueante: "SI" });
    recalcular();
  };

  $("#btnGuardar").onclick = () => guardarEnLocalStorage();
  $("#btnCargarEjemplo").onclick = () => cargarEjemplo();
  $("#btnLimpiar").onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };
  $("#btnExportar").onclick = () => exportarJSON();
  $("#btnImportar").onclick = () => $("#inputImportar").click();
  $("#inputImportar").addEventListener("change", (e) => {
    if (e.target.files?.[0]) importarJSON(e.target.files[0]);
  });
}

// Arranque de la aplicación.
(function init() {
  cargarDesdeLocalStorage();
  renderPNT();
  iniciarEventos();
  recalcular();
})();
