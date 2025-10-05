// ------------------- SEGURIDAD -------------------
const REQUIRED_ROLE = 'superAdmin';

const token = sessionStorage.getItem('authToken');
const userData = isTokenExpired(token);

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
// 2. Validar Rol
const userRole = userData.entity_type; 
// Si el usuario no tiene el rol requerido
if (userRole !== REQUIRED_ROLE) {
    window.location.href = 'acceso_no_autorizado.html';
}
// ------------------- FIN -------------------

const map = L.map('map').setView([-32.9442, -60.6505], 12); // Ejemplo: Rosario

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

function crearIcono(color) {
    return new L.Icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
        shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

const blueIcon = crearIcono('blue');
const yellowIcon = crearIcono('yellow');
const redIcon = crearIcono('red');


async function cargarSensores() {
    try {
        const response = await fetch('/sensores', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.status === 401) {
            alert('Sesión expirada o token inválido. Por favor, inicia sesión nuevamente.');
            sessionStorage.removeItem('authToken');
            window.location.href = "index.html";
            return;
        }

        if (!response.ok) {
            throw new Error('Error al obtener sensores');
        }

        const sensores = await response.json();

        const markers = L.markerClusterGroup({
            iconCreateFunction: function(cluster) {
                const childMarkers = cluster.getAllChildMarkers();
                const anyOffline = childMarkers.some(marker => marker.options.icon === redIcon);
                const anyOutOfRange = childMarkers.some(marker => marker.options.icon === yellowIcon);
                let clusterClass = 'marker-cluster-blue';
                if (anyOffline) clusterClass = 'marker-cluster-red';
                else if (anyOutOfRange) clusterClass = 'marker-cluster-yellow';
                return L.divIcon({
                    html: `<div><span>${cluster.getChildCount()}</span></div>`,
                    className: `marker-cluster ${clusterClass}`,
                    iconSize: L.point(40, 40)
                });
            }
        });

        sensores.forEach(sensor => {
            if (sensor.latitud && sensor.longitud) {
                let icon;
                if (sensor.estado === "OFFLINE") {
                    icon = redIcon;
                } else if (sensor.estado === "ONLINE" && sensor.enRango === true) {
                    icon = blueIcon;
                } else if (sensor.estado === "ONLINE" && sensor.enRango === false) {
                    icon = yellowIcon;
                } else {
                    icon = blueIcon; // fallback
                }
                const marker = L.marker([sensor.latitud, sensor.longitud], { icon });
                marker.bindPopup(
                    `<b>${sensor.alias || 'Sensor ' + sensor.nroSensor}</b><br>
                    Temp. Interna: ${sensor.temperaturaInterna !== null && sensor.temperaturaInterna !== undefined ? sensor.temperaturaInterna + '°C' : '-- °C'}`
                );
                markers.addLayer(marker);
            }
        });
        map.addLayer(markers);
    } catch (err) {
        console.error('Error al cargar sensores:', err);
        alert('No se pudieron cargar los sensores. Intenta nuevamente.');
    }
}

cargarSensores();

map.on('click', function(e) {
    const popup = L.popup()
        .setLatLng(e.latlng)
        .setContent("Ubicación: " + e.latlng.toString())
        .openOn(map);
});