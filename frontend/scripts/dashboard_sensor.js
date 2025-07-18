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

async function getSensorByAlias(alias, token) {
    const sensores = await fetch('/sensores', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    }).then(r => r.json());

    return sensores.find(s => s.alias === alias);
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Charts
    let tempIntChart = null;
    let tempExtChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    const alias = sessionStorage.getItem('sensor_alias');
    const estado = sessionStorage.getItem('sensor_estado');
    const alerta = sessionStorage.getItem('sensor_alarma');

    if (!alias || !estado || !alerta) return;

    const sensor = await getSensorByAlias(alias, token);

    if (!sensor) {
        alert('No se encontró el sensor.');
        return;
    }

    // Fechas por defecto
    const hoy = new Date();
    const hace7dias = new Date();
    hace7dias.setDate(hoy.getDate() - 7);
    document.getElementById('desde').value = formatDate(hace7dias);
    document.getElementById('hasta').value = formatDate(hoy);

    // Lanzar gráfico automáticamente
    document.getElementById('btnGraficar').click();

    // Mostrar datos del sensor
    document.getElementById('sensor-alias').textContent = alias;
    document.getElementById('sensor-nro').textContent = sensor.nroSensor;
    document.getElementById('sensor-notas').textContent = sensor.notas || 'No hay notas disponibles.';
    document.getElementById('sensor-estado').textContent = estado;
    document.getElementById('sensor-alerta').textContent = alerta;
});

document.getElementById('btnGraficar').addEventListener('click', async () => {
    const fromDate = document.getElementById('desde').value;
    const toDate = document.getElementById('hasta').value;

    if (!fromDate || !toDate || new Date(fromDate) > new Date(toDate)) {
        alert('Por favor seleccioná un rango de fechas válido.');
        return;
    }

    const alias = sessionStorage.getItem('sensor_alias');
    const sensor = await getSensorByAlias(alias, token);
    if (!sensor) {
        alert('Sensor no encontrado.');
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
        document.getElementById('sensor-tempInt').textContent = 'N/A';
        document.getElementById('sensor-tempExt').textContent = 'N/A';
        document.getElementById('sensor-tempDif').textContent = 'N/A';

        document.getElementById('sensor-puerta').textContent = 'N/A';
        document.getElementById('sensor-puertaUltCam').textContent = 'N/A';
        document.getElementById('sensor-puertaDuracion').textContent = 'N/A';
        document.getElementById('sensor-aperturas').textContent = 'N/A';
        alert('No hay mediciones para ese rango.');
        return;
    }

    const labels = mediciones.map(m => new Date(m.fechaHoraMed).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }));
    const internalTemps = mediciones.map(m => m.valorTempInt);
    const externalTemps = mediciones.map(m => m.valorTempExt);

    // Calcular promedios
    const avgInternal = (internalTemps.reduce((a, b) => a + (b || 0), 0) / internalTemps.length).toFixed(2);
    const avgExternal = (externalTemps.reduce((a, b) => a + (b || 0), 0) / externalTemps.length).toFixed(2);

    document.getElementById('averageTemperatureInt').innerHTML = `
        <p><strong>Promedio temperatura interna:</strong> ${avgInternal} °C</p>
    `;

    document.getElementById('averageTemperatureExt').innerHTML = `
        <p><strong>Promedio temperatura externa:</strong> ${avgExternal} °C</p>
    `;

    // Temperatura interna
    const ctxInt = document.getElementById('tempIntChart').getContext('2d');
    if (tempIntChart) tempIntChart.destroy();
    tempIntChart = new Chart(ctxInt, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperatura interna (°C)',
                data: internalTemps,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.3,
                pointRadius: 1.5
            }]
        },
        options: {
            responsive: true,
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
                legend: { position: 'top' },
                title: {
                    display: true,
                    text: 'Serie de tiempo - Temperatura Interna',
                    font: { size: 20, weight: 'bold', family: 'Poppins' },
                    padding: { top: 10, bottom: 30 }
                }
            }
        }
    });

    // Temperatura externa
    const ctxExt = document.getElementById('tempExtChart').getContext('2d');
    if (tempExtChart) tempExtChart.destroy();
    tempExtChart = new Chart(ctxExt, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperatura externa (°C)',
                data: externalTemps,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.3,
                pointRadius: 1.5
            }]
        },
        options: {
            responsive: true,
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
                legend: { position: 'top' },
                title: {
                    display: true,
                    text: 'Serie de tiempo - Temperatura Externa',
                    font: { size: 20, weight: 'bold', family: 'Poppins' },
                    padding: { top: 10, bottom: 30 }
                }
            }
        }
    });

    // Obtener última medición del sensor
    let tempInt = null;
    let tempExt = null;
    let puerta = null;

    if (Array.isArray(mediciones) && mediciones.length > 0) {
        const ultimaMed = mediciones[mediciones.length - 1];
        tempInt = ultimaMed.valorTempInt ?? null;
        tempExt = ultimaMed.valorTempExt ?? null;
        puerta = ultimaMed.puerta === 1 ? 'Abierta' : 'Cerrada';
    }

    // Mostrar última medición
    document.getElementById('sensor-tempInt').textContent = tempInt + "°C" || 'N/A';
    document.getElementById('sensor-tempExt').textContent = tempExt + "°C" || 'N/A';
    document.getElementById('sensor-tempDif').textContent = tempExt - tempInt + "°C" || 'N/A';

    document.getElementById('sensor-puerta').textContent = puerta || 'N/A';
    document.getElementById('sensor-puertaUltCam').textContent = 'N/A';
    document.getElementById('sensor-puertaDuracion').textContent = 'N/A';
    document.getElementById('sensor-aperturas').textContent = 'N/A';
});

// Manejo del filtro de fechas predefinidas
document.getElementById('fechasFilter').addEventListener('change', () => {
    const option = document.getElementById('fechasFilter').value;

    if (option === 'custom') return; // El usuario quiere ingresar fechas manualmente

    const hoy = new Date();
    const desde = new Date(hoy); // Copia

    switch (option) {
        case '24h':
            desde.setDate(hoy.getDate() - 1);
            break;
        case '7d':
            desde.setDate(hoy.getDate() - 7);
            break;
        case '1m':
            desde.setMonth(hoy.getMonth() - 1);
            break;
        case '6m':
            desde.setMonth(hoy.getMonth() - 6);
            break;
        default:
            return;
    }

    const formatDate = (d) => d.toISOString().split('T')[0];
    document.getElementById('desde').value = formatDate(desde);
    document.getElementById('hasta').value = formatDate(hoy);

    // Lanzar automáticamente el gráfico
    document.getElementById('btnGraficar').click();
});

// Manejo de cambios en los campos de fecha manual
const fechasFilterSelect = document.getElementById('fechasFilter');
document.getElementById('desde').addEventListener('change', () => {
    fechasFilterSelect.value = 'custom';
});
document.getElementById('hasta').addEventListener('change', () => {
    fechasFilterSelect.value = 'custom';
});

// Botón Refrescar
document.getElementById('refreshIcon').addEventListener('click', () => {
    // Simular el clic en el botón "Graficar"
    document.getElementById('btnGraficar').click();
});

// Botón Volver
document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = 'sensores.html';
});