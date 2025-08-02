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

async function getEstadoPuerta(sensorId) {
    try {
        const res = await fetch(`/sensor/${sensorId}/puerta`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!res.ok) {
            console.warn('No se pudo obtener el estado de la puerta');
            return null;
        }

        const data = await res.json();
        return data;
    } catch (err) {
        console.error('Error al obtener estado de puerta:', err);
        return null;
    }
}

async function getUltimaMedicion(sensorId) {
    try {
        const res = await fetch(`/sensor/${sensorId}/ultima`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.error('Error al obtener última medición:', err);
        return null;
    }
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Charts
let tempIntChart = null;
let tempExtChart = null;

async function getCantidadAperturas(sensorId) {
    try {
        const res = await fetch(`/sensor/${sensorId}/aperturas`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (!res.ok) return null;

        const data = await res.json();
        return data.cantidadAperturas;
    } catch (err) {
        console.error('Error al obtener cantidad de aperturas:', err);
        return null;
    }
}

async function getDuracionUltimaApertura(sensorId) {
    try {
        const res = await fetch(`/sensor/${sensorId}/puerta/duracion`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) {
            console.warn('No se pudo obtener la duración de la última apertura');
            return null;
        }

        return await res.json();
    } catch (err) {
        console.error('Error al obtener duración de apertura:', err);
        return null;
    }
}

async function cargarCards(sensor){
    try{
        const sensorId = parseInt(sensor.nroSensor);
        const alerta = sessionStorage.getItem('sensor_alarma'); // TODO: have to be updated

        // Mostrar datos del sensor
        document.getElementById('sensor-alias').textContent = sensor.alias;
        document.getElementById('sensor-nro').textContent = sensor.nroSensor;
        document.getElementById('sensor-notas').textContent = sensor.notas || 'No hay notas disponibles.';
        document.getElementById('sensor-estado').textContent = sensor.estado;
        document.getElementById('sensor-alerta').textContent = alerta;

        // Correr en paralelo
        const [ultimaMed, estadoPuerta, duracionApertura, cantidadAperturas] = await Promise.all([
            getUltimaMedicion(sensorId),
            getEstadoPuerta(sensorId),
            getDuracionUltimaApertura(sensorId),
            getCantidadAperturas(sensorId)
        ]);

        // Última medición
        if (ultimaMed && Object.keys(ultimaMed).length > 0) {
            const intTemp = ultimaMed.valorTempInt ?? null;
            const extTemp = ultimaMed.valorTempExt ?? null;
            const difTemp = (intTemp !== null && extTemp !== null) 
                ? (extTemp - intTemp).toFixed(2)
                : 'N/A';
            const puerta = ultimaMed.puerta === 1 ? 'Abierta' : 'Cerrada';

            document.getElementById('sensor-tempInt').textContent = 
                intTemp !== null ? `${intTemp}°C` : 'N/A';
            document.getElementById('sensor-tempExt').textContent = 
                extTemp !== null ? `${extTemp}°C` : 'N/A';
            document.getElementById('sensor-tempDif').textContent = 
                difTemp !== 'N/A' ? `${difTemp}°C` : 'N/A';
            document.getElementById('sensor-puerta').textContent = puerta || 'N/A';
        } else {
            document.getElementById('sensor-tempInt').textContent = 'N/A';
            document.getElementById('sensor-tempExt').textContent = 'N/A';
            document.getElementById('sensor-tempDif').textContent = 'N/A';
            document.getElementById('sensor-puerta').textContent = 'N/A';
        }

        // --- Estado puerta ---
        const duracion = estadoPuerta?.duracionEstadoActual || '';
        let textoDuracion = 'N/A';
        if (duracion.includes('day')) { 
            const partes = duracion.split(',');
            const dias = partes[0].split(' ')[0]; 
            textoDuracion = `${dias} día${dias === '1' ? '' : 's'}`;
        } else if (duracion.includes(':')) {
            const [horas, minutos] = duracion.split(':');
            textoDuracion = `${parseInt(horas)}h ${parseInt(minutos)}m`;
        }
        document.getElementById('sensor-puertaUltCam').textContent = textoDuracion;

        // --- Duración última apertura ---
        if (duracionApertura?.duracionUltimaApertura) {
            const dur = duracionApertura.duracionUltimaApertura;
            let textoDuracion;
            if (dur.includes('day')) {
                textoDuracion = dur.split(',')[0];
            } else {
                const tiempo = dur.split('.')[0];
                const [horas, minutos, segundos] = tiempo.split(':').map(n => parseInt(n, 10));
                if (horas > 0) textoDuracion = `${horas}h ${minutos}m ${segundos}s`;
                else if (minutos > 0) textoDuracion = `${minutos}m ${segundos}s`;
                else textoDuracion = `${segundos}s`;
            }
            document.getElementById('sensor-puertaDuracion').textContent = textoDuracion;
        } else {
            document.getElementById('sensor-puertaDuracion').textContent = 'N/A';
        }

        // --- Cantidad de aperturas ---
        document.getElementById('sensor-aperturas').textContent = 
            (cantidadAperturas !== null && cantidadAperturas !== undefined) 
                ? cantidadAperturas 
                : 'N/A';

    }
    catch(err){
        console.error('Error al cargar las cards:', err);
        alert('Ocurrió un error al cargar los datos del sensor.');
    }
}

const alias = sessionStorage.getItem('sensor_alias');

document.addEventListener('DOMContentLoaded', async () => {
    const estado = sessionStorage.getItem('sensor_estado');
    const alerta = sessionStorage.getItem('sensor_alarma');

    if (!alias || !estado || !alerta) return;

    const sensor = await getSensorByAlias(alias, token);
    await cargarCards(sensor);

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

    
});

function renderIAResponse(rawText, targetElementId) {
    if (!rawText) {
        document.getElementById(targetElementId).innerHTML = "<p>No se recibió respuesta de la IA.</p>";
        return;
    }

    let html = rawText
        // **Texto** → <strong>Texto</strong>
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        // # Titulo → <h2>Titulo</h2>, ## Subtitulo → <h3>Subtitulo</h3>
        .replace(/^### (.*)$/gm, "<h4>$1</h4>")
        .replace(/^## (.*)$/gm, "<h3>$1</h3>")
        .replace(/^# (.*)$/gm, "<h2>$1</h2>");

    // Procesar línea por línea
    let lines = html.split("\n").map(line => line.trim());

    let finalHTML = "";
    let inUL = false;
    let inOL = false;

    lines.forEach(line => {
        if (line.startsWith("*")) { // Lista no ordenada
            if (!inUL) { finalHTML += "<ul>"; inUL = true; }
            finalHTML += `<li>${line.replace(/^\*\s*/, "")}</li>`;
        } 
        else if (/^\d+\.\s/.test(line)) { // Lista ordenada
            if (!inOL) { finalHTML += "<ol>"; inOL = true; }
            finalHTML += `<li>${line.replace(/^\d+\.\s*/, "")}</li>`;
        } 
        else if (line === "") { 
            // Línea vacía, cerrar listas abiertas
            if (inUL) { finalHTML += "</ul>"; inUL = false; }
            if (inOL) { finalHTML += "</ol>"; inOL = false; }
        } 
        else {
            // Cerrar listas si veníamos dentro de una
            if (inUL) { finalHTML += "</ul>"; inUL = false; }
            if (inOL) { finalHTML += "</ol>"; inOL = false; }
            finalHTML += `<p>${line}</p>`;
        }
    });

    // Cerrar listas si quedaron abiertas
    if (inUL) finalHTML += "</ul>";
    if (inOL) finalHTML += "</ol>";

    const target = document.getElementById(targetElementId);
    target.innerHTML = `
        <h3>Resultado del análisis</h3>
        <div style="font-family: Poppins, sans-serif; white-space: normal; word-wrap: break-word;">
            ${finalHTML}
        </div>
    `;
    target.style.display = "block";
}

document.getElementById('btnAnalizar').addEventListener('click', async () => {
    if (!window.ultimaMediciones || window.ultimaMediciones.length === 0) {
        alert('No hay datos cargados para analizar');
        return;
    }

    const alias = sessionStorage.getItem('sensor_alias');
    const sensor = await getSensorByAlias(alias, token);
    if (!sensor) {
        alert('Sensor no encontrado.');
        return;
    }

    const sensorId = sensor.nroSensor;

    const res = await fetch(`/sensor/${sensorId}/analisis`, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            mediciones: window.ultimaMediciones,
            notas: sensor.notas || "" })
    });

    if (!res.ok) {
        alert('Error al obtener análisis');
        return;
    }

    const resultado = await res.json();
    
    renderIAResponse(resultado, "analisisResultado");
    
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
    const sensorId = parseInt(sensor.nroSensor);

    // Fetch mediciones reales
    const res = await fetch(`/mediciones?sensor_id=${sensorId}&desde=${fromDate}T00:00:00&hasta=${toDate}T23:59:59`, {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });
    const mediciones = await res.json();

    window.ultimaMediciones = mediciones; // guardar para usar luego

    document.getElementById('analisisResultado').style.display = 'none';
    document.getElementById('analisisResultado').innerHTML = '';

    if (!Array.isArray(mediciones) || mediciones.length === 0) {
        alert('No hay mediciones para ese rango.');
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
document.getElementById('refreshIcon').addEventListener('click', async() => {
    
    const sensor = await getSensorByAlias(alias, token);
    await cargarCards(sensor);
    
    // Simular el clic en el botón "Graficar"
    document.getElementById('btnGraficar').click();
});

// Botón Volver
document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = 'sensores.html';
});