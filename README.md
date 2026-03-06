# Capacity Wizard (estático para GitHub Pages)

Aplicación 100% estática (HTML/CSS/JavaScript) para calcular capacidad máxima y cuello de botella de procesos productivos usando datos manuales o importados desde Excel.

## Archivos
- `index.html`
- `styles.css`
- `app.js`

## Características principales
- Gestión de múltiples procesos en memoria:
  - Nuevo proceso
  - Duplicar proceso
  - Eliminar proceso
  - Selector de proceso activo
- Wizard por pasos:
  1. Datos base
  2. Técnicos
  3. Equipos
  4. Tareas
  5. Resultados
- Tablas editables con:
  - `+ Añadir fila`
  - `Eliminar fila`
  - Validaciones mínimas de campos y tipos
- Importación de Excel `.xlsx` con SheetJS vía CDN.
- Exportación/Importación de JSON para respaldo manual.
- Cálculo de:
  - Demanda
  - Capacidad máxima de línea
  - Bottleneck (recurso con mayor utilización)
  - Tabla de recursos y utilización
  - Tabla de capacidades por tarea

## Uso rápido
1. Abre `index.html` directamente en el navegador.
2. Crea o selecciona un proceso.
3. Completa **Datos base** (al menos demanda/unidades por día).
4. Carga o edita filas en **Técnicos**, **Equipos** y **Tareas**.
5. Ve a **Resultados** y pulsa **Calcular**.

## Importar Excel
Botón: **Importar Excel (.xlsx)**

Se esperan pestañas (case-insensitive por normalización):
- `Datos base`
- `Tecnicos`
- `Equipos`
- `Tareas`

### Formatos soportados en `Datos base`
- **Formato A**: tabla con columnas `Campo` y `Valor`.
- **Formato B**: una fila con múltiples columnas (se toma esa fila como key-values).

Para la demanda se busca en este orden:
- `unidades_dia`
- `demanda`
- `units_per_day`

Si falta alguna pestaña o la demanda no es válida, se muestra error claro en la UI.

## Importar / Exportar JSON
- **Exportar JSON**: descarga el estado completo (`processes`, `activeProcessId`).
- **Importar JSON**: restaura procesos desde un archivo previamente exportado.

## Motor de cálculo (resumen)
- Recursos activos:
  - Humanos: `min_efectivos_dia` o fórmula con turnos, horas, dedicación y eficiencia.
  - Equipos: `min_efectivos_dia` o fórmula con turnos, horas, OEE y paralelo.
- Carga por tarea según `modo`:
  - `HUMANO`
  - `EQUIPO`
  - `MIXTO_AND`
- Utilización por recurso: `carga / minEff`.
- Bottleneck: recurso con máxima utilización.
- Capacidad de línea: mínimo de capacidad entre tareas válidas.

## Despliegue en GitHub Pages
1. Sube el contenido del repositorio a GitHub en la rama `main`.
2. Ve a **Settings** → **Pages**.
3. En **Build and deployment** elige:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/(root)`
4. Guarda y espera la publicación.
5. Abre la URL pública de GitHub Pages.

## Notas
- No usa Node, npm ni frameworks.
- Funciona de forma estática en local y en GitHub Pages.
