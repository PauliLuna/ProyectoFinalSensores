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
        const [sensoresRes, alertasRes, usuariosRes] = await Promise.all([
            fetch('/sensores', { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch('/alertas', { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch('/usuarios', { headers: { 'Authorization': 'Bearer ' + token } })
        ]);

        const sensores = await sensoresRes.json();
        const alertas = await alertasRes.json();
        const usuarios = await usuariosRes.json();

        alertasData = alertas; // Guarda todas las alertas para filtrar después

        // ⚠️ Pasa ambos arrays a la función del gráfico
        renderAlertaSucursalesChart(alertas, sensores);
        renderAlertasRecurrentesTable(alertas, sensores);
        renderAlertasSeguridadTable(alertas, usuarios);

        // Carga inicial del gráfico de tendencias con el período por defecto
        renderAlertasTendenciaChart('24h'); 

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

    document.getElementById('periodSelectHome').addEventListener('change', function() {
        const periodo = this.value;
        // Filtra y renderiza todo el contenido filtrable según la fecha seleccionada
        renderContenidoFiltrable(periodo);
    });

    cargarUltimasConexiones();
    cargarRankingUsuariosActivos();
    cargarPiePermisosUsuarios();

    cargarAlertasParaBarra();
    cargarPorcentajeAlertasMes();
    cargarRankingSensores();

    document.querySelectorAll('#dropdownPeriodoAlertas + ul .dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const periodo = this.dataset.period;
            const dropdownButton = document.getElementById('dropdownPeriodoAlertas');
            dropdownButton.textContent = this.textContent;
            renderAlertasTendenciaChart(periodo);
        });
    });

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

    // 1. Crear un mapa para vincular idUsuario con el nombre del usuario
    const usuariosMap = usuarios.reduce((map, usuario) => {
        if (usuario._id) {
            map[usuario._id] = usuario.username || usuario.email || 'Desconocido';
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
            const idUsuario = alerta.idUsuario;
            const tipoAlerta = alerta.tipoAlerta || 'Desconocido';

            if (!acc[idUsuario]) {
                acc[idUsuario] = {};
            }

            if (!acc[idUsuario][tipoAlerta]) {
                acc[idUsuario][tipoAlerta] = 0;
            }
            acc[idUsuario][tipoAlerta]++;
            return acc;
        }, {});
    
    // 3. Renderizar la tabla con la estructura solicitada
    const tbody = document.getElementById('ranking-alertas-seguridad-tbody');
    tbody.innerHTML = ''; // Limpiar contenido previo

    const usuariosConAlertas = Object.keys(dataAgrupada);
    if (usuariosConAlertas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay alertas de seguridad para mostrar.</td></tr>';
        return;
    }

    usuariosConAlertas.forEach(idUsuario => {
        let primeraFilaUsuario = true;
        const nombreUsuario = usuariosMap[idUsuario] || idUsuario;
        const tiposAlertas = Object.keys(dataAgrupada[idUsuario]);

        tiposAlertas.forEach(tipoAlerta => {
            const count = dataAgrupada[idUsuario][tipoAlerta];
            const row = document.createElement('tr');
            if (primeraFilaUsuario) {
                // Primera fila para el usuario, con rowspan
                row.innerHTML = `
                    <td rowspan="${tiposAlertas.length}">${nombreUsuario}</td>
                    <td>${tipoAlerta}</td>
                    <td>${count}</td>
                `;
                primeraFilaUsuario = false;
            } else {
                // Filas subsiguientes, solo con los datos de la alerta
                row.innerHTML = `
                    <td>${tipoAlerta}</td>
                    <td>${count}</td>
                `;
            }
            tbody.appendChild(row);
        });
    });
}

// Variable global para almacenar el gráfico y los datos sin filtrar
let alertasTendenciaChart = null;
//sslet alertasData = [];

/**
 * Filtra las alertas por el período de tiempo seleccionado y renderiza el gráfico.
 * @param {string} periodo - '24h', '7d', '30d', '90d'.
 */

function renderAlertasTendenciaChart(periodo) {
    const ahora = new Date();
    let fechaInicio, pasoMs;

    switch (periodo) {
        case '24h':
            fechaInicio = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
            pasoMs = 60 * 60 * 1000; // 1 hora
            break;
        case '7d':
            fechaInicio = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
            pasoMs = 24 * 60 * 60 * 1000; // 1 día
            break;
        case '30d':
            fechaInicio = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
            pasoMs = 24 * 60 * 60 * 1000;
            break;
        case '90d':
            fechaInicio = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);
            pasoMs = 30 * 24 * 60 * 60 * 1000; // ~1 mes
            break;
        default:
            fechaInicio = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
            pasoMs = 60 * 60 * 1000;
    }

    // Clave estable: HH:00 para 24h, YYYY-MM-DD para otros periodos
    const keyFromDate = (d) => {
        if (periodo === '24h') return d.getHours().toString().padStart(2, '0') + ':00';
        return d.toISOString().slice(0, 10);
    };

    // Inicializar ejes con todo el rango (así la línea no "salta")
    const labels = [];
    const dataAgrupada = {};
    for (let t = new Date(fechaInicio); t <= ahora; t = new Date(t.getTime() + pasoMs)) {
        const k = keyFromDate(t);
        labels.push(k);
        dataAgrupada[k] = { critica: 0, informativa: 0, preventiva: 0, seguridad: 0 };
    }

    // Contar por criticidad
    const tipos = ['critica', 'informativa', 'preventiva', 'seguridad'];
    alertasData.forEach(alerta => {
        const rawFecha = alerta.fechaHoraAlerta?.$date || alerta.fechaHoraAlerta;
        const fechaAlerta = new Date(rawFecha);
        if (isNaN(fechaAlerta.getTime()) || fechaAlerta < fechaInicio || fechaAlerta > ahora) return;

        const k = keyFromDate(fechaAlerta);
        const crit = (alerta.criticidad || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        if (dataAgrupada[k] && tipos.includes(crit)) {
            dataAgrupada[k][crit]++;
        }
    });

    // Datasets
    const datasets = [
        { label: 'Críticas',     data: labels.map(l => dataAgrupada[l].critica),     borderColor: '#dc3545', backgroundColor: 'rgba(220,53,69,0.2)', fill: true, tension: 0.4 },
        { label: 'Informativas', data: labels.map(l => dataAgrupada[l].informativa), borderColor: '#ffc107', backgroundColor: 'rgba(255,193,7,0.2)', fill: true, tension: 0.4 },
        { label: 'Preventivas',  data: labels.map(l => dataAgrupada[l].preventiva),  borderColor: '#6c757d', backgroundColor: 'rgba(108,117,125,0.2)', fill: true, tension: 0.4 },
        { label: 'Seguridad',    data: labels.map(l => dataAgrupada[l].seguridad),   borderColor: '#17a2b8', backgroundColor: 'rgba(23,162,184,0.2)', fill: true, tension: 0.4 }
    ];

    // Render
    const ctx = document.getElementById('alertasTendenciaChart').getContext('2d');
    if (alertasTendenciaChart) alertasTendenciaChart.destroy();
    alertasTendenciaChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Cantidad de Alertas' } },
                x: { title: { display: true, text: 'Fecha' } }
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