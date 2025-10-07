// ------------------- Globals & token check -------------------
let currentPage = 1;
const pageSize = 5; // Cambia este valor si quieres más/menos filas por página

let sensoresData = [];
let alertasData = [];
let usuariosData = [];

let alertasTendenciaChart = null;
let alertasSucursalesChart = null;

// ------------------- SEGURIDAD -------------------
const REQUIRED_ROLE = 'superAdmin';

const token = sessionStorage.getItem('authToken');
const userData = isTokenExpired(token);

 // 1. Validar Token y Expiración
if (!userData) {
    // Si no hay token o está expirado/inválido
    sessionStorage.removeItem('authToken');

    if (token) {
        window.location.href = 'sesion_expired.html';
    } else {
        window.location.href = 'acceso_denegado.html';
    }
}
// 2. Validar Rol
const userRole = userData.entity_type;
// Si el usuario no tiene el rol requerido
if (userRole !== REQUIRED_ROLE) {
    window.location.href = 'acceso_denegado.html';
}
// Token válido y el rol correcto. -> guardamos cuando unicia sesión
sessionStorage.setItem('userData', JSON.stringify(userData));
// ------------------- FIN -------------------

// ------------------- Initialization -------------------
document.addEventListener('DOMContentLoaded', initHome);

async function initHome() {

    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (el) {
        return new bootstrap.Tooltip(el);
    });

    // fetch data and render KPI cards (these always reflect current state)
    await cargarKPIs();
    renderPorcentajeAlertasMes();

    // initial filtered render (uses selected period or default 'todos')
    const periodSelect = document.getElementById('periodSelectHome');
    const initialPeriod = periodSelect ? periodSelect.value : 'todos';
    renderContenidoFiltrable(initialPeriod);

    // event: global period select -> re-render filtered content
    if (periodSelect) {
        periodSelect.addEventListener('change', () => {
            renderContenidoFiltrable(periodSelect.value);
        });
    }

    document.querySelectorAll('#dropdownPeriodoAlertas + ul .dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const periodo = this.dataset.period;
            const dropdownButton = document.getElementById('dropdownPeriodoAlertas');
            if (dropdownButton) dropdownButton.textContent = this.textContent;
            renderAlertasTendenciaChart(periodo, getFilteredAlertasForPeriod(periodo));
        });
    });

    cargarUltimasConexiones();

    setupFechaAccordion();

};

