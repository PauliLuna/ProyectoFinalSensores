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