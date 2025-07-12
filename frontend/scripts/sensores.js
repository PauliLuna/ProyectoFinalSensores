if (!sessionStorage.getItem('authToken')) {
    window.location.href = "index.html";
}
const token = sessionStorage.getItem('authToken');

function filterSensors() {
    const input = document.getElementById("sensorInput").value.toLowerCase();
    const estado = document.getElementById("estadoFilter").value;
    const rango = document.getElementById("rangoFilter").value;
    const cards = document.querySelectorAll(".sensor-card");
    let anyVisible = false;
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        const cardEstado = card.getAttribute('data-estado');
        const cardRango = card.getAttribute('data-alerta');
        let show = true;
        if (input && !text.includes(input)) show = false;
        if (estado && cardEstado !== estado) show = false;
        if (rango) {
            if (rango === "enRango" && cardRango !== "En rango") show = false;
            if (rango === "fueraRango" && cardRango !== "Fuera de rango") show = false;
        }
        card.style.display = show ? "block" : "none";
        if (show) anyVisible = true;
    });

    const grid = document.getElementById('sensorGrid');
    let noResultDiv = document.getElementById('noSensorsMsg');
    if (!anyVisible) {
        if (!noResultDiv) {
            noResultDiv = document.createElement('div');
            noResultDiv.id = 'noSensorsMsg';
            noResultDiv.innerHTML = `
                <span class="no-sensors-icon">🔍</span>
                <b>No hay sensores para los filtros seleccionados.</b>
                <a class="reset-filters-link" id="resetFiltersLink" href="#">Restablecer filtros</a>
            `;
            grid.appendChild(noResultDiv);
            document.getElementById('resetFiltersLink').onclick = function(e) {
                e.preventDefault();
                document.getElementById("sensorInput").value = "";
                document.getElementById("estadoFilter").value = "";
                document.getElementById("rangoFilter").value = "";
                filterSensors();
            };
        }
        // Centrar solo cuando no hay resultados
        grid.style.display = "flex";
        grid.style.flexDirection = "column";
        grid.style.justifyContent = "center";
        grid.style.alignItems = "center";
        grid.style.minHeight = "300px";
    } else {
        if (noResultDiv) noResultDiv.remove();
        grid.style.display = "";
        grid.style.flexDirection = "";
        grid.style.justifyContent = "";
        grid.style.alignItems = "";
        grid.style.minHeight = "";
    }
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
        const response = await fetch('/sensores', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });
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
    // Filtros
    document.getElementById('estadoFilter').addEventListener('change', filterSensors);
    document.getElementById('rangoFilter').addEventListener('change', filterSensors);

    // Cargar filtros desde la URL si existen
    const params = new URLSearchParams(window.location.search);
    const estado = params.get('estado');
    const rango = params.get('rango');
    if (estado) {
        document.getElementById('estadoFilter').value = estado;
    }
    if (rango) {
        document.getElementById('rangoFilter').value = rango;
    }
    filterSensors();

});