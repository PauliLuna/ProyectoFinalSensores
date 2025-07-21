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
        const res = await fetch('/sensores', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        const sensores = await res.json();

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