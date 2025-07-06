function filterSensors() {
    const input = document.getElementById("sensorInput").value.toLowerCase();
    const cards = document.querySelectorAll(".sensor-card");
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(input) ? "block" : "none";
    });
}

function redirectToDashboard(element) {
    sessionStorage.setItem('sensor_alias', element.getAttribute('data-alias'));
    sessionStorage.setItem('sensor_estado', element.getAttribute('data-estado'));
    sessionStorage.setItem('sensor_alarma', element.getAttribute('data-alerta'));

    window.location.href = `dashboard_sensor.html`;
}

async function cargarSensores() {
    const grid = document.getElementById('sensorGrid');
    grid.innerHTML = '<p>Cargando sensores...</p>';
    try {
        const response = await fetch('/sensores');
        const sensores = await response.json();
        grid.innerHTML = '';
        sensores.forEach(sensor => {
            const card = document.createElement('div');
            card.className = 'sensor-card';
            card.setAttribute('onclick', 'redirectToDashboard(this)');
            card.setAttribute('data-alias', sensor.alias);
            card.setAttribute('data-estado', sensor.estado);
            card.setAttribute('data-alerta', sensor.enRango ? 'En rango' : 'Fuera de rango');
            card.innerHTML = `
                <img class="corner-icon" src="https://png.pngtree.com/png-vector/20221115/ourmid/pngtree-ultra-cold-storage-temperature-rgb-color-icon-equipment-storage-temperature-vector-png-image_41145610.jpg" alt="Sensor Icon">    
                <div class="sensor-status ${sensor.estado === 'ONLINE' ? 'status-online' : 'status-offline'}">● ${sensor.estado}</div>
                <div class="sensor-info">
                    <strong>${sensor.alias}</strong><br>
                    Temperatura Interna: ${sensor.temperaturaInterna !== null ? sensor.temperaturaInterna + ' °C' : ' -- °C'}<br>
                    Temperatura Externa: ${sensor.temperaturaExterna !== null ? sensor.temperaturaExterna + ' °C' : ' -- °C'}<br><br>
                    <span style="color:${sensor.enRango ? '#10b981' : '#FF6F5E'}; font-weight: bold">${sensor.enRango ? 'En rango' : 'Fuera de rango'}</span>
                </div>
                <button class="edit-sensor-btn" title="Editar sensor"
                    onclick="event.stopPropagation(); window.location.href='edit_sensor.html?id=${sensor.nroSensor}';">
                    <img src="assets/edit-pencil.png" alt="Editar" style="width:30px; height:30px;">
                </button>
            `;
            grid.appendChild(card);
        });
        filterSensors();
    } catch (error) {
        grid.innerHTML = '<p>Error al cargar sensores.</p>';
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarSensores();
    // Refrescar
    const refreshIcon = document.getElementById('refreshIcon');
    if (refreshIcon) {
        refreshIcon.addEventListener('click', cargarSensores);
    }
});