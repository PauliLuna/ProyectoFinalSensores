window.alertsLineChart = null;

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

function normalizarAlerta(alerta) {
    // Si es de seguridad (no tiene idSensor pero sí idUsuario)
    if ((!alerta.idSensor || alerta.idSensor === "") && alerta.criticidad && alerta.criticidad.toLowerCase() === "seguridad") {
        alerta.idSensor = "N/A";
        alerta.alias = "N/A";
    }
    // Si no tiene alias pero sí idSensor, podés dejarlo vacío o buscarlo si tenés el mapeo
    if (!alerta.alias) alerta.alias = alerta.idSensor ? "" : "N/A";
    return alerta;
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Muestra loader
        document.body.classList.add('body-loading');
        const response = await fetch('/alertas', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        document.body.classList.remove('body-loading');
        if (!response.ok) {
            if (response.status === 401) {
                alert("No autorizado. Por favor, inicia sesión.");
                window.location.href = "signin.html";
                return;
            }
            throw new Error("Error al cargar alertas");
        }
        alertasData = await response.json();
        if (Array.isArray(alertasData) && alertasData.length === 0) {
            // Solo muestra este mensaje si realmente no hay alertas
            // Puedes mostrar un mensaje en la UI en vez de alert si prefieres
            // alert("No hay alertas para mostrar.");
        }
        cargarSucursales(alertasData);
        cargarSensoresPorSucursal(alertasData);
        filteredalertasData = [...alertasData];
        renderAll(filteredalertasData);

        // Agrega listeners solo una vez
        ['periodSelect', 'criticidadSelect', 'sucursalSelect', 'sensorSelect'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', aplicarFiltrosGlobales);
        });
        document.getElementById('sucursalSelect').addEventListener('change', () => {
            cargarSensoresPorSucursal(filteredalertasData);
            aplicarFiltrosGlobales();
        });

        // Lógica específica para deshabilitar filtros cuando se selecciona "Seguridad"
        document.getElementById('criticidadSelect').addEventListener('change', function() {
            const crit = this.value.toLowerCase();
            const sucursalSelect = document.getElementById('sucursalSelect');
            const sensorSelect = document.getElementById('sensorSelect');
            
            if (crit === 'seguridad') {

                // Limpiar filtros (resetear a "todas")
                sucursalSelect.value = 'todas';
                sensorSelect.value = 'todos';

                // Deshabilitar selects
               // Esperar al siguiente ciclo del event loop
                setTimeout(() => {
                    sucursalSelect.disabled = true;
                    sensorSelect.disabled = true;
                    sucursalSelect.classList.add('disabled-filter');
                    sensorSelect.classList.add('disabled-filter');

                    //Forzar re-render de alertas después de resetear selects
                    aplicarFiltrosGlobales();

                }, 50);

            } else {
                //  Habilitar nuevamente
                sucursalSelect.disabled = false;
                sensorSelect.disabled = false;
                sucursalSelect.classList.remove('disabled-filter');
                sensorSelect.classList.remove('disabled-filter');
            }
        });

        
        // Agregar evento al botón de refrescar alertas
        document.getElementById('refreshIcon').addEventListener('click', async () => {
            const overlay = document.getElementById('loading-overlay');
            overlay.style.display = 'flex';
            try {
                const res = await fetch('/reanalizar_alertas', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!res.ok) throw new Error("Error al reanalizar alertas");
                const result = await res.json();
                await cargarAlertas();
                // Resetear filtros globales
                document.getElementById('periodSelect').value = 'todos';
                document.getElementById('criticidadSelect').value = 'todas';
                document.getElementById('sucursalSelect').value = 'todas';
                document.getElementById('sensorSelect').value = 'todos';

                // ✅ Rehabilitar los selects (por si quedaron deshabilitados al elegir "seguridad")
                const sucursalSelect = document.getElementById('sucursalSelect');
                const sensorSelect = document.getElementById('sensorSelect');
                sucursalSelect.disabled = false;
                sensorSelect.disabled = false;
                sucursalSelect.classList.remove('disabled-filter');
                sensorSelect.classList.remove('disabled-filter');

                // Vuelve a mostrar toda la data
                filteredalertasData = [...alertasData];
                currentPage = 1;
                renderAll(filteredalertasData);
                alert(result.message || "Alertas reanalizadas correctamente.");
            } catch (error) {
                alert("No se pudieron reanalizar las alertas.");
                console.error(error);
            } finally {
                overlay.style.display = 'none';
            }
        });

        renderPieChart(filteredalertasData);
        renderLineChart(filteredalertasData);
        updateKPICards(alertasData);
    } catch (error) {
        document.body.classList.remove('body-loading');
        // Solo muestra el mensaje si realmente hay un error de red/backend
        setTimeout(() => {
            alert("No se pudieron cargar las alertas. Intenta nuevamente más tarde.");
        }, 2500); // Opcional: pequeño delay para evitar que aparezca instantáneamente
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

    const total = counts.crítica + counts.informativa + counts.preventiva + counts.seguridad;
    // Calcula porcentajes, evita división por cero
    const pct = {
        crítica: total ? (counts.crítica / total * 100).toFixed(1) : 0,
        informativa: total ? (counts.informativa / total * 100).toFixed(1) : 0,
        preventiva: total ? (counts.preventiva / total * 100).toFixed(1) : 0,
        seguridad: total ? (counts.seguridad / total * 100).toFixed(1) : 0
    };

    document.getElementById('criticaCount').innerText = counts.crítica;
    document.querySelector('#criticalCard .kpi-alerta-texto span').innerText = `(${pct.crítica}%)`;

    document.getElementById('informativaCount').innerText = counts.informativa;
    document.querySelector('#infoCard .kpi-alerta-texto span').innerText = `(${pct.informativa}%)`;

    document.getElementById('preventivaCount').innerText = counts.preventiva;
    document.querySelector('#preventivaCard .kpi-alerta-texto span').innerText = `(${pct.preventiva}%)`;

    document.getElementById('seguridadCount').innerText = counts.seguridad; // Mostrará 0 si no hay
        document.querySelector('#securityCard .kpi-alerta-texto span').innerText = `(${pct.seguridad}%)`;
}

