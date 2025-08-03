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


let alertasData = [];

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/alertas");
        if (!response.ok) {
            if (response.status === 401) {
                alert("No autorizado. Por favor, inicia sesión.");
                window.location.href = "signin.html";
                return;
            }
            throw new Error("Error al cargar alertas");
        }
        alertasData = await response.json();
        renderTable(alertasData);
        renderPieChart(alertasData);
        renderLineChart(alertasData);
        updateKPICards(alertasData);
    } catch (error) {
        alert("No se pudieron cargar las alertas. Intenta nuevamente más tarde.");
        console.error("Error al cargar alertas:", error);
    }
});

function updateKPICards(data) {
    const counts = { critica: 0, informativa: 0, seguridad: 0, preventiva: 0 };
    data.forEach(a => counts[a.tipoAlerta] = (counts[a.tipoAlerta] || 0) + 1);

    document.getElementById('criticaCount').innerText = counts['crítica'] || 0;
    document.getElementById('informativaCount').innerText = counts['informativa'] || 0;
    document.getElementById('seguridadCount').innerText = counts['seguridad'] || 0;
    document.getElementById('preventivaCount').innerText = counts['preventiva'] || 0;
}

function renderTable(data) {
    const tbody = document.querySelector("#alarmsTable tbody");
    tbody.innerHTML = "";
    if (!data.length) {
        tbody.innerHTML = "<tr><td colspan='4'>No hay alertas registradas.</td></tr>";
        return;
    }

    data.forEach(alerta => {
        const row = `
            <tr>
                <td>${alerta.tipoAlerta}</td>
                <td>${alerta.mensajeAlerta}</td>
                <td>${alerta.sucursal || "–"}</td>
                <td>${new Date(alerta.fechaHoraAlerta).toLocaleString("es-AR")}</td>
            </tr>`;
        tbody.innerHTML += row;
    });
}

