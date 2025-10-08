// ------------------- SEGURIDAD -------------------
const REQUIRED_ROLE = 'superAdmin';

const token = sessionStorage.getItem('authToken');
const userData = isTokenExpired(token);
const userRole = userData ? userData.entity_type : null;

 // 1. Validar Token y Expiración
if (!userData) {
    // Si no hay token o está expirado/inválido
    sessionStorage.removeItem('authToken');

    if (token) {
        window.location.href = 'sesion_expired.html';
    } else {
        window.location.href = 'acceso_denegado.html';
    }
}
// Ambos roles permitidos
// ------------------- FIN -------------------

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
let aperturasChart = null;

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

// --- Lógica para termómetros y escala dinámica ---
function updateThermometers(tempInt, tempExt, notas) {
    let minRangeInt, maxRangeInt;

    // Obtener el rango de temperatura del campo de notas
    const regex = /(-?\d+)\s*°C\s*a\s*(-?\d+)\s*°C/;
    const match = notas.match(regex);

    if (match) {
        let minTemp = parseInt(match[1]);
        let maxTemp = parseInt(match[2]);
        [minRangeInt, maxRangeInt] = minTemp < maxTemp ? [minTemp, maxTemp] : [maxTemp, minTemp];
        
        // ⚠️ Aplicar tu lógica: expandir el rango en 5 grados
        minRangeInt -= 5;
        maxRangeInt += 5;
    } else {
        // Rangos por defecto para temperatura interna si no hay notas
        minRangeInt = -30;
        maxRangeInt = 10;
    }

    // Rangos fijos para temperatura externa, también expandidos para mejor visualización
    const minRangeExt = 0;
    const maxRangeExt = 45;

    // Función para generar y mostrar la escala del termómetro
    function setScale(wrapperId, min, max) {
        const wrapper = document.getElementById(wrapperId);
        let scaleHtml = '';
        const numTicks = 4; // Número de marcas de escala
        const step = (max - min) / numTicks;

        for (let i = 0; i <= numTicks; i++) {
            const tempValue = min + step * i;
            scaleHtml = `<span class="scale-label" style="bottom: ${i * (100 / numTicks)}%">${Math.round(tempValue)}°</span>` + scaleHtml;
        }

        const scaleContainer = wrapper.querySelector('.thermometer-scale');
        if (scaleContainer) {
            scaleContainer.innerHTML = scaleHtml;
        }
    }

    // Función auxiliar para actualizar un termómetro individual
    function setTemperature(elementId, temp, min, max, isInternal) {
        const mercuryElement = document.getElementById(elementId);
        if (!mercuryElement) return;

        // Calcular la altura relativa de la barra de mercurio
        const totalRange = max - min;
        const normalizedTemp = temp - min;

        // ⚠️ Ajuste de la fórmula para que el llenado sea más visual

        const heightPct = ((normalizedTemp / totalRange) * 100) ;
        
        mercuryElement.style.height = `${Math.max(0, Math.min(100, heightPct))}%`;
        mercuryElement.dataset.value = `${temp}°C`;

        // Lógica de color condicional
        mercuryElement.classList.remove('normal', 'warning', 'critical', 'external');

        if (isInternal) {
            let colorClass;
            // La lógica de color usa el rango de las notas
            const minNota = min + 5;
            const maxNota = max - 5;

            if (temp >= minNota && temp <= maxNota) {
                colorClass = 'normal';
            } else if ((temp >= minNota - 2 && temp < minNota) || (temp > maxNota && temp <= maxNota + 2)) {
                colorClass = 'warning';
            } else {
                colorClass = 'critical';
            }
            mercuryElement.classList.add(colorClass);
        } else {
            // La temperatura externa siempre es azul
            mercuryElement.classList.add('external');
        }
    }
    
    // Llamar a las funciones para cada termómetro con sus propias escalas
    setScale('termometer-int-wrapper', minRangeInt, maxRangeInt);
    setScale('termometer-ext-wrapper', minRangeExt, maxRangeExt);
    setTemperature('temp-int', parseFloat(tempInt), minRangeInt, maxRangeInt, true);
    setTemperature('temp-ext', parseFloat(tempExt), minRangeExt, maxRangeExt, false);
}