function cargarSucursales(alertas) {
    const sucursalSelect = document.getElementById('sucursalSelect');
    // Extrae direcciones únicas de sensores con alerta
    const direcciones = [...new Set(alertas.map(a => a.direccion).filter(d => d))];
    sucursalSelect.innerHTML = '<option value="todas">Todas</option>';
    direcciones.forEach(dir => {
        const opt = document.createElement('option');
        opt.value = dir;
        opt.textContent = dir;
        sucursalSelect.appendChild(opt);
    });
}

function cargarSensoresPorSucursal(alertas) {
    const sucursal = document.getElementById('sucursalSelect').value;
    const sensorSelect = document.getElementById('sensorSelect');
    let sensores = [];

    if (sucursal === 'todas') {
        sensores = [...new Set(
            alertas
                .filter(a => a.alias && a.alias.includes(' - '))
                .map(a => a.alias.split(' - ')[1])
        )];
    } else {
        sensores = [...new Set(
            alertas
                .filter(a => {
                    const dirA = (a.direccion || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    const dirB = sucursal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    return dirA === dirB && a.alias && a.alias.includes(' - ');
                })
                .map(a => a.alias.split(' - ')[1])
        )];
    }

    sensorSelect.innerHTML = '<option value="todos">Todos</option>';
    sensores.forEach(display => {
        const opt = document.createElement('option');
        opt.value = display;
        opt.textContent = display;
        sensorSelect.appendChild(opt);
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
        data = data.filter(a => {
            // Normaliza para evitar problemas de tildes, mayúsculas, espacios
            const dirA = (a.direccion || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const dirB = sucursal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            return dirA === dirB;
        });
    }

    // Filtro de sensor
    const sensorAlias = document.getElementById('sensorSelect').value;
    if (sensorAlias !== 'todos') {
        data = data.filter(a => {
            if (!a.alias || !a.alias.includes(' - ')) return false;
            return a.alias.split(' - ')[1] === sensorAlias;
        });
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
    // Agrupa por tipoAlerta
    const counts = {};
    data.forEach(a => {
        if (!a.tipoAlerta) return;
        counts[a.tipoAlerta] = (counts[a.tipoAlerta] || 0) + 1;
    });

    // Determina criticidad activa para la paleta
    let criticidadActiva = document.getElementById('criticidadSelect').value;
    if (criticidadActiva === 'todas') criticidadActiva = null;
    if (criticidadActiva) {
        criticidadActiva = criticidadActiva
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace('í', 'i').replace('á', 'a');
    }

    

    // Normaliza el nombre para comparar
    function normalizarTexto(texto) {
        return (texto || '')
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9 ]/g, '') // quita caracteres especiales
            .replace(/\s+/g, ' ') // quita espacios dobles
            .trim();
    }

    // Paleta de colores por tipoAlerta y criticidad
    const colorMap = {
        critica: ["#ef4444", "#b91c1c", "#f87171", "#f43f5e"],
        informativa: ["#facc15", "#fde68a", "#fbbf24", "#f59e42"],
        seguridad: ["#3b82f6", "#60a5fa", "#2563eb", "#1e40af"],
        preventiva: ["#6b7280", "#d1d5db", "#9ca3af", "#374151"]
    };

    // Mapeo robusto de tipoAlerta a criticidad
    const tipoAlertaCriticidad = {
        "temperatura fuera de rango": "critica",
        "sensor offline": "critica",
        "puerta abierta prolongada": "critica",
        "ciclo de refrigeramiento asincronico": "critica",
        "caida de energia electrica": "preventiva",
        "caida energia electrica": "preventiva",
        "fluctuacion de temperatura excesiva": "preventiva",
        "puerta abierta recurrente": "preventiva",
        "inicio de ciclo de descongelamiento": "informativa",
        "inicio de ciclo de descongelamieno": "informativa",
        "fin de ciclo de descongelamiento": "informativa",
        "acceso nocturno": "seguridad",
        "bloqueo de usuario": "seguridad"
    };

    // Filtra los tipos de alerta según la criticidad
    let labels = Object.keys(counts);
    if (criticidadActiva) {
        labels = labels.filter(t => {
            const key = normalizarTexto(t);
            let crit = tipoAlertaCriticidad[key];
            if (!crit) return false;
            crit = crit.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return crit === criticidadActiva;
        });
    }

    // Asigna colores
    const colorList = [];
    let colorIdx = 0;
    labels.forEach(t => {
        const key = normalizarTexto(t);
        const crit = tipoAlertaCriticidad[key] || "informativa";
        const palette = colorMap[crit];
        colorList.push(palette[colorIdx % palette.length]);
        colorIdx++;
    });

    // Si ya existe una instancia del gráfico, la destruimos para evitar duplicados
    if (window.alertsPieChart && typeof window.alertsPieChart.destroy === 'function') {
        window.alertsPieChart.destroy();
    }

    // Responsive: ensancha el gráfico si la sidebar está colapsada
    const chartContainer = document.querySelector('.chart-container');
    if (document.body.classList.contains('sidebar-collapsed')) {
        chartContainer.style.maxWidth = "900px";
    } else {
        chartContainer.style.maxWidth = "600px";
    }

    const ctx = document.getElementById("alertsPieChart").getContext("2d");
    window.alertsPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: labels.map(l => counts[l]),
                backgroundColor: colorList,
                borderColor: "#fff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
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

function renderLineChart(data) {
    // Detecta el filtro de fecha
    const period = document.getElementById('periodSelect').value;
    let counts = {};
    let labels = [];

    if (period === '24hs') {
        // Agrupa por hora
        data.forEach(alerta => {
            const fecha = parseFecha(alerta.fechaHoraAlerta);
            const hora = fecha.getHours();
            const label = `${hora}:00`;
            counts[label] = (counts[label] || 0) + 1;
        });
        // Ordena las horas
        labels = Array.from({length: 24}, (_, i) => `${i}:00`);
    } else {
        // Agrupa por día
        data.forEach(alerta => {
            const fecha = parseFecha(alerta.fechaHoraAlerta);
            if (!(fecha instanceof Date) || isNaN(fecha)) return;
            const dia = fecha.toLocaleDateString("es-AR");
            counts[dia] = (counts[dia] || 0) + 1;
        });
        labels = Object.keys(counts).sort((a, b) => new Date(a) - new Date(b));
    }
     // Destruye el gráfico anterior si existe
    if (window.alertsLineChart && typeof window.alertsLineChart.destroy === 'function') {
        window.alertsLineChart.destroy();
    }

    const ctx = document.getElementById("alertsLineChart").getContext("2d");
    window.alertsLineChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: period === '24hs' ? "Alertas por hora" : "Alertas por día",
                    data: labels.map(l => counts[l] || 0),
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
    if (!fecha) return new Date(0);
    //if (!fecha) return '';
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
    return new Date(fecha) || new Date(0);
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

    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false, // Asegura el formato de 24 horas
        timeZone: 'America/Argentina/Buenos_Aires' // Especifica la zona horaria IANA
    };

    pageData.forEach(a => {
        const alerta = normalizarAlerta(a);

        // Mostrar dirección en columna Alias solo para Preventiva + Caída de energía eléctrica
        let aliasMostrar = alerta.alias || 'N/A';
        if (
            (alerta.criticidad || '').toLowerCase() === 'preventiva' &&
            (alerta.tipoAlerta || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'caida de energia electrica'
        ) {
            aliasMostrar = alerta.direccion || 'N/A';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${alerta.criticidad || ''}</td>
            <td>${alerta.mensajeAlerta || ''}</td>
            <td>${alerta.idSensor || 'N/A'}</td>
            <td>${aliasMostrar}</td>
            <td>${alerta.fechaHoraAlerta ? parseFecha(alerta.fechaHoraAlerta).toLocaleString("es-AR", options): ''}</td>
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
            renderAlertasTable(filteredalertasData);
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
                renderAlertasTable(filteredalertasData);
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
            renderAlertasTable(filteredalertasData);
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