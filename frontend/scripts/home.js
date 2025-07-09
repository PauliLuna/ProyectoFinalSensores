if (!sessionStorage.getItem('authToken')) {
    window.location.href = "index.html";
}
const token = sessionStorage.getItem('authToken');

// Temperatura promedio por sucursal (ejemplo)
const tempSucursalCtx = document.getElementById('tempSucursalChart').getContext('2d');
new Chart(tempSucursalCtx, {
    type: 'bar',
    data: {
        labels: ['Sucursal Centro', 'Sucursal Norte', 'Sucursal Sur'],
        datasets: [{
            label: 'Temp. Promedio (°C)',
            data: [22.5, 24.1, 21.8],
            backgroundColor: ['#457B9D', '#A8DADC', '#F4A261'],
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    }
});

// Tendencia térmica reciente (ejemplo: 1 estable, 0 inestable)
const tendenciaSucursalCtx = document.getElementById('tendenciaSucursalChart').getContext('2d');
new Chart(tendenciaSucursalCtx, {
    type: 'line',
    data: {
        labels: ['Centro', 'Norte', 'Sur'],
        datasets: [{
            label: 'Estabilidad (1=Estable, 0=Inestable)',
            data: [1, 0, 1],
            borderColor: '#457B9D',
            backgroundColor: 'rgba(69,123,157,0.1)',
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                min: 0,
                max: 1,
                ticks: {
                    callback: function(value) {
                        return value === 1 ? 'Estable' : 'Inestable';
                    }
                }
            }
        }
    }
});

// Cargar datos de KPIs desde el backend
async function cargarKPIs() {
    try {
        const res = await fetch('/sensores', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        const sensores = await res.json();

        // Total de sensores
        document.getElementById('total-sensores').textContent = sensores.length;

        // Sensores en rango
        const enRango = sensores.filter(s => s.enRango).length;
        document.getElementById('sensores-en-rango').textContent = enRango;

        // Sensores fuera de rango (solo los que tienen medición)
        const fueraRango = sensores.filter(s => s.enRango === false).length;
        document.getElementById('sensores-fuera-rango').textContent = fueraRango;

        // Sensores offline (fallos/sin señal)
        const offline = sensores.filter(s => s.estado && s.estado.toLowerCase() === 'offline').length;
        document.getElementById('sensores-fallo').textContent = offline;

    } catch (error) {
        console.error('Error al cargar KPIs:', error);
    }
}

document.addEventListener('DOMContentLoaded', cargarKPIs);

// Cargar últimas conexiones de usuarios desde el backend
async function cargarUltimasConexiones() {
    const res = await fetch('/ultimas_conexiones', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });
    const usuarios = await res.json();
    const tbody = document.getElementById('user-activity-table');
    tbody.innerHTML = '';
    usuarios.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.username || ''}</td>
            <td>${u.email || ''}</td>
            <td>${u.fechaUltimoAcceso || ''}</td>
            <td>${u.estado || ''}</td>
        `;
        tbody.appendChild(tr);
    });
}
cargarUltimasConexiones();

// Redirigir a la página de sensores al hacer clic en los KPIs

document.getElementById('total-sensores').parentElement.onclick = () => {
    window.location.href = 'sensores.html';
};

document.getElementById('sensores-en-rango').parentElement.onclick = () => {
    window.location.href = 'sensores.html?rango=enRango';
};

document.getElementById('sensores-fuera-rango').parentElement.onclick = () => {
    window.location.href = 'sensores.html?rango=fueraRango';
};

document.getElementById('sensores-fallo').parentElement.onclick = () => {
    window.location.href = 'sensores.html?estado=OFFLINE';
};