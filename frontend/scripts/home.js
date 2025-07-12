if (!sessionStorage.getItem('authToken')) {
    window.location.href = "index.html";
}
const token = sessionStorage.getItem('authToken');

// Temperatura promedio por sucursal (ejemplo)
const tempSucursalCtx = document.getElementById('tempSucursalChart').getContext('2d');
new Chart(tempSucursalCtx, {
    type: 'bar',
    data: {
        labels: ['Sucursal Centro', 'Sucursal Norte', 'Sucursal Sur'],
        datasets: [{
            label: 'Temp. Promedio (°C)',
            data: [22.5, 24.1, 21.8],
            backgroundColor: ['#457B9D', '#A8DADC', '#F4A261'],
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    }
});

// Tendencia térmica reciente (ejemplo: 1 estable, 0 inestable)
const tendenciaSucursalCtx = document.getElementById('tendenciaSucursalChart').getContext('2d');
new Chart(tendenciaSucursalCtx, {
    type: 'line',
    data: {
        labels: ['Centro', 'Norte', 'Sur'],
        datasets: [{
            label: 'Estabilidad (1=Estable, 0=Inestable)',
            data: [1, 0, 1],
            borderColor: '#457B9D',
            backgroundColor: 'rgba(69,123,157,0.1)',
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                min: 0,
                max: 1,
                ticks: {
                    callback: function(value) {
                        return value === 1 ? 'Estable' : 'Inestable';
                    }
                }
            }
        }
    }
});

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

    } catch (error) {
        console.error('Error al cargar KPIs:', error);
    }
}

document.addEventListener('DOMContentLoaded', cargarKPIs);

// Cargar últimas conexiones de usuarios desde el backend
// --- Ordenamiento de la tabla de últimas conexiones ---
let userTableData = [];

async function cargarUltimasConexiones() {
    const res = await fetch('/ultimas_conexiones', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });
    userTableData = await res.json();
    renderUserTable(userTableData);
}
cargarUltimasConexiones();

function renderUserTable(data) {
    const tbody = document.getElementById('user-activity-table');
    tbody.innerHTML = '';
    data.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.username || ''}</td>
            <td>${u.email || ''}</td>
            <td>${u.fechaUltimoAcceso || ''}</td>
            <td>${u.estado || ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Función de ordenamiento genérica
function sortUserTable(by, asc = true) {
    let sorted = [...userTableData];
    if (by === 'fecha') {
        sorted.sort((a, b) => {
            // Fechas en formato "dd/mm/yyyy hh:mm"
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
            renderUserTable(userTableData);
            return;
    }
    // Filtrar userTableData por fechaUltimoAcceso en el rango
    const filtered = userTableData.filter(u => {
        if (!u.fechaUltimoAcceso) return false;
        // Asume formato "dd/mm/yyyy hh:mm"
        const [d, m, yAndTime] = u.fechaUltimoAcceso.split('/');
        const [y, time] = yAndTime.split(' ');
        const fecha = new Date(`${y}-${m}-${d}T${time || '00:00'}`);
                return fecha >= desde && fecha < hasta;
    });
    renderUserTable(filtered);
}