function renderPieChart(data) {
    const counts = data.reduce((acc, a) => {
        acc[a.tipoAlerta] = (acc[a.tipoAlerta] || 0) + 1;
        return acc;
    }, {});

    const ctx = document.getElementById("alertsPieChart").getContext("2d");
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function renderLineChart(data) {
    const countsByDay = {};
    data.forEach(alerta => {
        const date = new Date(alerta.fechaHoraAlerta).toLocaleDateString("es-AR");
        countsByDay[date] = (countsByDay[date] || 0) + 1;
    });

    const fechas = Object.keys(countsByDay).sort((a, b) => new Date(a) - new Date(b));

    const ctx = document.getElementById("alertsLineChart").getContext("2d");
    new Chart(ctx, {
        type: "line",
        data: {
            labels: fechas,
            datasets: [{
                label: "Alertas por día",
                data: fechas.map(f => countsByDay[f]),
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function filterByType(tipo) {
    const filtered = tipo ? alertasData.filter(a => a.tipoAlerta === tipo) : alertasData;
    renderTable(filtered);
}

function showAlarmsOnPeriod() {
    const period = document.getElementById('periodSelect').value;
    const now = new Date();
    let fromDate;

    switch (period) {
        case '24hs':
            fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7days':
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '1month':
            fromDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
        case '6months':
            fromDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
        default:
            fromDate = null;
    }

    let filtered = alertasData;
    if (fromDate) {
        filtered = alertasData.filter(a => new Date(a.fechaHoraAlerta) >= fromDate);
    }

    renderTable(filtered);
    renderPieChart(filtered);
    renderLineChart(filtered);
    updateKPICards(filtered);
}

//funciones para llenar la tabla de alertas
let currentPage = 1;
const pageSize = 10; // Cambia este valor si quieres más/menos filas por página
let dataAlertas = [];
let filtereddataAlertas = [];
let filtroFechaActivo = false;

// Cargar alertas desde el backend
async function cargarAlertas() {
    const res = await fetch('/alertas', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    dataAlertas = await res.json();
    filtereddataAlertas = [...dataAlertas];
    renderAlertasTable(filtereddataAlertas);
}

function parseFecha(fecha) {
    if (!fecha) return '';
    // Si es string tipo ISO
    if (typeof fecha === 'string') {
        // Si es formato ISO (ej: "2024-07-26T20:03:58.262+00:00")
        if (fecha.includes('T')) {
            return new Date(fecha);
        }
        // Si es timestamp numérico
        if (!isNaN(fecha)) {
            return new Date(Number(fecha));
        }
    }
    // Si es Date
    if (fecha instanceof Date) return fecha;
    // Si es objeto tipo { $date: ... }
    if (fecha.$date) return new Date(fecha.$date);
    return new Date(fecha);
}

function renderAlertasTable(data) {
    const tbody = document.getElementById('alerts-table');
    tbody.innerHTML = '';

    // Paginación
    const totalResults = data.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalResults);
    const pageData = data.slice(startIdx, endIdx);

    pageData.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${a.criticidad || ''}</td>
            <td>${a.mensajeAlerta || ''}</td>
            <td>${a.idSensor || ''}</td>
            <td>${a.alias || ''}</td>
            <td>${a.fechaHoraAlerta ? parseFecha(a.fechaHoraAlerta).toLocaleString("es-AR") : ''}</td>
        `;
        tbody.appendChild(tr);
    });

    // Actualiza texto "mostrando X de Y resultados"
    document.getElementById('current-results-showing').textContent = pageData.length;
    document.getElementById('total-results').textContent = totalResults;

    renderAlertasPagination(totalPages);
}

function renderAlertasPagination(totalPages) {
    const pagination = document.getElementById('alerts-table-pagination');
    pagination.innerHTML = '';

    // Flecha izquierda
    const prevItem = document.createElement('li');
    prevItem.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
    prevItem.innerHTML = `<a href="#" class="page-link">&larr;</a>`;
    prevItem.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderAlertasTable(filtroFechaActivo ? filtereddataAlertas : dataAlertas);
        }
    });
    pagination.appendChild(prevItem);

    // Números de página (máximo 5)
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
                renderAlertasTable(filtroFechaActivo ? filtereddataAlertas : dataAlertas);
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
            renderAlertasTable(filtroFechaActivo ? filtereddataAlertas : dataAlertas);
        }
    });
    pagination.appendChild(nextItem);
}

// Filtro por fecha (igual que en home.js)
function filtrarAlertasPorPeriodo(rango) {
    const hoy = new Date();
    let desde, hasta;
    switch(rango) {
        case 'hoy':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()+1);
            break;
        case 'ayer':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()-1);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
            break;
        case 'ultimos7':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()-6);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()+1);
            break;
        case 'ultimos30':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()-29);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()+1);
            break;
        case 'estemes':
            desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth()+1, 1);
            break;
        case 'mespasado':
            desde = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1);
            hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            break;
        default:
            filtroFechaActivo = false;
            filtereddataAlertas = [...dataAlertas];
            renderAlertasTable(filtereddataAlertas);
            return;
    }
    filtroFechaActivo = true;
    filtereddataAlertas = dataAlertas.filter(a => {
        if (!a.fechaHoraAlerta) return false;
        const fecha = parseFecha(a.fechaHoraAlerta);
        return fecha >= desde && fecha < hasta;
    });
    currentPage = 1;
    renderAlertasTable(filtereddataAlertas);
}

// Ordenamiento por fecha
let fechaAsc = true;
document.getElementById('fecha-sort-label').addEventListener('click', () => {
    let sorted;
    if (filtroFechaActivo) {
        sorted = [...filtereddataAlertas];
    } else {
        sorted = [...dataAlertas];
    }
    sorted.sort((a, b) => {
        const fa = a.fechaHoraAlerta ? new Date(a.fechaHoraAlerta) : new Date(0);
        const fb = b.fechaHoraAlerta ? new Date(b.fechaHoraAlerta) : new Date(0);
        return fechaAsc ? fa - fb : fb - fa;
    });
    renderAlertasTable(sorted);
    if (filtroFechaActivo) filtereddataAlertas = sorted;
    fechaAsc = !fechaAsc;
});

// Filtro por período desde el acordeón
document.querySelectorAll('#collapseFecha .dropdown-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('collapseFecha').style.display = 'none';
        document.getElementById('fechaAccordionBtn').setAttribute('aria-expanded', 'false');
        const rango = this.getAttribute('data-range');
        filtrarAlertasPorPeriodo(rango);
    });
});

// Acordeón de fecha
const fechaAccordionBtn = document.getElementById('fechaAccordionBtn');
const collapseFecha = document.getElementById('collapseFecha');
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

// Inicializar
document.addEventListener('DOMContentLoaded', cargarAlertas);