function parseFecha(fecha) {
    if (!fecha) return null;
    if (typeof fecha === 'string') {
        if (fecha.includes('T')) return new Date(fecha);
        if (!isNaN(fecha)) return new Date(Number(fecha));
    }
    if (fecha instanceof Date) return fecha;
    if (fecha.$date) return new Date(fecha.$date);
    return new Date(fecha);
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
            
            console.log('Actualizando termómetros con:',ultimaMed);

              // Llamar a la función para actualizar los termómetros
            updateThermometers(intTemp, extTemp, sensor.notas || '');

                    // ⚠️ Lógica para la fecha y hora. Se ejecuta siempre.
            if (ultimaMed && ultimaMed.fechaHoraMed) {
                const fechaHoraUTC = parseFecha(ultimaMed.fechaHoraMed);
                if (fechaHoraUTC && !isNaN(fechaHoraUTC)) {
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
                    const fechaHoraFormateada = fechaHoraUTC.toLocaleString('es-AR', options);
                    document.getElementById('last-measurement-time').textContent = fechaHoraFormateada;
                } else {
                    document.getElementById('last-measurement-time').textContent = 'N/A';
                }
            } else {
                document.getElementById('last-measurement-time').textContent = 'N/A';
            }
        
        } else {
            // Si no hay mediciones, los termómetros deben reflejarlo.
            updateThermometers(null, null, '');

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

    await cargarAlertasParaBarra(sensor.nroSensor);

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
    // Mostrar el overlay de carga al inicio del proceso
    document.getElementById('loading-overlay').style.display = 'flex';
    try{
        if (!window.ultimaMediciones || window.ultimaMediciones.length === 0) {
            document.getElementById('noDatosMessage').textContent =
                "No hay datos cargados para analizar";
            document.getElementById('noDatosModal').style.display = 'block';
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

    } catch (error) {
        console.error('Error durante el análisis:', error);
    } finally {
        // Ocultar el overlay de carga al finalizar, incluso si hay un error
        document.getElementById('loading-overlay').style.display = 'none';
    }
});

// Cerrar el modal de no datos cargados para analizar
document.getElementById('closeNoDatosModal').onclick = function() {
    document.getElementById('noDatosModal').style.display = 'none';
};

document.getElementById('btnGraficar').addEventListener('click', async () => {
    const fromDate = document.getElementById('desde').value;
    const toDate = document.getElementById('hasta').value;

    if (!fromDate || !toDate || new Date(fromDate) > new Date(toDate)) {
        document.getElementById('noDatosMessage').textContent =
                "Por favor seleccioná un rango de fechas válido.";
        document.getElementById('noDatosModal').style.display = 'block';
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

    // --- Ocultar o mostrar #graficas
    const graficasDiv = document.getElementById('graficas');
    if (!Array.isArray(mediciones) || mediciones.length === 0) {
        graficasDiv.style.display = 'none';
        document.getElementById('noDatosMessage').textContent =
                "No hay mediciones para ese rango.";
            document.getElementById('noDatosModal').style.display = 'block';
        return; // <-- salimos para evitar render vacío
    } else {
        graficasDiv.style.display = 'block';
    }
    // ---

    const labels = mediciones.map(m => new Date(m.fechaHoraMed).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }));
    const internalTemps = mediciones.map(m => m.valorTempInt);
    const externalTemps = mediciones.map(m => m.valorTempExt);
    const aperturas = mediciones.map(m => m.puerta);

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

    // Aperturas
    const ctxAper = document.getElementById('aperturasChart').getContext('2d');
    if (aperturasChart) aperturasChart.destroy();
    aperturasChart = new Chart(ctxAper, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Estado de la Puerta',
                data: aperturas, // Asumiendo 'aperturas' array contiene 0s y 1s
                borderColor: 'rgba(68, 114, 196, 1)', // Azul para el borde
                backgroundColor: 'rgba(68, 114, 196, 0.5)', // Azul con transparencia para el fondo
                tension: 0.3,
                pointRadius: 1.5,
                stepped: true // Usa línea escalonada para datos binarios
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
                    beginAtZero: true,
                    max: 1.1,
                    ticks: {
                        callback: function(value, index, ticks) {
                            if (value === 1) {
                                return 'Abierta';
                            } else if (value === 0) {
                                return 'Cerrada';
                            }
                            return '';
                        },
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'Estado de la Puerta'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.raw === 1) {
                                label += 'Abierta';
                            } else if (context.raw === 0) {
                                label += 'Cerrada';
                            }
                            return label;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Serie de tiempo - Estado de la Puerta',
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
    document.getElementById('loading-overlay').style.display = 'flex';
    try {
        const sensor = await getSensorByAlias(alias, token);
        await cargarCards(sensor);

        await cargarAlertasParaBarra(sensor.nroSensor);

        // Simular el clic en el botón "Graficar"
        document.getElementById('btnGraficar').click();

        // Chequear si hay nuevas mediciones
        const ultimaMed = await getUltimaMedicion(sensor.nroSensor);
        if (!ultimaMed || !ultimaMed.fechaHoraMed) {
            document.getElementById('successMessage').textContent =
            "No hay nuevas mediciones para este sensor.";
            document.getElementById('successModal').style.display = 'block';
        } else {
            document.getElementById('successMessage').textContent =
            "Datos actualizados correctamente.";
            document.getElementById('successModal').style.display = 'block';
        }
    } catch (err) {
        alert('Error al refrescar los datos.');
        console.error(err);
    } finally {
        document.getElementById('loading-overlay').style.display = 'none';
    }
});