// ------------------- Core fetch + KPI rendering -------------------
async function cargarKPIs() {
    try {
        // Usa Promise.all para hacer las llamadas en paralelo
        const [sensoresRes, alertasRes, usuariosRes] = await Promise.all([
            fetch('/sensores', { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch('/alertas', { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch('/usuarios', { headers: { 'Authorization': 'Bearer ' + token } })
        ]);

        sensoresData = await sensoresRes.json();
        alertasData = await alertasRes.json();
        usuariosData = await usuariosRes.json();

        // Render KPI cards (these use the full datasets, not the date-filter)
        renderKPIs(sensoresData, alertasData);


    } catch (error) {
        console.error('Error al cargar KPIs:', error);
    }
}

function renderKPIs(sensores, alertas) {
    // KPIs must reflect current state (ALL data)

    // Total de sensores
    const total = sensores.length; 
    document.getElementById('total-sensores').textContent = total;
    // Sensores en rango
    const enRango = sensores.filter(s => s.enRango === true).length;
    document.getElementById('sensores-en-rango').textContent = enRango;
    // Sensores fuera de rango (solo los que tienen medición)
    const fueraRango = sensores.filter(s => s.enRango === false).length;
    document.getElementById('sensores-fuera-rango').textContent = fueraRango;
    // Sensores offline (fallos/sin señal)
    const offline = sensores.filter(s => s.estado && s.estado.toLowerCase() === 'offline').length;
    document.getElementById('sensores-fallo').textContent = offline;

    // porcentajes
    // a) % fuera de rango
    const porcentajeFueraRango = total ? ((fueraRango / total) * 100).toFixed(1) : 0;
    document.getElementById('porcentaje-fuera-rango').textContent = porcentajeFueraRango + "%";
    // b) % activos (estado === 'ONLINE')
    const porcentajeActivos = total ? ((sensores.filter(s => s.estado && s.estado.toUpperCase() === 'ONLINE').length / total) * 100).toFixed(1) : 0;
    document.getElementById('porcentaje-en-rango').textContent = porcentajeActivos + "%";
    // c) % con retraso de envío de datos (estado === 'OFFLINE')
    const porcentajeRetraso = total ? ((offline / total) * 100).toFixed(1) : 0;
    document.getElementById('porcentaje-retraso-envio').textContent = porcentajeRetraso + "%";
}

// ------------------- Porcentaje alertas mes  -------------------
function renderPorcentajeAlertasMes() {
    // Calcula el porcentaje de alertas del mes actual vs anterior
    // Usa SIEMPRE alertasData (todas las alertas)
        if (!alertasData || alertasData.length === 0) {
        document.getElementById('porcentajeAlertasMes').textContent = '';
        return;
    }
    const meses = {};
    alertasData.forEach(a => {
        const fecha = new Date(a.fechaHoraAlerta?.$date || a.fechaHoraAlerta);
        if (isNaN(fecha.getTime())) return;
        const key = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2,'0')}`;
        meses[key] = (meses[key] || 0) + 1;
    });
    const keys = Object.keys(meses).sort().reverse(); // newest first
    const spanPct = document.getElementById('porcentajeAlertasMes');
    if (keys.length < 2 || !meses[keys[1]]) {
        spanPct.textContent = "No se cuenta con datos del mes anterior para calcular el porcentaje de variación.";
        spanPct.classList.remove("text-success", "text-danger");
        return;
    }

    const actual = meses[keys[0]];
    const anterior = meses[keys[1]];
    const pct = (((actual - anterior) / anterior) * 100).toFixed(1);

    if (pct > 0) {
        spanPct.textContent = `⬆ ${pct}% respecto al mes anterior`;
        spanPct.classList.remove("text-success");
        spanPct.classList.add("text-danger");
    } else if (pct < 0) {
        spanPct.textContent = `⬇ ${Math.abs(pct)}% respecto al mes anterior`;
        spanPct.classList.remove("text-danger");
        spanPct.classList.add("text-success");
    } else {
        spanPct.textContent = `= ${pct}% respecto al mes anterior`;
        spanPct.classList.remove("text-success", "text-danger");
    }
}


// ------------------- Global date-filtering logic -------------------
function getFilteredAlertasForPeriod(periodo) {
    if (!alertasData || alertasData.length === 0) return [];

    const ahora = new Date();
    let fechaInicio = null;
    switch (periodo) {
        case '24h': fechaInicio = new Date(ahora.getTime() - 24 * 60 * 60 * 1000); break;
        case '7d': fechaInicio = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': fechaInicio = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case 'mes': fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1); break;
        default: fechaInicio = null;
    }
    if (!fechaInicio) return [...alertasData];

    return alertasData.filter(a => {
        const raw = a.fechaHoraAlerta?.$date || a.fechaHoraAlerta;
        const fecha = new Date(raw);
        if (isNaN(fecha.getTime())) return false;
        return fecha >= fechaInicio && fecha <= ahora;
    });
}

function renderContenidoFiltrable(periodo) {
    const alertasFiltradas = getFilteredAlertasForPeriod(periodo);

    // all components below depend on this filtered set
    renderAlertasTendenciaChart(periodo, alertasFiltradas);
    renderAlertaSucursalesChart(alertasFiltradas, sensoresData);
    renderAlertasRecurrentesTable(alertasFiltradas, sensoresData);
    renderRankingSensores(alertasFiltradas);
    renderRankingFueraRango(alertasFiltradas)
    cargarAlertasParaBarra(alertasFiltradas);
    renderKPITiempos(alertasFiltradas);
    renderAlertasSeguridadTable(alertasFiltradas, usuariosData);
}

// ------------------- Bar (alert distribution) -------------------
function cargarAlertasParaBarra(alertas) {
    // consumes filtered alerts (no fetch inside)
    const counts = { critica: 0, informativa: 0, preventiva: 0, seguridad: 0 };
    if (!alertas) alertas = [];

    alertas.forEach(a => {
        let crit = (a.criticidad || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (crit === 'critica') counts.critica++;
        else if (crit === 'informativa') counts.informativa++;
        else if (crit === 'preventiva') counts.preventiva++;
        else if (crit === 'seguridad') counts.seguridad++;
    });

    const total = counts.critica + counts.informativa + counts.preventiva + counts.seguridad;
    document.getElementById('total_alertas').textContent = total;
    const pct = t => (total ? (counts[t] / total) * 100 : 0);
    document.querySelector('.bar .critica').style.width = pct('critica') + "%";
    document.querySelector('.bar .informativa').style.width = pct('informativa') + "%";
    document.querySelector('.bar .preventiva').style.width = pct('preventiva') + "%";
    document.querySelector('.bar .seguridad').style.width = pct('seguridad') + "%";

     // Mostrar porcentajes en la leyenda
    document.getElementById('pct-critica').textContent = `(${pct('critica').toFixed(1)}%)`;
    document.getElementById('pct-informativa').textContent = `(${pct('informativa').toFixed(1)}%)`;
    document.getElementById('pct-preventiva').textContent = `(${pct('preventiva').toFixed(1)}%)`;
    document.getElementById('pct-seguridad').textContent = `(${pct('seguridad').toFixed(1)}%)`;

    addBarTooltips(counts);
}

function renderKPITiempos(alertasFiltradas) {
    // Filtra solo alertas cerradas de tipo "Temperatura fuera de rango"
    const fueraRango = alertasFiltradas.filter(a =>
        a.tipoAlerta === "Temperatura fuera de rango" &&
        a.estadoAlerta === "cerrada" &&
        a.duracionMinutos != null
    );

    // Promedio fuera de rango (minutos)
    const promFueraRango = fueraRango.length
        ? (fueraRango.reduce((acc, a) => acc + Math.max(0, Number(a.duracionMinutos)), 0) / fueraRango.length).toFixed(1)
        : '--';

    // Tiempo Promedio desde Última Medición (minutos)
    const ahora = new Date();
    const ultimasPorSensor = {};
    alertasFiltradas.forEach(a => {
        const id = a.idSensor;
        const fecha = new Date(a.fechaHoraAlerta?.$date || a.fechaHoraAlerta);
        if (!id || isNaN(fecha.getTime())) return;
        if (!ultimasPorSensor[id] || fecha > ultimasPorSensor[id]) {
            ultimasPorSensor[id] = fecha;
        }
    });

    const difs = Object.values(ultimasPorSensor).map(f => Math.max(0, (ahora - f) / 60000));
    const promUltimaMed = difs.length
        ? (difs.reduce((acc, v) => acc + v, 0) / difs.length).toFixed(1)
        : '--';

    // Render en el HTML
    const kpiCard = document.querySelector('.alert-kpi-card');
    if (kpiCard) {
        const dFlexs = kpiCard.querySelectorAll('.d-flex');
        if (dFlexs[1]) dFlexs[1].querySelector('strong').textContent = `${promFueraRango} min`;
        if (dFlexs[2]) dFlexs[2].querySelector('strong').textContent = `${promUltimaMed} min`;
    }
}

// ------------------- Ranking sensores (uses filtered alerts) -------------------
function renderRankingSensores(alertasFiltradas) {
    // Agrupar por sensor
    const agrupado = {};
    alertasFiltradas.forEach(alerta => {
        const tipo = (alerta.tipoAlerta || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        // Ignorar alertas que no aplican
        if (
            (alerta.criticidad || "").toLowerCase() === "seguridad" ||
            tipo === "caida de energia electrica" ||
            !alerta.idSensor
        ) {
            return;
        }

        const crit = (alerta.criticidad || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        // Manejo uniforme de idSensor (puede ser string, number o array)
        const sensores = Array.isArray(alerta.idSensor)
            ? alerta.idSensor
            : [alerta.idSensor];

        sensores.forEach(idSensor => {
            if (!idSensor) return;
            if (!agrupado[idSensor]) {
                agrupado[idSensor] = { criticas: 0, informativas: 0, preventivas: 0, total: 0 };
            }
            if (crit === "critica") agrupado[idSensor].criticas++;
            else if (crit === "informativa") agrupado[idSensor].informativas++;
            else if (crit === "preventiva") agrupado[idSensor].preventivas++;
            agrupado[idSensor].total++;
        });
    });
    
    // Convertir a array y ordenar por total
    const ranking = Object.entries(agrupado)
        .map(([idSensor, data]) => ({ idSensor, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3); // Top 3

    // Renderizar filas
    const tbody = document.getElementById("ranking-sensores");
    if (!tbody) return;
    tbody.innerHTML = "";
    ranking.forEach(sensor => {
        const row = `
            <tr>
                <td>${sensor.idSensor}</td>
                <td>${sensor.criticas}</td>
                <td>${sensor.informativas}</td>
                <td>${sensor.preventivas}</td>
                <td><strong>${sensor.total}</strong></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function renderRankingFueraRango(alertasFiltradas) {
    // Agrupa por sensor: suma minutos de alertas cerradas de tipo "Temperatura fuera de rango"
    const porSensor = {};
    alertasFiltradas.forEach(a => {
        if (a.tipoAlerta === "Temperatura fuera de rango" &&
            a.estadoAlerta === "cerrada" &&
            a.duracionMinutos != null
        ) {
            const id = a.idSensor || "Desconocido";
            porSensor[id] = (porSensor[id] || 0) + Math.max(0, Number(a.duracionMinutos));
        }
    });

    // Para calcular %: se necesita el período total observado
    const ahora = new Date();
    const fechaMin = alertasFiltradas.reduce((min, a) => {
        const f = new Date(a.fechaHoraAlerta?.$date || a.fechaHoraAlerta);
        return (!isNaN(f) && f < min) ? f : min;
    }, ahora);
    const minutosTotales = Math.max(1, (ahora - fechaMin) / 60000); // minutos observados

    // Ranking top 3
    const ranking = Object.entries(porSensor)
        .map(([id, min]) => ({
            sensor: id,
            minutos: min,
            porcentaje: Math.min(100, (min / minutosTotales) * 100).toFixed(1)
        }))
        .sort((a, b) => b.minutos - a.minutos)
        .slice(0, 3);

    // Render en la tabla
    const tbody = document.getElementById("ranking-sensores-fuera-tiempo");
    if (!tbody) return;

    tbody.innerHTML = '';
    if (ranking.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No hay datos</td></tr>';
    } else {
        ranking.forEach(item => {
            const horas = (item.minutos / 60).toFixed(1); // convertir a horas con 1 decimal
            tbody.innerHTML += `
                <tr>
                    <td>${item.sensor}</td>
                    <td>${item.minutos}</td>
                    <td>${horas} h</td>
                    <td>${item.porcentaje}%</td>
                </tr>
            `;
        });
    }
}

// ------------------- Alertas tendencia (line chart) -------------------

function toLocalAR(date) {
    // Convierte una fecha a Argentina (UTC-3) sin cambiar el valor original
    return new Date(date.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
}

function renderAlertasTendenciaChart(periodo, alertasFiltradas) {
    const ahora = new Date();
    let fechaInicio, fechaFin = ahora;
    let intervaloMs, usarHoras = false;

    switch(periodo) {
        case '24h':
            fechaInicio = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
            intervaloMs = 60 * 60 * 1000;
            usarHoras = true;
            break;
        case '7d':
            fechaInicio = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
            intervaloMs = 24 * 60 * 60 * 1000;
            break;
        case 'mes':
            fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
            intervaloMs = 24 * 60 * 60 * 1000;
            break;
        case 'todos':
            const fechasValidas = alertasFiltradas
                .map(a => new Date(a.fechaHoraAlerta?.$date || a.fechaHoraAlerta))
                .filter(f => !isNaN(f));
            if (!fechasValidas.length) return;
            fechaInicio = new Date(Math.min(...fechasValidas));
            fechaFin = new Date(Math.max(...fechasValidas));
            intervaloMs = 24 * 60 * 60 * 1000;
            break;
    }
    
    

    // 2. Inicializar dataAgrupada
    const dataAgrupada = {};
    const labels = [];

    for (let d = new Date(fechaInicio); d <= fechaFin; d.setTime(d.getTime() + intervaloMs)) {
        let etiqueta;
         if (usarHoras) {
            etiqueta = d.toLocaleString("es-AR", { 
                day: 'numeric', month: 'short', hour: '2-digit', timeZone: "America/Argentina/Buenos_Aires" 
            });
        } else {
            etiqueta = d.toLocaleDateString("es-AR", { 
                day: 'numeric', month: 'short', timeZone: "America/Argentina/Buenos_Aires" 
            });
        }
        labels.push(etiqueta);
        dataAgrupada[etiqueta] = { critica: 0, preventiva: 0, informativa: 0, seguridad: 0 };
    }

    // 3. Contar alertas
    alertasData.forEach(alerta => {
        const fechaAlerta = toLocalAR(new Date(alerta.fechaHoraAlerta?.$date || alerta.fechaHoraAlerta));
        if (isNaN(fechaAlerta.getTime()) || fechaAlerta < fechaInicio || fechaAlerta > fechaFin) return;

        let etiqueta;
        if (usarHoras) {
            etiqueta = fechaAlerta.toLocaleString("es-AR", { 
                day: 'numeric', month: 'short', hour: '2-digit', timeZone: "America/Argentina/Buenos_Aires" 
            });
        } else {
            etiqueta = fechaAlerta.toLocaleDateString("es-AR", { 
                day: 'numeric', month: 'short', timeZone: "America/Argentina/Buenos_Aires" 
            });
        }


        const crit = (alerta.criticidad || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (dataAgrupada[etiqueta]) {
            if (crit === 'critica') dataAgrupada[etiqueta].critica++;
            else if (crit === 'preventiva') dataAgrupada[etiqueta].preventiva++;
            else if (crit === 'informativa') dataAgrupada[etiqueta].informativa++;
            else if (crit === 'seguridad') dataAgrupada[etiqueta].seguridad++;
        }
    });

    // 4. Datasets
     const datasets = [
        { label: 'Críticas',     data: labels.map(l => dataAgrupada[l].critica),     borderColor: '#dc3545', backgroundColor: 'rgba(220,53,69,0.2)', fill: true, tension: 0.4 },
        { label: 'Informativas', data: labels.map(l => dataAgrupada[l].informativa), borderColor: '#ffc107', backgroundColor: 'rgba(255,193,7,0.2)', fill: true, tension: 0.4 },
        { label: 'Preventivas',  data: labels.map(l => dataAgrupada[l].preventiva),  borderColor: '#6c757d', backgroundColor: 'rgba(108,117,125,0.2)', fill: true, tension: 0.4 },
        { label: 'Seguridad',    data: labels.map(l => dataAgrupada[l].seguridad),   borderColor: '#17a2b8', backgroundColor: 'rgba(23,162,184,0.2)', fill: true, tension: 0.4 }
    ];

    // 5. Render Chart.js
    const ctx = document.getElementById('alertasTendenciaChart').getContext('2d');
    if (alertasTendenciaChart) alertasTendenciaChart.destroy();
    alertasTendenciaChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Cantidad de Alertas' } },
                x: { title: { display: true, text: usarHoras ? 'Hora' : 'Fecha' } }
            }
        }
    });
}


// ------------------- Small helpers kept from original -------------------
function addBarTooltips(counts) {
  const bar = document.querySelector('.bar');
  if (!bar) return;

  const tipos = ['critica', 'informativa', 'preventiva', 'seguridad'];

  tipos.forEach(tipo => {
    const el = bar.querySelector('.' + tipo);
    if (!el) return;

    // Si ya había handlers, los removemos primero (para evitar duplicados)
    if (el._barHandlers) {
      el.removeEventListener('pointerenter', el._barHandlers.onEnter);
      el.removeEventListener('pointerleave', el._barHandlers.onLeave);
      el.removeEventListener('pointermove', el._barHandlers.onMove);
      window.removeEventListener('scroll', el._barHandlers.onScroll);
      window.removeEventListener('resize', el._barHandlers.onScroll);
      if (el._barTooltip) { el._barTooltip.remove(); el._barTooltip = null; }
      el._barHandlers = null;
    }

    // Handlers
    const onEnter = (ev) => {
      // debug
      // console.log('ENTER', tipo);

      // crear tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'bar-tooltip';
      tooltip.innerText = `Cantidad: ${counts[tipo] || 0}`;
      tooltip.style.position = 'absolute';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.opacity = '1';

      // append to body para que no lo recorte ningún contenedor
      document.body.appendChild(tooltip);
      el._barTooltip = tooltip;

      // posición inicial
      positionTooltip(el, tooltip);
    };

    const onMove = (ev) => {
      // reposicionar mientras mueves dentro del segmento
      if (el._barTooltip) positionTooltip(el, el._barTooltip, ev);
    };

    const onLeave = () => {
      // debug
      // console.log('LEAVE', tipo);
      if (el._barTooltip) {
        el._barTooltip.remove();
        el._barTooltip = null;
      }
    };

    const onScrollOrResize = () => {
      if (el._barTooltip) {
        el._barTooltip.remove();
        el._barTooltip = null;
      }
    };

    // attach
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    el._barHandlers = { onEnter, onLeave, onMove, onScroll: onScrollOrResize };
  });

  // helper: posiciona tooltip respecto al segmento (usa page coords)
  function positionTooltip(el, tooltip, ev) {
    const rect = el.getBoundingClientRect();
    // centro del segmento
    const centerX = rect.left + rect.width / 2 + window.scrollX;
    // colocarlo encima del segmento (8px de separación)
    // medimos altura del tooltip (puede ser 0 antes de render)
    tooltip.style.left = centerX + 'px';
    // dejar tiempo al navegador para calcular tamaño si aún no está
    const tRect = tooltip.getBoundingClientRect();
    const top = rect.top + window.scrollY - tRect.height - 8;
    tooltip.style.top = top + 'px';
    // centrar horizontalmente
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.zIndex = '2147483647';
  }
}

// ------------------- UTIL: Fecha accordion & user table functions kept -------------------
function setupFechaAccordion() {
    const fechaAccordionBtn = document.getElementById('fechaAccordionBtn');
    const collapseFecha = document.getElementById('collapseFecha');
    if (!fechaAccordionBtn || !collapseFecha) return;

    fechaAccordionBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', !expanded);
        collapseFecha.style.display = expanded ? 'none' : 'block';
    });

    document.addEventListener('click', function(e) {
        if (!collapseFecha.contains(e.target) && e.target !== fechaAccordionBtn) {
            collapseFecha.style.display = 'none';
            fechaAccordionBtn.setAttribute('aria-expanded', 'false');
        }
    });

    collapseFecha.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            collapseFecha.style.display = 'none';
            fechaAccordionBtn.setAttribute('aria-expanded', 'false');
            filtrarPorPeriodo(this.getAttribute('data-range'));
        });
    });
}

