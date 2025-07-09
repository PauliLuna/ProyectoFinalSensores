if (!sessionStorage.getItem('authToken')) {
    window.location.href = "index.html";
}
const token = sessionStorage.getItem('authToken');

// Mostrar/ocultar el dropdown de añadir usuario
function toggleAddUserDropdown() {
    const dropdown = document.getElementById('addUserDropdown');
    const isOpening = dropdown.style.display === 'none' || dropdown.style.display === '';
    dropdown.style.display = isOpening ? 'block' : 'none';
    if (isOpening) {
        actualizarUserSelect();
    }
}

// Cargar los usuarios disponibles para asignar
async function actualizarUserSelect() {
    try {
        const response = await fetch('/usuarios', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!response.ok) throw new Error('Error al obtener usuarios.');
        const usuarios = await response.json();
        const select = document.getElementById('userSelect');
        select.innerHTML = "";

        // IDs de usuario ya asignados
        const assignedIds = Array.from(document.querySelectorAll('.user-assignment-table tbody tr'))
            .map(row => row.getAttribute('data-user-id'));

        usuarios.forEach(usuario => {
            if (!assignedIds.includes(usuario._id)) {
                const option = document.createElement('option');
                option.value = usuario._id;
                option.textContent = usuario.email;
                select.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error en fetch /usuarios:', error);
    }
}

// Añadir usuarios a la tabla de asignaciones
function addUserAssignments() {
    const select = document.getElementById('userSelect');
    const selected = Array.from(select.selectedOptions).map(opt => ({
        id: opt.value,
        email: opt.textContent
    }));
    if (selected.length === 0) return;
    const tbody = document.querySelector('.user-assignment-table tbody');
    selected.forEach(user => {
        const tr = document.createElement('tr');
        tr.setAttribute("data-user-id", user.id);
        tr.innerHTML = `
            <td>${user.email}</td>
            <td>
                <select class="assignment-permission">
                    <option value="Read" selected>Read</option>
                    <option value="Edit">Edit</option>
                </select>
            </td>
            <td><span class="assignment-status">Activo</span></td>
            <td>
                <button type="button" class="edit-assignment-btn" title="Editar estado" onclick="editAssignment(this)">
                    <span>✏️</span>
                </button>
                <button type="button" class="delete-assignment-btn" title="Eliminar asignación" onclick="deleteAssignment(this)">
                    <span>✖️</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('addUserDropdown').style.display = 'none';
    select.selectedIndex = -1;
    actualizarUserSelect();
}

// Editar el estado de asignación
function editAssignment(btn) {
    const td = btn.parentElement.previousElementSibling;
    const statusSpan = td.querySelector('.assignment-status');
    if (!statusSpan) return;
    statusSpan.textContent = statusSpan.textContent === 'Activo' ? 'Inactivo' : 'Activo';
    // Aquí podrías enviar el cambio al backend si lo deseas
}

// Eliminar asignación de usuario
function deleteAssignment(btn) {
    const row = btn.closest('tr');
    if (row) {
        row.remove();
        actualizarUserSelect();
    }
}

// Obtener el estado actual del formulario (para detectar cambios)
function getFormState() {
    const form = document.getElementById('editSensorForm');
    const formData = new FormData(form);
    const assignments = Array.from(document.querySelectorAll('.user-assignment-table tbody tr')).map(row => ({
        idUsuario: row.getAttribute("data-user-id"),
        permiso: row.querySelector('.assignment-permission').value,
        estadoAsignacion: row.querySelector('.assignment-status').textContent
    }));
    formData.append('assignments', JSON.stringify(assignments));
    return JSON.stringify(Array.from(formData.entries()));
}

let initialFormState = null;

// Cargar datos del sensor y asignaciones
async function cargarDatosSensor(sensorId) {
    try {
        const response = await fetch(`/sensor/${sensorId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error al obtener datos del sensor. Status: ${response.status}. Mensaje: ${errorText}`);
            return;
        }
        const sensor = await response.json();

        // Rellenar los campos del formulario
        document.getElementById('nroSensor').value = sensor.nroSensor || "";
        document.getElementById('alias').value = sensor.alias || "";
        document.getElementById('notas').value = sensor.notas || "";
        document.getElementById('direccion').value = sensor.direccion || "";
        document.getElementById('ciudad').value = sensor.ciudad || "";
        document.getElementById('pais').value = sensor.pais || "";
        document.getElementById('pais').dispatchEvent(new Event('change'));
        setTimeout(() => {
            document.getElementById('provincia').value = sensor.provincia || "";
        }, 200);
        document.getElementById('cp').value = sensor.cp || "";
        document.getElementById('valorMin').value = sensor.valorMin || "";
        document.getElementById('valorMax').value = sensor.valorMax || "";
        document.getElementById('estado').value = sensor.estado || "";

        // Asignaciones
        const tbody = document.querySelector('.user-assignment-table tbody');
        tbody.innerHTML = "";
        if (sensor.assignments && sensor.assignments.length) {
            sensor.assignments.forEach(assignment => {
                const tr = document.createElement('tr');
                tr.setAttribute("data-user-id", assignment.idUsuario);
                tr.innerHTML = `
                    <td>${assignment.email}</td>
                    <td>
                        <select class="assignment-permission">
                            <option value="Read" ${assignment.permiso === "Read" ? "selected" : ""}>Read</option>
                            <option value="Edit" ${assignment.permiso === "Edit" ? "selected" : ""}>Edit</option>
                        </select>
                    </td>
                    <td><span class="assignment-status">${assignment.estadoAsignacion}</span></td>
                    <td>
                        <button type="button" class="edit-assignment-btn" title="Editar estado" onclick="editAssignment(this)">
                            <span>✏️</span>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Error en la carga de datos del sensor:", error);
    }
}

// Manejo del envío del formulario para actualizar el sensor (método PUT)
async function submitEditSensorForm(e) {
    e.preventDefault();

    // Validación: valor mínimo < valor máximo
    const valorMin = parseFloat(document.getElementById('valorMin').value);
    const valorMax = parseFloat(document.getElementById('valorMax').value);
    if (!isNaN(valorMin) && !isNaN(valorMax) && valorMin >= valorMax) {
        alert("El valor mínimo debe ser menor que el valor máximo.");
        return;
    }

    const sensorId = document.getElementById('nroSensor').value;
    const form = document.getElementById('editSensorForm');
    const formData = new FormData(form);

    // Recopilar asignaciones de la tabla
    const assignments = Array.from(document.querySelectorAll('.user-assignment-table tbody tr')).map(row => {
        const idUsuario = row.getAttribute("data-user-id") || row.querySelector('td').textContent.trim();
        const permiso = row.querySelector('.assignment-permission').value;
        const estadoAsignacion = row.querySelector('.assignment-status').textContent;
        return { idUsuario, permiso, estadoAsignacion };
    });
    formData.append('assignments', JSON.stringify(assignments));

    try {
        const response = await fetch(`/sensor/${sensorId}`, {
            method: 'PUT',
            body: formData,
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const result = await response.json();
        if (response.ok) {
            alert("Sensor actualizado correctamente");
            window.location.href = "sensores.html";
        } else {
            alert(result.message || "Error al actualizar el sensor.");
        }
    } catch (error) {
        alert("Error de red al actualizar el sensor.");
        console.error(error);
    }
}

// Confirmar cambios al volver
function handleBtnVolver() {
    const currentState = getFormState();
    if (currentState !== initialFormState) {
        if (confirm("Tienes cambios sin guardar. ¿Deseas descartarlos y volver?")) {
            window.location.href = "sensores.html";
        }
    } else {
        window.location.href = "sensores.html";
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Guardar estado inicial del formulario
    setTimeout(() => {
        initialFormState = getFormState();
    }, 500);

    document.getElementById('btnVolver').addEventListener('click', handleBtnVolver);

    // Obtener el sensor_id de la URL
    const params = new URLSearchParams(window.location.search);
    const sensorId = params.get('id');
    if (!sensorId) {
        console.error("No se encontró sensor ID en la URL");
        return;
    }
    cargarDatosSensor(sensorId);

    document.getElementById('editSensorForm').addEventListener('submit', submitEditSensorForm);
});