// Cerrar el modal de éxito
document.getElementById('closeModal').onclick = function() {
    document.getElementById('successModal').style.display = 'none';
};

// Botón Volver
document.getElementById('btnVolver').addEventListener('click', () => {
    if (userRole === 'superAdmin') {
        window.location.href = 'sensores.html';
    } else if (userRole === 'usuario') {
        window.location.href = 'sensoresUser.html';
    } else {
        // Por si aparece otro rol inesperado
        console.warn('Rol desconocido:', userRole);
        window.location.href = 'signin.html';
    }
});

// Agrega el HTML para el overlay de carga. Esto se puede poner en el cuerpo de tu HTML.
// Se oculta por defecto.
const loadingOverlayHTML = `
    <div id="loading-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.8); z-index: 1000; justify-content: center; align-items: center;">
        <div style="width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', loadingOverlayHTML);

// Define la animación del spinner en CSS
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
document.head.appendChild(styleSheet);

// Botón Descargar PDF
document.getElementById('btnDescargar').addEventListener('click', async () => {
    // Mostrar el overlay de carga
    document.getElementById('loading-overlay').style.display = 'flex';

    try{
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 10;
        const innerWidth = pageWidth - 2 * margin;

        // === Variables de estilo consistentes ===
        const mainTitleColor = [40, 40, 40];      // Gris oscuro para títulos principales
        const subtitleColor = [60, 60, 60];       // Gris medio para subtítulos
        const lightTextColor = [100, 100, 100];    // Gris claro para detalles (como títulos de cards)
        const lineColor = [200, 200, 200];      // Gris muy claro para las líneas

        // === Logo a la derecha ===
        const logo = new Image();
        logo.src = '../assets/logo1.png';
        await new Promise(resolve => { logo.onload = resolve; });
        const logoWidth = 40;
        const logoHeight = 15;
        const logoX = pageWidth - logoWidth - margin;
        pdf.addImage(logo, 'PNG', logoX, margin, logoWidth, logoHeight);

        // === Estilo de fuente y texto del encabezado ===
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(22);
        pdf.setTextColor(mainTitleColor[0], mainTitleColor[1], mainTitleColor[2]);
        pdf.text('Reporte de Sensor', margin, 20);

        // === Información del sensor y rango de fechas (subtítulos) ===
        const sensorAlias = document.getElementById('sensor-alias').textContent;
        const sensorNro = document.getElementById('sensor-nro').textContent;
        const fromDate = document.getElementById('desde').value;
        const toDate = document.getElementById('hasta').value;
        let sensorNotes = document.getElementById('sensor-notas').textContent;

        // Pre-procesar las notas para asegurar la correcta visualización de caracteres especiales.
        sensorNotes = sensorNotes.replace(/°/g, ' ').replace(/[\u00A0\u202F]/g, ' ');

        console.log(sensorNotes);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.setTextColor(subtitleColor[0], subtitleColor[1], subtitleColor[2]);
        pdf.text(`Sensor: ${sensorNro} - ${sensorAlias}`, margin, 30);
        
        let currentYPos = 37; // Posición Y inicial después del rango de fechas
        pdf.text(`Rango de fechas: ${fromDate} a ${toDate}`, margin, currentYPos);
        currentYPos += 7; // Espacio después del rango de fechas
        pdf.text(`Notas: ${sensorNotes}`, margin, currentYPos);
        currentYPos += 3; // Espacio después de las notas

        // Línea separadora
        pdf.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
        pdf.line(margin, currentYPos + 5, pageWidth - margin, currentYPos + 5);
        

        // --- Sección de resumen ---
        let y = currentYPos + 15;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(mainTitleColor[0], mainTitleColor[1], mainTitleColor[2]);
        pdf.text('Resumen de Datos', margin, y);
        y += 10;

        const cardGap = 5;
        const cardHeight = 25;
        const marginY = 5;

        const titleFontSize = 9;
        const titleColor = lightTextColor;

        const valueFontSize = 14;
        const valueColor = [0, 0, 0];
        const valueBold = 'bold';
        const valueNormal = 'normal';

        const tempInt = document.getElementById('sensor-tempInt').textContent;
        const tempExt = document.getElementById('sensor-tempExt').textContent;
        const tempDif = document.getElementById('sensor-tempDif').textContent;
        const puerta = document.getElementById('sensor-puerta').textContent;
        const ultimaDuracion = document.getElementById('sensor-puertaDuracion').textContent;
        const ultimaCam = document.getElementById('sensor-puertaUltCam').textContent;
        const aperturas = document.getElementById('sensor-aperturas').textContent;

        // --- PRIMERA FILA: 3 TARJETAS ---
        const cardWidth3 = (innerWidth - (2 * cardGap)) / 3;
        const cards3 = [
        {title: 'Temp. Interna', value: tempInt},
        {title: 'Temp. Externa', value: tempExt},
        {title: 'Diferencia', value: tempDif}
        ];

        cards3.forEach((card, index) => {
            const xPos = margin + index * (cardWidth3 + cardGap);
            pdf.setFillColor(245, 245, 245);
            pdf.roundedRect(xPos, y, cardWidth3, cardHeight, 3, 3, 'F');
            pdf.setFontSize(titleFontSize);
            pdf.setTextColor(...titleColor);
            pdf.text(card.title, xPos + 5, y + 6);
            pdf.setFontSize(valueFontSize);
            pdf.setTextColor(...valueColor);
            pdf.setFont('helvetica', valueBold);
            pdf.text(card.value, xPos + 5, y + 16);
        });

        y += cardHeight + marginY;

        // --- SEGUNDA FILA: 4 TARJETAS ---
        const cardWidth4 = (innerWidth - (3 * cardGap)) / 4;
        const cards4 = [
        {title: 'Puerta', value: puerta},
        {title: 'Aperturas', value: aperturas},
        {title: 'Duración', value: ultimaDuracion},
        {title: 'Último cambio', value: ultimaCam}
        ];

        pdf.setFont('helvetica', valueNormal);
        cards4.forEach((card, index) => {
            const xPos = margin + index * (cardWidth4 + cardGap);
            pdf.setFillColor(245, 245, 245);
            pdf.roundedRect(xPos, y, cardWidth4, cardHeight, 3, 3, 'F');
            pdf.setFontSize(titleFontSize);
            pdf.setTextColor(...titleColor);
            pdf.text(card.title, xPos + 5, y + 6);
            pdf.setFontSize(valueFontSize);
            if (card.title === 'Puerta') {
                pdf.setTextColor(...(card.value.includes('Abierta') ? [205, 92, 92] : [68, 114, 196]));
            } else {
                pdf.setTextColor(...valueColor);
            }
            pdf.text(card.value, xPos + 5, y + 16);
        });

        y += cardHeight + marginY + 5;

        // ---  SECCIÓN DE ALERTAS ---
        const sensorNroForAlerts = document.getElementById('sensor-nro').textContent;
        const alertCounts = await cargarAlertasParaBarra(sensorNroForAlerts);

        // Subtítulo de la sección de alertas
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(mainTitleColor[0], mainTitleColor[1], mainTitleColor[2]);
        pdf.text('Resumen de Alertas', margin, y);
        y += 8;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(subtitleColor[0], subtitleColor[1], subtitleColor[2]);
        
        // Mostrar el total de alertas
        pdf.text(`Total de alertas detectadas: ${alertCounts.total}`, margin, y);
        y += 8;

        // Mostrar el desglose por tipo de alerta
        pdf.setTextColor([74, 74, 74][0], [74, 74, 74][1], [74, 74, 74][2]);
        pdf.text(`- Críticas: ${alertCounts.critica}`, margin + 5, y);
        y += 5;
        pdf.text(`- Preventivas: ${alertCounts.preventiva}`, margin + 5, y);
        y += 5;
        pdf.text(`- Informativas: ${alertCounts.informativa}`, margin + 5, y);
        y += 5;

        // Línea separadora
        pdf.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 1;
        
        // === Resultado del análisis IA ===
        const analisisElement = document.getElementById('analisisResultado');
        const hasContent = analisisElement.textContent.trim() !== '';

        if (hasContent) {
            const originalFontSize = window.getComputedStyle(analisisElement).fontSize;
            analisisElement.style.fontSize = '1.2rem';

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(14);
            pdf.setTextColor(mainTitleColor[0], mainTitleColor[1], mainTitleColor[2]);
            y += 10;
            
            const canvasAnalisis = await html2canvas(analisisElement, {
                scale: 2,
                useCORS: true
            });
            analisisElement.style.fontSize = originalFontSize; // Restaurar el tamaño de fuente original

            const imgDataAnalisis = canvasAnalisis.toDataURL('image/png');
            const imgPropsAnalisis = pdf.getImageProperties(imgDataAnalisis);
            const imgHeightAnalisis = (imgPropsAnalisis.height * innerWidth) / imgPropsAnalisis.width;
            
            if (y + imgHeightAnalisis > 280) pdf.addPage();
            pdf.addImage(imgDataAnalisis, 'PNG', margin, y, innerWidth, imgHeightAnalisis);
            y += imgHeightAnalisis + 10;
        } else {
            y += 8;
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(11);
            pdf.setTextColor(lightTextColor[0], lightTextColor[1], lightTextColor[2]);
            pdf.text('No hay un análisis de IA disponible para este período.', margin, y);
            y += 10;
        }

        // === Sección de Gráficos (en una sola página con promedios) ===
        pdf.addPage();
        const chartHeight = 70;
        const chartWidth = innerWidth * 0.95;
        const chartXPos = margin + (innerWidth - chartWidth) / 2;
        let yCharts = 16;

        // --- Gráfico de Temperatura Interna ---
        const averageTempInt = document.getElementById('averageTemperatureInt').textContent;
        const imgTempInt = tempIntChart.toBase64Image();

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(mainTitleColor[0], mainTitleColor[1], mainTitleColor[2]);
        pdf.text('Gráfico temperatura interna', margin, yCharts);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(subtitleColor[0], subtitleColor[1], subtitleColor[2]);
        pdf.text(averageTempInt, margin, yCharts + 2);

        const yChartInt = yCharts + 6 + 4;
        pdf.addImage(imgTempInt, 'PNG', chartXPos, yChartInt, chartWidth, chartHeight);

        // --- Gráfico de Temperatura Externa ---
        const averageTempExt = document.getElementById('averageTemperatureExt').textContent;
        const imgTempExt = tempExtChart.toBase64Image();
        
        const yChartExtSection = yChartInt + chartHeight + 15;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(mainTitleColor[0], mainTitleColor[1], mainTitleColor[2]);
        pdf.text('Gráfico temperatura externa', margin, yChartExtSection);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(subtitleColor[0], subtitleColor[1], subtitleColor[2]);
        pdf.text(averageTempExt, margin, yChartExtSection + 2);

        const yChartExt = yChartExtSection + 6 + 4;
        pdf.addImage(imgTempExt, 'PNG', chartXPos, yChartExt, chartWidth, chartHeight);

        // --- Gráfico de Aperturas ---
        const yAperturasChartSection = yChartExt + chartHeight + 15; // 15mm de espacio entre gráficos
        const imgAper = aperturasChart.toBase64Image();

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(mainTitleColor[0], mainTitleColor[1], mainTitleColor[2]);
        pdf.text('Gráfico estado de la Puerta', margin, yAperturasChartSection); // Título del gráfico de aperturas

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(subtitleColor[0], subtitleColor[1], subtitleColor[2]);

        const yAperChart = yAperturasChartSection + 6;
        pdf.addImage(imgAper, 'PNG', chartXPos, yAperChart, chartWidth, chartHeight);

        // === Pie de página ===
        const now = new Date().toLocaleString();
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            pdf.setFontSize(10);
            pdf.setTextColor(100);
            pdf.text(`Generado el: ${now}`, margin, 290);
            pdf.text(`Página ${i} de ${pageCount}`, pageWidth - 40, 290);
        }

        pdf.save(`reporte_sensor_${sensorNro}.pdf`);

    }catch (error) {
        console.error('Error al generar el PDF:', error);
    }
    finally{
        // Ocultar el overlay de carga al finalizar, incluso si hay un error
        document.getElementById('loading-overlay').style.display = 'none';
    }
});

// Función para convertir un array de objetos a formato CSV
function convertToCsv(data) {
    if (!data || data.length === 0) {
        return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header];
            // Handle values that might contain commas or newlines by enclosing them in quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`; // Escape double quotes
            }
            return value;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}


