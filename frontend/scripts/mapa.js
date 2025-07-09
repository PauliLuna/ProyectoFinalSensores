if (!sessionStorage.getItem('authToken')) {
    window.location.href = "index.html";
}

const map = L.map('map').setView([-32.9442, -60.6505], 12); // Ejemplo: Rosario

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const token = sessionStorage.getItem('authToken');

fetch('/sensores', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
})
    .then(res => res.json())
    .then(sensores => {
        // ...todo tu código de iconos, clusters y marcadores...
        const blueIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
        const redIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        const markers = L.markerClusterGroup({
            iconCreateFunction: function(cluster) {
                const childMarkers = cluster.getAllChildMarkers();
                const anyOutOfRange = childMarkers.some(marker => marker.options.icon.options.iconUrl.includes('red'));
                const clusterClass = anyOutOfRange ? 'marker-cluster-red' : 'marker-cluster-blue';
                return L.divIcon({
                    html: `<div><span>${cluster.getChildCount()}</span></div>`,
                    className: `marker-cluster ${clusterClass}`,
                    iconSize: L.point(40, 40)
                });
            }
        });

        sensores.forEach(sensor => {
            if (sensor.latitud && sensor.longitud) {
                const icon = sensor.enRango ? blueIcon : redIcon;
                const marker = L.marker([sensor.latitud, sensor.longitud], { icon });
                marker.bindPopup(
                    `<b>${sensor.alias || 'Sensor ' + sensor.nroSensor}</b><br>
                    Temp. Interna: ${sensor.temperaturaInterna !== null && sensor.temperaturaInterna !== undefined ? sensor.temperaturaInterna + '°C' : '-- °C'}`
                );
                markers.addLayer(marker);
            }
        });
        map.addLayer(markers);
    })
    .catch(err => {
        console.error('Error al cargar sensores:', err);
    });

map.on('click', function(e) {
    const popup = L.popup()
        .setLatLng(e.latlng)
        .setContent("Ubicación: " + e.latlng.toString())
        .openOn(map);
});