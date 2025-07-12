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

// Sensor details
    document.addEventListener('DOMContentLoaded', () => {
        const alias = sessionStorage.getItem('sensor_alias');
        const estado = sessionStorage.getItem('sensor_estado');
        const alerta = sessionStorage.getItem('sensor_alarma');

        if (alias && estado && alerta) {
            document.getElementById('sensor-alias').textContent = alias;
            document.getElementById('sensor-estado').textContent = estado;
            document.getElementById('sensor-alerta').textContent = alerta;
    }
    });

// Chart
let tempChart = null;

document.getElementById('btnGraficar').addEventListener('click', async () => {
    const fromDateInput = document.getElementById('desde');
    const toDateInput = document.getElementById('hasta');
    const fromDate = fromDateInput.value;
    const toDate = toDateInput.value;

    if (!fromDate || !toDate || new Date(fromDate) > new Date(toDate)) {
        alert('Por favor seleccioná un rango de fechas válido.');
        return;
    }

    // Obtener el nroSensor del sessionStorage
    const sensorAlias = sessionStorage.getItem('sensor_alias');
    const sensores = await fetch('/sensores', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then(r => r.json());
    const sensor = sensores.find(s => s.alias === sensorAlias);
    if (!sensor) {
        alert('No se encontró el sensor.');
        return;
    }
    const sensorId = sensor.nroSensor;

    // Fetch mediciones reales
    const res = await fetch(`/mediciones?sensor_id=${sensorId}&desde=${fromDate}T00:00:00&hasta=${toDate}T23:59:59`, {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });
    const mediciones = await res.json();

    if (!Array.isArray(mediciones) || mediciones.length === 0) {
        alert('No hay mediciones para ese rango.');
        return;
    }

    const labels = mediciones.map(m => new Date(m.fechaHoraMed).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }));
    const internalTemps = mediciones.map(m => m.valorTempInt);
    const externalTemps = mediciones.map(m => m.valorTempExt);

    // Calcular promedios
    const avgInternal = (internalTemps.reduce((a, b) => a + (b || 0), 0) / internalTemps.length).toFixed(2);
    const avgExternal = (externalTemps.reduce((a, b) => a + (b || 0), 0) / externalTemps.length).toFixed(2);

    document.getElementById('averageTemperatures').innerHTML = `
        <p><strong>Promedio temperatura interna:</strong> ${avgInternal} °C</p>
        <p><strong>Promedio temperatura externa:</strong> ${avgExternal} °C</p>
    `;

    const ctx = document.getElementById('temperatureChart').getContext('2d');
    if (window.tempChart) window.tempChart.destroy();
    window.tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temperatura interna (°C)',
                    data: internalTemps,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.3,
                    pointRadius: 1.5
                },
                {
                    label: 'Temperatura externa (°C)',
                    data: externalTemps,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.3,
                    pointRadius: 1.5
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 60,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Temperatura (°C)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Serie de tiempo de temperaturas',
                    font: {
                        size: 20,
                        weight: 'bold',
                        family: 'Poppins'
                    },
                    padding: {
                        top: 10,
                        bottom: 30
                    }
                }
            }
        }
    });
});