// === Botón Exportar a Excel ===
document.getElementById('btnExportExcel').addEventListener('click', async () => {
    // Mostrar el overlay de carga al inicio del proceso
    document.getElementById('loading-overlay').style.display = 'flex';

    try {
        if (!window.ultimaMediciones || window.ultimaMediciones.length === 0) {
            showMessage('No hay mediciones para exportar.');
            return;
        }

        const csvString = convertToCsv(window.ultimaMediciones);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

        // Crear un enlace temporal para la descarga
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mediciones_sensor_${new Date().toISOString().slice(0,10)}.csv`; // Nombre del archivo con fecha

        // Simular un clic para iniciar la descarga
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Revocar la URL del objeto para liberar memoria
        URL.revokeObjectURL(link.href);

        showMessage('Mediciones exportadas a CSV con éxito.');

    } catch (error) {
        console.error('Error al exportar a CSV:', error);
        showMessage('Error al exportar mediciones a CSV.');
    } finally {
        // Ocultar el overlay de carga al finalizar
        document.getElementById('loading-overlay').style.display = 'none';
    }
});


//Barra de alertas

function addBarTooltips(counts) {
    const bar = document.querySelector('.bar');
    if (!bar) return;

    // Elimina tooltips previos
    document.querySelectorAll('.bar-tooltip').forEach(t => t.remove());

    ['critica', 'informativa', 'preventiva'].forEach(tipo => {
        const el = bar.querySelector('.' + tipo);
        if (!el) return;

        el.addEventListener('mouseenter', function(e) {
            let tooltip = document.createElement('div');
            tooltip.className = 'bar-tooltip';
            tooltip.innerText = `Cantidad: ${counts[tipo] || 0}`;
            document.body.appendChild(tooltip);

            // Posiciona el tooltip cerca del mouse
            const rect = el.getBoundingClientRect();
            tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
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

async function cargarAlertasParaBarra(nroSensor) {
    try {
        const res = await fetch(`/alertas?sensor_id=${nroSensor}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const alertas = await res.json();

       // Contar por criticidad
        const counts = { critica: 0, informativa: 0, preventiva: 0 };
        alertas.forEach(a => {
            let crit = (a.criticidad || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (crit === 'critica') counts.critica++;
            else if (crit === 'informativa') counts.informativa++;
            else if (crit === 'preventiva') counts.preventiva++;
        });

        // Calcular porcentajes
        const total = counts.critica + counts.informativa + counts.preventiva;
        const pctCritica = total ? (counts.critica / total) * 100 : 0;
        const pctInformativa = total ? (counts.informativa / total) * 100 : 0;
        const pctPreventiva = total ? (counts.preventiva / total) * 100 : 0;

        // Actualizar la barra
        document.querySelector('.bar .critica').style.width = pctCritica + "%";
        document.querySelector('.bar .informativa').style.width = pctInformativa + "%";
        document.querySelector('.bar .preventiva').style.width = pctPreventiva + "%";

        // Mostrar porcentajes en la leyenda
        document.getElementById('pct-critica').textContent = `(${pctCritica.toFixed(1)}%)`;
        document.getElementById('pct-informativa').textContent = `(${pctInformativa.toFixed(1)}%)`;
        document.getElementById('pct-preventiva').textContent = `(${pctPreventiva.toFixed(1)}%)`;
    
        // Agregar tooltips
        addBarTooltips(counts);

        // Retornar las cantidades y el total para que sean accesibles fuera de la función
        return {
            critica: counts.critica,
            informativa: counts.informativa,
            preventiva: counts.preventiva,
            total: total
        }
    
    } catch (error) {
        console.error("Error al cargar alertas para la barra:", error);
        return { critica: 0, informativa: 0, preventiva: 0, seguridad: 0, total: 0 };
    }
}