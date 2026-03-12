# Calculadora de Capacidad Técnica de Ensayos (Laboratorio)

Aplicación web **100% estática** (HTML + CSS + JavaScript vanilla) para estimar la capacidad de producción de un ensayo, detectar cuellos de botella y presentar una salida ejecutiva orientada a operaciones.

## 1) Descripción de la herramienta
La app permite cargar datos de:
- Datos generales del estudio/PNT.
- Técnicos.
- Equipos.
- Tareas del proceso.
- Resultados/KPIs ejecutivos.

Con esa información calcula:
- Capacidad máxima en muestras/día.
- Capacidad en batches/día y muestras/semana.
- Gap contra demanda diaria.
- Recurso cuello de botella (técnico/equipo), etapas causantes y utilización máxima.
- Semáforo de riesgo operativo (verde/ámbar/rojo).

## 2) Estructura del proyecto
```text
.
├── index.html
├── styles.css
├── app.js
└── README.md
```

## 3) Cómo ejecutarla localmente
Opción directa:
1. Descarga o clona el repositorio.
2. Abre `index.html` en tu navegador.

Opción recomendada con servidor estático:
1. En la carpeta del proyecto ejecuta:
   ```bash
   python3 -m http.server 8080
   ```
2. Abre `http://localhost:8080`.

## 4) Cómo subirla a GitHub
1. Crea un repositorio nuevo en GitHub.
2. Sube estos archivos al directorio raíz.
3. Haz commit y push a la rama principal (`main`).

Ejemplo:
```bash
git init
git add .
git commit -m "feat: app estática de capacidad técnica"
git branch -M main
git remote add origin <URL_DEL_REPO>
git push -u origin main
```

## 5) Cómo activar GitHub Pages
1. En GitHub, entra a **Settings** del repositorio.
2. Ir a **Pages**.
3. En **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Guardar cambios.
5. Esperar la publicación y abrir la URL entregada por GitHub Pages.

## 6) Qué datos rellenar primero
Orden recomendado:
1. En **Datos del PNT**, completa demanda diaria y parámetros globales.
2. Carga **Técnicos** activos.
3. Carga **Equipos** activos.
4. Carga **Tareas** (marcando bloqueantes y asignaciones de recursos).
5. Revisa **Resultados** (KPIs, tablas resumen y gráficos).

También puedes usar **Cargar ejemplo** para ver un caso realista precargado.

## 7) Limitaciones de la primera versión
- No incluye autenticación ni backend.
- No genera diagrama Gantt visual; la dependencia se usa solo como dato conceptual.
- Las asignaciones de múltiples equipos se introducen por texto separado por comas (IDs).
- No contempla calendarios complejos por festivos o turnos variables por día.

## 8) Futuras mejoras sugeridas
- Editor asistido de dependencias con vista de flujo.
- Simulación por escenarios (optimista/base/pesimista).
- Cálculo de capacidad mensual con calendario laboral real.
- Exportación a PDF ejecutivo.
- Versionado de escenarios en historial local.

---

## Funciones incluidas en `app.js`
- `normalizarPorcentaje()`
- `calcularMinutosTecnicos()`
- `calcularMinutosEquipos()`
- `calcularMinutosPorMuestraTarea()`
- `calcularCargaTecnicos()`
- `calcularCargaEquipos()`
- `calcularCapacidadProceso()`
- `detectarCuelloBotella()`
- `calcularUtilizaciones()`
- `renderTablas()`
- `renderKPIs()`
- `renderGraficos()`
- `guardarEnLocalStorage()`
- `cargarDesdeLocalStorage()`
- `cargarEjemplo()`
- `exportarJSON()`
- `importarJSON()`

Todas las funciones están comentadas para facilitar mantenimiento y traspaso a otros equipos.