/**
 * Procesa las alertas y genera un gráfico de barras agrupadas por sucursal.
 * @param {Array} alertas - Array de objetos de alerta.
 * @param {Array} sensores - Array de objetos de sensor, necesario para obtener la dirección.
 */
function renderAlertaSucursalesChart(alertas, sensores) {
    if (!alertas || alertas.length === 0 || !sensores || sensores.length === 0) {
        console.log("No hay datos suficientes para mostrar el gráfico de sucursales.");
        const chartDiv = document.getElementById('chart-section');
        if (chartDiv) chartDiv.style.display = 'none';
        return;
    }

    // ---------- MAPA: nroSensor -> direccion ----------
    const sensoresMap = sensores.reduce((map, sensor) => {
        // soporta variantes y normaliza a string
        const rawKey = sensor.nroSensor;
        if (rawKey != null) {
            const key = String(rawKey).trim();
            map[key] = (sensor.direccion || '').trim() || 'Sin Dirección';
        }
        return map;
    }, {});

    // Debug: muestra algunas claves para confirmar
    console.debug('Sensores cargados (ejemplo claves):', Object.keys(sensoresMap).slice(0, 20));

    // ---------- AGRUPAR ALERTAS ----------
    // 2. Agrupar alertas por sucursal y criticidad (filtrando las de seguridad)
    const dataAgrupada = alertas
        .filter(alerta => {
            const crit = (alerta.criticidad || '')
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
            return crit !== 'seguridad';
        })
        .reduce((acc, alerta) => {
            // tomar id de la alerta (idSensor en alertas) y normalizar a string
            const rawSensorId = alerta.idSensor;
            const sensorKey = rawSensorId != null ? String(rawSensorId).trim() : null;

            // buscar por nroSensor en el mapa
            const direccion = sensorKey && sensoresMap.hasOwnProperty(sensorKey)
                ? sensoresMap[sensorKey]
                : 'Sin Dirección';

            // normalizar criticidad
            const criticidadNormalizada = (alerta.criticidad || '')
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            if (!acc[direccion]) {
                acc[direccion] = { critica: 0, informativa: 0, preventiva: 0 };
            }
            if (acc[direccion].hasOwnProperty(criticidadNormalizada)) {
                acc[direccion][criticidadNormalizada]++;
            } else {
                // Si llega un tipo nuevo, lo incluimos como informativa por defecto (opcional)
                // O comentar la línea siguiente si preferís ignorar tipos desconocidos.
                // acc[direccion].informativa++;
            }

            return acc;
        }, {});

    // Debug: ver cuántas alertas quedaron sin match
    const sinMatch = alertas.filter(a => {
        const key = a.idSensor;
        return !key || !sensoresMap.hasOwnProperty(String(key).trim());
    }).length;
    console.debug('Alertas sin match (caen en "Sin Dirección"):', sinMatch);

    // ---------- PREPARAR Y RENDERIZAR GRÁFICO ----------
    // 3. Preparar los datos y renderizar el gráfico
    const sucursalesOrdenadas = Object.entries(dataAgrupada)
        .map(([direccion, counts]) => ({
            direccion,
            total: counts.critica + counts.informativa + counts.preventiva
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3) // top 3 sucursales
        .map(item => item.direccion);

    const sucursales = sucursalesOrdenadas;
    const tiposAlerta = ['critica', 'informativa', 'preventiva'];

    
    const colores = {
        critica: '#ef4444',
        informativa: '#facc15',
        preventiva: '#7F8C8D'
        
    };

    const datasets = tiposAlerta.map(tipo => ({
        label: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        data: sucursales.map(sucursal => dataAgrupada[sucursal][tipo]),
        backgroundColor: colores[tipo],
        borderColor: colores[tipo],
        borderWidth: 1
    }));

    const ctx = document.getElementById('alertasSucursalesChart').getContext('2d');
    if (alertasSucursalesChart) {
        alertasSucursalesChart.destroy();
    }

    alertasSucursalesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sucursales,
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    stacked: false,
                    title: { display: true, text: 'Sucursales' }
                },
                y: {
                    stacked: false,
                    title: { display: true, text: 'Cantidad de Alertas' },
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });

}

