let currentPage = 1;
const pageSize = 5; // Cambia este valor si quieres más/menos filas por página


// Verificar si el usuario está autenticado y el token no está expirado
function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp) return false; // Si no hay expiración, se asume válido
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    } catch (e) {
        return true; // Si falla el decode, se considera inválido
    }
}

const token = sessionStorage.getItem('authToken');
if (!token || isTokenExpired(token)) {
    alert('Por favor, inicia sesión para acceder a esta página.');
    sessionStorage.removeItem('authToken');
    window.location.href = 'signin.html';
}

// Temperatura promedio por sucursal (ejemplo)
// Tendencia térmica reciente (ejemplo: 1 estable, 0 inestable)

// Cargar datos de KPIs desde el backend
async function cargarKPIs() {
    try {
        // Usa Promise.all para hacer las llamadas en paralelo
        const [sensoresRes, alertasRes] = await Promise.all([
            fetch('/sensores', { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch('/alertas', { headers: { 'Authorization': 'Bearer ' + token } })
        ]);

        const sensores = await sensoresRes.json();
        const alertas = await alertasRes.json();

        // ⚠️ Pasa ambos arrays a la función del gráfico
        renderAlertaSucursalesChart(alertas, sensores);

        // Total de sensores
        document.getElementById('total-sensores').textContent = sensores.length;

        // Sensores en rango
        const enRango = sensores.filter(s => s.enRango).length;
        document.getElementById('sensores-en-rango').textContent = enRango;

        // Sensores fuera de rango (solo los que tienen medición)
        const fueraRango = sensores.filter(s => s.enRango === false).length;
        document.getElementById('sensores-fuera-rango').textContent = fueraRango;

        // Sensores offline (fallos/sin señal)
        const offline = sensores.filter(s => s.estado && s.estado.toLowerCase() === 'offline').length;
        document.getElementById('sensores-fallo').textContent = offline;


        // Total de sensores
        const total = sensores.length;

        // a) % fuera de rango
        const pfueraRango = sensores.filter(s => s.enRango === false).length;
        const porcentajeFueraRango = total ? ((pfueraRango / total) * 100).toFixed(1) : 0;
        document.getElementById('porcentaje-fuera-rango').textContent = porcentajeFueraRango + "%";

        // b) % activos (estado === 'ONLINE')
        const pActivos = sensores.filter(s => s.estado && s.estado.toUpperCase() === 'ONLINE').length;
        const porcentajeActivos = total ? ((pActivos / total) * 100).toFixed(1) : 0;
        document.getElementById('porcentaje-activos').textContent = porcentajeActivos + "%";

        // c) % con retraso de envío de datos (estado === 'OFFLINE')
        const pOffline = sensores.filter(s => s.estado && s.estado.toUpperCase() === 'OFFLINE').length;
        const porcentajeRetraso = total ? ((pOffline / total) * 100).toFixed(1) : 0;
        document.getElementById('porcentaje-retraso-envio').textContent = porcentajeRetraso + "%";

    } catch (error) {
        console.error('Error al cargar KPIs:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarKPIs();
    cargarUltimasConexiones();
    cargarRankingUsuariosActivos();
    cargarPiePermisosUsuarios();

    cargarAlertasParaBarra();
    cargarPorcentajeAlertasMes();
    cargarRankingSensores();
});

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

async function cargarRankingUsuariosActivos() {
    const res = await fetch('/ultimas_conexiones', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    const conexiones = await res.json();

    // Filtrar conexiones del último mes
    const hoy = new Date();
    const haceUnMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
    const ingresosPorUsuario = {};

    conexiones.forEach(u => {
        if (!u.fechaUltimoAcceso || !u.username) return;
        const [d, m, yAndTime] = u.fechaUltimoAcceso.split('/');
        const [y, time] = yAndTime.split(' ');
        const fecha = new Date(`${y}-${m}-${d}T${time || '00:00'}`);
        if (fecha >= haceUnMes && fecha <= hoy) {
            ingresosPorUsuario[u.username] = (ingresosPorUsuario[u.username] || 0) + 1;
        }
    });

    // Top 3 usuarios
    const topUsuarios = Object.entries(ingresosPorUsuario)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    // Renderizar tabla
    const tbody = document.getElementById('top-users-table');
    tbody.innerHTML = '';
    topUsuarios.forEach(([usuario, ingresos]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${usuario}</td><td>${ingresos}</td>`;
        tbody.appendChild(tr);
    });
}

async function cargarPiePermisosUsuarios() {
    const res = await fetch('/asignaciones_empresa', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    const asignaciones = await res.json();

    let read = 0, edit = 0;
    asignaciones.forEach(a => {
        if (a.permiso && a.permiso.toLowerCase() === 'read') read++;
        else if (a.permiso && a.permiso.toLowerCase() === 'edit') edit++;
    });

    const ctxPermisos = document.getElementById('chart-permisos').getContext('2d');
    if (window.chartPermisos) window.chartPermisos.destroy();
    window.chartPermisos = new Chart(ctxPermisos, {
        type: 'pie',
        data: {
            labels: ['Read', 'Edit'],
            datasets: [{
                data: [read, edit],
                backgroundColor: ['#A8DADC', '#457B9D'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        color: '#1D3557',
                        font: { size: 13 },
                        boxWidth: 15
                    }
                }
            }
        }
    });
}

// Variable global para almacenar el gráfico
let alertasSucursalesChart = null;

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
    const sucursales = Object.keys(dataAgrupada);
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

function addBarTooltips(counts) {
    const bar = document.querySelector('.bar');
    if (!bar) return;

    // Elimina tooltips previos
    document.querySelectorAll('.bar-tooltip').forEach(t => t.remove());

    ['critica', 'informativa', 'preventiva', 'seguridad'].forEach(tipo => {
        const el = bar.querySelector('.' + tipo);
        if (!el) return;

        el.addEventListener('mouseenter', function(e) {
            let tooltip = document.createElement('div');
            tooltip.className = 'bar-tooltip';
            tooltip.innerText = `Cantidad: ${counts[tipo] || 0}`;
            document.body.appendChild(tooltip);

            // Posiciona el tooltip cerca del mouse
            const rect = el.getBoundingClientRect();
            tooltip.style.left = (rect.left + rect.width / 3 - tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = (rect.top - 32) + 'px';
            tooltip.style.opacity = 1;
            el._barTooltip = tooltip;
        });

        el.addEventListener('mouseleave', function(e) {
            if (el._barTooltip) {
                el._barTooltip.remove();
                el._barTooltip = null;
            }
        });
    });
}


async function cargarAlertasParaBarra() {
    try {
        const res = await fetch('/alertas', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const alertas = await res.json();

       // Contar por criticidad
        const counts = { critica: 0, informativa: 0, preventiva: 0 , seguridad:0};
        alertas.forEach(a => {
            let crit = (a.criticidad || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (crit === 'critica') counts.critica++;
            else if (crit === 'informativa') counts.informativa++;
            else if (crit === 'preventiva') counts.preventiva++;
            else if (crit === 'seguridad') counts.seguridad++;
        });

        // Calcular porcentajes
        const total = counts.critica + counts.informativa + counts.preventiva + counts.seguridad;
        document.getElementById('total_alertas').textContent = total;
        const pctCritica = total ? (counts.critica / total) * 100 : 0;
        const pctInformativa = total ? (counts.informativa / total) * 100 : 0;
        const pctPreventiva = total ? (counts.preventiva / total) * 100 : 0;
        const pctSeguridad = total ? (counts.seguridad / total) * 100 : 0;

        // Actualizar la barra
        document.querySelector('.bar .critica').style.width = pctCritica + "%";
        document.querySelector('.bar .informativa').style.width = pctInformativa + "%";
        document.querySelector('.bar .preventiva').style.width = pctPreventiva + "%";
        document.querySelector('.bar .seguridad').style.width = pctSeguridad + "%";

        // Mostrar porcentajes en la leyenda
        document.getElementById('pct-critica').textContent = `(${pctCritica.toFixed(1)}%)`;
        document.getElementById('pct-informativa').textContent = `(${pctInformativa.toFixed(1)}%)`;
        document.getElementById('pct-preventiva').textContent = `(${pctPreventiva.toFixed(1)}%)`;
        document.getElementById('pct-seguridad').textContent = `(${pctSeguridad.toFixed(1)}%)`;
   
        // Agregar tooltips
        addBarTooltips(counts);
   
    } catch (error) {
        console.error("Error al cargar alertas para la barra:", error);
    }
}

async function cargarPorcentajeAlertasMes() {
    const res = await fetch('/alertas_por_mes', { 
        headers: { 'Authorization': 'Bearer ' + token } 
    });
    const meses = await res.json();
    if (meses.length < 2) return;

    const actual = meses[0].count;
    const anterior = meses[1].count;
    const pct = anterior ? (((actual - anterior) / anterior) * 100).toFixed(1) : 0;
    const spanPct = document.getElementById('porcentajeAlertasMes');

    // Definir mensaje y color según el valor
    if (pct > 0) {
        spanPct.textContent = `⬆ ${pct}% respecto al mes anterior`;
        spanPct.classList.remove("text-danger");
        spanPct.classList.add("text-success");
    } else if (pct < 0) {
        spanPct.textContent = `⬇ ${Math.abs(pct)}% respecto al mes anterior`;
        spanPct.classList.remove("text-success");
        spanPct.classList.add("text-danger");
    } else {
        spanPct.textContent = `= ${pct}% respecto al mes anterior`;
        spanPct.classList.remove("text-success", "text-danger");
    }

}

async function cargarRankingSensores() {
  try {
    const res = await fetch('/alertas', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
    const alertas = await res.json();

    // Agrupar por sensor
    const agrupado = {};

    alertas.forEach(alerta => {
      const idSensor = alerta.idSensor || "Desconocido";
      let crit = (alerta.criticidad || "")
        .toLowerCase()
        .normalize("NFD")               // descompone tildes
        .replace(/[\u0300-\u036f]/g, ""); // elimina tildes

      if (!agrupado[idSensor]) {
        agrupado[idSensor] = { criticas: 0, informativas: 0, preventivas: 0, total: 0 };
      }

      if (crit === "critica") agrupado[idSensor].criticas++;
      else if (crit === "informativa") agrupado[idSensor].informativas++;
      else if (crit === "preventiva") agrupado[idSensor].preventivas++;

      agrupado[idSensor].total++;
    });

    // Convertir a array y ordenar por total
    const ranking = Object.entries(agrupado)
      .map(([idSensor, data]) => ({ idSensor, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3); // Top 3

    // Renderizar filas
    const tbody = document.getElementById("ranking-sensores");
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

  } catch (error) {
    console.error("Error cargando ranking de sensores:", error);
  }
}