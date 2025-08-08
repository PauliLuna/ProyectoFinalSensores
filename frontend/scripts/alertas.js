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
        cargarSucursales(alertasData);
        filteredalertasData = [...alertasData];
        renderAll(filteredalertasData);
        renderPieChart(alertasData);
        renderLineChart(alertasData);
        updateKPICards(alertasData);
    } catch (error) {
        alert("No se pudieron cargar las alertas. Intenta nuevamente más tarde.");
        console.error("Error al cargar alertas:", error);
    }
});

function updateKPICards(data) {
    // Inicializa los contadores en 0
    const counts = { crítica: 0, informativa: 0, preventiva: 0, seguridad: 0 };
    data.forEach(a => {
        // Normaliza el texto para evitar problemas de tildes y mayúsculas
        let crit = (a.criticidad || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (crit === 'critica') counts.crítica++;
        else if (crit === 'informativa') counts.informativa++;
        else if (crit === 'preventiva') counts.preventiva++;
        else if (crit === 'seguridad') counts.seguridad++;
    });

    document.getElementById('criticaCount').innerText = counts.crítica;
    document.getElementById('informativaCount').innerText = counts.informativa;
    document.getElementById('preventivaCount').innerText = counts.preventiva;
    document.getElementById('seguridadCount').innerText = counts.seguridad; // Mostrará 0 si no hay
    // Agregar eventos a los selectores de filtros, filtra automáticamente al cambiar cualquier select
    ['periodSelect', 'criticidadSelect', 'sucursalSelect'].forEach(id => {
    document.getElementById(id).addEventListener('change', aplicarFiltrosGlobales);
    });
    // Agregar evento al botón de refrescar alertas
    document.getElementById('refreshIcon').addEventListener('click', async () => {
        try {
            const res = await fetch('/reanalizar_alertas', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) throw new Error("Error al reanalizar alertas");
            // Vuelve a cargar las alertas actualizadas
            await cargarAlertas();
            alert("Alertas reanalizadas correctamente.");
        } catch (error) {
            alert("No se pudieron reanalizar las alertas.");
            console.error(error);
        }
    });
}

function cargarSucursales(alertas) {
    const sucursalSelect = document.getElementById('sucursalSelect');
    // Extrae direcciones únicas
    const direcciones = [...new Set(alertas.map(a => a.alias || a.direccion || '').filter(d => d))];
    sucursalSelect.innerHTML = '<option value="todas">Todas las sucursales</option>';
    direcciones.forEach(dir => {
        const opt = document.createElement('option');
        opt.value = dir;
        opt.textContent = dir;
        sucursalSelect.appendChild(opt);
    });
}

function aplicarFiltrosGlobales() {
    let data = [...alertasData];

    // Filtro de fecha
    const period = document.getElementById('periodSelect').value;
    if (period !== 'todos') {
    // ...aplica filtro de fecha...
        const now = new Date();
        let fromDate = null;
        switch (period) {
            case '24hs': fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
            case '7days': fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
            case '1month': fromDate = new Date(now.setMonth(now.getMonth() - 1)); break;
            case '6months': fromDate = new Date(now.setMonth(now.getMonth() - 6)); break;
            default: fromDate = null;
        }
        if (fromDate) {
            data = data.filter(a => parseFecha(a.fechaHoraAlerta) >= fromDate);
        }
    }
    

    // Filtro de criticidad
    const crit = document.getElementById('criticidadSelect').value;
    if (crit !== 'todas') {
        data = data.filter(a => (a.criticidad || '').toLowerCase() === crit.toLowerCase());
    }

    // Filtro de sucursal/dirección
    const sucursal = document.getElementById('sucursalSelect').value;
    if (sucursal !== 'todas') {
        data = data.filter(a => (a.alias || a.direccion || '') === sucursal);
    }

    filteredalertasData = data;
    currentPage = 1;
    renderAll(filteredalertasData);
}

function renderAll(data) {
    renderAlertasTable(data);
    renderPieChart(data);
    renderLineChart(data);
    updateKPICards(data);
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

    renderPieChart(filtered);
    renderLineChart(filtered);
    updateKPICards(filtered);
}

//funciones para llenar la TABLA DE ALERTAS
let currentPage = 1;
const pageSize = 10; // Cambia este valor si quieres más/menos filas por página

let filteredalertasData = [];
let filtroFechaActivo = false;

// Cargar alertas desde el backend
async function cargarAlertas() {
    const res = await fetch('/alertas', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    alertasData = await res.json();
    filteredalertasData = [...alertasData];
    renderAlertasTable(filteredalertasData);
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
            renderAlertasTable(filtroFechaActivo ? filteredalertasData : alertasData);
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
                renderAlertasTable(filtroFechaActivo ? filteredalertasData : alertasData);
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
            renderAlertasTable(filtroFechaActivo ? filteredalertasData : alertasData);
        }
    });
    pagination.appendChild(nextItem);
}

// Ordenamiento por fecha
let fechaAsc = true;
document.getElementById('fecha-sort-label').addEventListener('click', () => {
    let sorted;
    if (filtroFechaActivo) {
        sorted = [...filteredalertasData];
    } else {
        sorted = [...alertasData];
    }
    sorted.sort((a, b) => {
        const fa = a.fechaHoraAlerta ? new Date(a.fechaHoraAlerta) : new Date(0);
        const fb = b.fechaHoraAlerta ? new Date(b.fechaHoraAlerta) : new Date(0);
        return fechaAsc ? fa - fb : fb - fa;
    });
    renderAlertasTable(sorted);
    if (filtroFechaActivo) filteredalertasData = sorted;
    fechaAsc = !fechaAsc;
});

// Inicializar
document.addEventListener('DOMContentLoaded', cargarAlertas);