/**
 * Genera y renderiza una tabla con las alertas más recurrentes por sucursal.
 * @param {Array} alertas - Array de objetos de alerta.
 * @param {Array} sensores - Array de objetos de sensor.
 */
function renderAlertasRecurrentesTable(alertas, sensores) {
    if (!alertas || alertas.length === 0 || !sensores || sensores.length === 0) {
        document.getElementById('ranking-alertas-recurrentes-tbody').innerHTML = '<tr><td colspan="3" class="text-center">No hay datos suficientes para mostrar el ranking.</td></tr>';
        return;
    }

   // 1. Crear un mapa de sensores: nroSensor -> dirección
    const sensoresMap = sensores.reduce((map, sensor) => {
        const key = sensor.nroSensor ?? sensor.idSensor ?? sensor.id ?? sensor._id ?? sensor.sensorId;
        if (key != null) {
            map[String(key).trim()] = sensor.direccion || 'Sin Dirección';
        }
        return map;
    }, {});

    // 2. Agrupar y contar las alertas por sucursal y tipo
    const dataAgrupada = alertas
        .filter(alerta => {
            const crit = (alerta.criticidad || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return crit !== 'seguridad' && alerta.idSensor;
        })
        .reduce((acc, alerta) => {
            const sensorKey = String(alerta.idSensor).trim();
            const direccion = sensoresMap[sensorKey] || 'Sin Dirección';
            const tipoAlerta = alerta.tipoAlerta || 'Desconocido';
            const criticidad = alerta.criticidad || 'N/A';
            
            if (!acc[direccion]) acc[direccion] = {};

            if (!acc[direccion][tipoAlerta]) {
                acc[direccion][tipoAlerta] = { count: 0, criticidad: criticidad };
            }
            acc[direccion][tipoAlerta].count++;
            return acc;
        }, {});
    
    // 3. Generar el ranking top 3 para cada sucursal
    const rankingPorSucursal = Object.entries(dataAgrupada)
    .map(([direccion, tipos]) => {
        const total = Object.values(tipos).reduce((acc, t) => acc + t.count, 0);
        const topTipos = Object.entries(tipos)
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 3)
            .map(([tipo, data]) => ({ tipo, count: data.count, criticidad: data.criticidad }));
        return { direccion, total, topTipos };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 3); // limita a 3 sucursales


    // 4. Renderizar la tabla
    const tbody = document.getElementById('ranking-alertas-recurrentes-tbody');
    tbody.innerHTML = ''; // limpiar contenido previo

    if (rankingPorSucursal.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay alertas para mostrar el ranking.</td></tr>';
        return;
    }

    rankingPorSucursal.forEach(sucursal => {
        let primeraFilaSucursal = true;
        sucursal.topTipos.forEach(item => {
            const row = document.createElement('tr');
            if (primeraFilaSucursal) {
                // primera fila de la sucursal
                row.innerHTML = `
                    <td rowspan="${sucursal.topTipos.length}">${sucursal.direccion}</td>
                    <td><strong>${item.tipo}</strong> (${item.count} alertas)</td>
                    <td class="criticidad-${item.criticidad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}">
                        ${item.criticidad}
                    </td>
                `;
                primeraFilaSucursal = false;
            } else {
                // filas siguientes (solo tipo y criticidad)
                row.innerHTML = `
                    <td><strong>${item.tipo}</strong> (${item.count} alertas)</td>
                    <td class="criticidad-${item.criticidad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}">
                        ${item.criticidad}
                    </td>
                `;
            }
            tbody.appendChild(row);
        });
    });
}

/**
 * Genera y renderiza una tabla con las alertas de seguridad por usuario.
 * @param {Array} alertas - Array de objetos de alerta.
 * @param {Array} usuarios - Array de objetos de usuario.
 */
function renderAlertasSeguridadTable(alertas, usuarios) {
     if (!alertas || alertas.length === 0 || !usuarios || usuarios.length === 0) {
        document.getElementById('ranking-alertas-seguridad-tbody').innerHTML = '<tr><td colspan="3" class="text-center">No hay datos suficientes para mostrar las alertas de seguridad.</td></tr>';
        return;
    }

    // ----------------------------------------------------
    // Diagnóstico de Data: Verificamos qué IDs se están cargando
    const loadedUserIds = usuarios.map(u => String(u._id));
    console.log(`[DIAGNOSTICO] Total de usuarios en el array: ${usuarios.length}`);
    console.log(`[DIAGNOSTICO] IDs cargados para el mapa: ${loadedUserIds.join(', ')}`);
    // ----------------------------------------------------

    // 1. Crear un mapa para vincular idUsuario con el nombre del usuario
    const usuariosMap = usuarios.reduce((map, usuario) => {
        if (usuario._id) {
            const userIdString = String(usuario._id); 
            map[userIdString] = usuario.username || usuario.email || 'Desconocido';
        }
        return map;
    }, {});

    // 2. Agrupar y contar las alertas de seguridad por usuario y tipo
    const dataAgrupada = alertas
        .filter(alerta => {
            const crit = (alerta.criticidad || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return crit === 'seguridad' && alerta.idUsuario;
        })
        .reduce((acc, alerta) => {
            const idUsuario = String(alerta.idUsuario); 
            
            if (!idUsuario || idUsuario === 'null' || idUsuario === 'undefined') {
                return acc;
            }

            if (!acc[idUsuario]) {
                acc[idUsuario] = {};
            }
            
            const tipoAlerta = alerta.tipoAlerta || 'Desconocido';

            if (!acc[idUsuario][tipoAlerta]) {
                acc[idUsuario][tipoAlerta] = 0;
            }
            acc[idUsuario][tipoAlerta]++;
            return acc;
        }, {});
    
    // 3. Renderizar la tabla (El resto del código se mantiene igual y es correcto)
    const tbody = document.getElementById('ranking-alertas-seguridad-tbody');
    tbody.innerHTML = ''; 

    const usuariosConAlertas = Object.keys(dataAgrupada);
    if (usuariosConAlertas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay alertas de seguridad para mostrar.</td></tr>';
        return;
    }

    usuariosConAlertas.forEach(idUsuario => {
        let primeraFilaUsuario = true;
        
        const nombreUsuario = usuariosMap[idUsuario] || idUsuario;
        
        // Mantenemos el logging de error solo si falla
        if (nombreUsuario === idUsuario) {
             console.warn(`[DATA ERROR] No se encontró usuario para el ID de alerta: ${idUsuario}.`);
        }
        
        const tiposAlertas = Object.keys(dataAgrupada[idUsuario]);

        tiposAlertas.forEach(tipoAlerta => {
            const count = dataAgrupada[idUsuario][tipoAlerta];
            const row = document.createElement('tr');
            if (primeraFilaUsuario) {
                row.innerHTML = `
                    <td rowspan="${tiposAlertas.length}">${nombreUsuario}</td>
                    <td>${tipoAlerta}</td>
                    <td>${count}</td>
                `;
                primeraFilaUsuario = false;
            } else {
                row.innerHTML = `
                    <td>${tipoAlerta}</td>
                    <td>${count}</td>
                `;
            }
            tbody.appendChild(row);
        });
    });
}

/**
 * Filtra las alertas por el período seleccionado y renderiza todos los componentes dependientes de la fecha.
 * @param {string} periodo - '24h', '7d', '30d', 'todos'
 */


// Cargar últimas conexiones de usuarios desde el backend
// --- Ordenamiento de la tabla de últimas conexiones ---
let userTableData = [];
let filtroFechaActivo = false;

async function cargarUltimasConexiones() {
    const res = await fetch('/ultimas_conexiones', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });
    userTableData = await res.json();
    filteredUserTableData = [...userTableData]; // Inicializa con todos los datos
    renderUserTable(filteredUserTableData);
}


function renderUserTable(data) {
    const tbody = document.getElementById('user-activity-table');
    tbody.innerHTML = '';

    // Paginación
    const totalResults = data.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalResults);
    const pageData = data.slice(startIdx, endIdx);

    pageData.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.username || ''}</td>
            <td>${u.email || ''}</td>
            <td>${u.fechaUltimoAcceso || ''}</td>
            <td>${u.estado || ''}</td>
        `;
        tbody.appendChild(tr);
    });

      // Actualiza texto "mostrando X de Y resultados"
    document.getElementById('current-results-showing').textContent = pageData.length;
    document.getElementById('total-results').textContent = totalResults;

    // Renderiza la paginación
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('user-table-pagination');
    pagination.innerHTML = '';

    // Flecha izquierda
    const prevItem = document.createElement('li');
    prevItem.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
    prevItem.innerHTML = `<a href="#" class="page-link">&larr;</a>`;
    prevItem.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderUserTable(filtroFechaActivo ? filteredUserTableData : userTableData);
        }
    });
    pagination.appendChild(prevItem);

    // Números de página (máximo 5 para no saturar)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = 'page-item' + (i === currentPage ? ' active' : '');
        li.innerHTML = `<a href="#" class="page-link">${i}</a>`;
        li.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage !== i) {
                currentPage = i;
                renderUserTable(filtroFechaActivo ? filteredUserTableData : userTableData);
            }
        });
        pagination.appendChild(li);
    }

    // Flecha derecha
    const nextItem = document.createElement('li');
    nextItem.className = 'page-item' + (currentPage === totalPages ? ' disabled' : '');
    nextItem.innerHTML = `<a href="#" class="page-link">&rarr;</a>`;
    nextItem.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            renderUserTable(filtroFechaActivo ? filteredUserTableData : userTableData);
        }
    });
    pagination.appendChild(nextItem);
}


let filteredUserTableData = []; // Nuevo: almacena el subconjunto filtrado

// Función de ordenamiento genérica
function sortUserTable(by, asc = true) {
    let sorted;
    if (filtroFechaActivo) {
        sorted = [...filteredUserTableData];
    } else {
        sorted = [...userTableData];
    }

    if (by === 'fecha') {
        sorted.sort((a, b) => {
            const parse = s => {
                if (!s) return 0;
                const [d, m, yAndTime] = s.split('/');
                const [y, time] = yAndTime.split(' ');
                return new Date(`${y}-${m}-${d}T${time || '00:00'}`);
            };
            return asc ? parse(a.fechaUltimoAcceso) - parse(b.fechaUltimoAcceso)
                       : parse(b.fechaUltimoAcceso) - parse(a.fechaUltimoAcceso);
        });
    } else if (by === 'estado') {
        sorted.sort((a, b) => {
            const estadoA = (a.estado || '').toLowerCase();
            const estadoB = (b.estado || '').toLowerCase();
            if (estadoA < estadoB) return asc ? -1 : 1;
            if (estadoA > estadoB) return asc ? 1 : -1;
            return 0;
        });
    }
    renderUserTable(sorted);
    // Actualiza el subconjunto filtrado para mantener el orden
    if (filtroFechaActivo) {
        filteredUserTableData = sorted;
    }
}

// Función para filtrar la tabla por período
function filtrarPorPeriodo(rango) {
    const hoy = new Date();
    let desde, hasta;
    switch(rango) {
        case 'hoy':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()+1);
            filtroFechaActivo = true;
            break;
        case 'ayer':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()-1);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
            filtroFechaActivo = true;
            break;
        case 'ultimos7':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()-6);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()+1);
            filtroFechaActivo = true;
            break;
        case 'ultimos30':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()-29);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()+1);
            filtroFechaActivo = true;
            break;
        case 'estemes':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth()+1, 1);
            filtroFechaActivo = true;
            break;
        case 'mespasado':
            desde = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            filtroFechaActivo = true;
            break;
        default:
            filtroFechaActivo = false;
            filteredUserTableData = [...userTableData];
            renderUserTable(filteredUserTableData);
            return;
    }
    filtroFechaActivo = true;
    filteredUserTableData = userTableData.filter(u => {
        if (!u.fechaUltimoAcceso) return false;
        const [d, m, yAndTime] = u.fechaUltimoAcceso.split('/');
        const [y, time] = yAndTime.split(' ');
        const fecha = new Date(`${y}-${m}-${d}T${time || '00:00'}`);
        return fecha >= desde && fecha < hasta;
    });
    renderUserTable(filteredUserTableData);
}

// Estado de orden actual
let fechaAsc = true;
let estadoAsc = true;


// SOLO el texto "Fecha" ordena
document.getElementById('fecha-sort-label').addEventListener('click', () => {
    sortUserTable('fecha', fechaAsc);
    fechaAsc = !fechaAsc;
});

// Estado sigue igual
document.getElementById('th-estado').addEventListener('click', () => {
    sortUserTable('estado', estadoAsc);
    estadoAsc = !estadoAsc;
});


// Redirigir a la página de sensores al hacer clic en los KPIs

document.getElementById('total-sensores').parentElement.onclick = () => {
    window.location.href = 'sensores.html';
};

document.getElementById('sensores-en-rango').parentElement.onclick = () => {
    window.location.href = 'sensores.html?rango=enRango';
};

document.getElementById('sensores-fuera-rango').parentElement.onclick = () => {
    window.location.href = 'sensores.html?rango=fueraRango';
};

document.getElementById('sensores-fallo').parentElement.onclick = () => {
    window.location.href = 'sensores.html?estado=OFFLINE';
};

const fechaAccordionBtn = document.getElementById('fechaAccordionBtn');
const collapseFecha = document.getElementById('collapseFecha');

fechaAccordionBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const expanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', !expanded);
    collapseFecha.style.display = expanded ? 'none' : 'block';
});

// Cerrar el acordeón si se hace click fuera
document.addEventListener('click', function(e) {
    if (!collapseFecha.contains(e.target) && e.target !== fechaAccordionBtn) {
        collapseFecha.style.display = 'none';
        fechaAccordionBtn.setAttribute('aria-expanded', 'false');
    }
});

// Filtrar por período seleccionado
collapseFecha.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        collapseFecha.style.display = 'none';
        fechaAccordionBtn.setAttribute('aria-expanded', 'false');
        const rango = this.getAttribute('data-range');
        filtrarPorPeriodo(rango);
    });
});


/**
 * Filtra las alertas por el período de tiempo seleccionado y renderiza el gráfico.
 * @param {string} periodo - '24h', '7d', '30d', '90d'.
 */
