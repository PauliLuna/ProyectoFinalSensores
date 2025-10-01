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
if (!token) {
    // No existe token → acceso denegado
    window.location.href = 'acceso_denegado.html';
} 
else if (isTokenExpired(token)) {
    // Token existente pero caducó → sesión expirada
    sessionStorage.removeItem('authToken');
    window.location.href = 'sesion_expired.html';
}

// Mostrar/ocultar el dropdown de añadir usuario
function toggleAddUserDropdown() {
    const dropdown = document.getElementById('addUserDropdown');
    dropdown.style.display = dropdown.style.display === 'none' || dropdown.style.display === '' ? 'block' : 'none';
}

// Añadir usuarios seleccionados a la tabla de asignaciones
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

        // Oculta la opción del select
        const option = select.querySelector(`option[value="${user.id}"]`);
        if (option) option.style.display = "none";
    });
    document.getElementById('addUserDropdown').style.display = 'none';
    select.selectedIndex = -1;
    // Aquí podrías enviar los datos al backend si lo necesitas
}

// Eliminar asignación de usuario
function deleteAssignment(btn) {
    const row = btn.closest('tr');
    if (row) {
        const userId = row.getAttribute('data-user-id');
        const select = document.getElementById('userSelect');
        const option = select.querySelector(`option[value="${userId}"]`);
        if (option) option.style.display = "";
        row.remove();
    }
}

// Permitir editar el estado de asignación
function editAssignment(btn) {
    const td = btn.parentElement.previousElementSibling;
    const current = td.querySelector('.assignment-status').textContent;
    const newState = current === 'Activo' ? 'Inactivo' : 'Activo';
    td.querySelector('.assignment-status').textContent = newState;
    // Aquí podrías enviar el cambio de estado al backend si lo necesitas
}

document.addEventListener('DOMContentLoaded', async () => {
    // Poblar el select de usuarios
    try {
        const response = await fetch('/usuarios', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        if (response.ok) {
            const usuarios = await response.json();
            const select = document.getElementById('userSelect');
            select.innerHTML = "";
            usuarios.forEach(usuario => {
                const option = document.createElement('option');
                option.value = usuario._id;
                option.textContent = usuario.email;
                select.appendChild(option);
            });
        } else {
            console.error('Error al obtener usuarios.');
        }
    } catch (error) {
        console.error('Error en fetch /usuarios:', error);
    }

    // Manejo del formulario de registro de sensor
    const form = document.getElementById('registerSensorForm');
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            let hasError = false;

            // Validación: valor mínimo < valor máximo
            const valorMin = parseFloat(document.getElementById('valorMin').value);
            const valorMax = parseFloat(document.getElementById('valorMax').value);
            if (!isNaN(valorMin) && !isNaN(valorMax) && valorMin >= valorMax) {
                minMaxHelp.style.display = 'block';
                hasError = true;
            } else if (minMaxHelp) {
                minMaxHelp.style.display = 'none';
            }

            // Validación: alias debe tener formato "algo - algo"
            const alias = document.getElementById('alias').value.trim();
            const aliasRegex = /^.+\s*-\s*.+$/;
            if (!aliasRegex.test(alias)) {
                aliasHelp.style.display = 'block';
                hasError = true;
            } else {
                aliasHelp.style.display = 'none';
            }

            if (hasError) {
                alert("Por favor, revisá los datos ingresados. Hay campos con errores.");
                return; // NO se envía nada al backend si hay errores
            }

            // Recopilar asignaciones
            const assignments = Array.from(document.querySelectorAll('.user-assignment-table tbody tr')).map(row => {
                const idUsuario = row.getAttribute("data-user-id");
                const permiso = row.querySelector('.assignment-permission').value;
                const estadoAsignacion = row.querySelector('.assignment-status').textContent;
                return { idUsuario, permiso, estadoAsignacion };
            });
            document.getElementById('assignments').value = JSON.stringify(assignments);

            const formData = new FormData(this);

            const response = await fetch('/sensor', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            });

            const result = await response.json();

            if (response.ok) {
                document.getElementById('successMessage').textContent =
                `El sensor "${alias}" se ha registrado correctamente.`;
                document.getElementById('successModal').style.display = 'block';
                const tbody = document.querySelector('.user-assignment-table tbody');
                if (tbody) tbody.innerHTML = '';
                if (aliasHelp) aliasHelp.style.display = 'none';
                if (minMaxHelp) minMaxHelp.style.display = 'none';
                if (direccionHelp) direccionHelp.style.display = 'none';
                this.reset();
            } else {
                // Validación de error de dirección
                if (
                    result.message &&
                    result.message.includes("La dirección ingresada no es válida")
                ) {
                    direccionHelp.textContent = result.message;
                    direccionHelp.style.display = 'block';
                    hasError = true;
                }
                else if (direccionHelp) {
                    direccionHelp.style.display = 'none';
                }
            }

            if (hasError) {
                alert("Por favor, revisá los datos ingresados. Hay campos con errores.");
                return;
            }

        });
    }
});

// Cerrar el modal de éxito
document.getElementById('closeModal').onclick = function() {
    document.getElementById('successModal').style.display = 'none';
    window.location.href = "sensores.html";
};

// Oculto por defecto los mensajes de error
const aliasInput = document.getElementById('alias');
const aliasHelp = document.getElementById('aliasHelp');
if (aliasInput && aliasHelp) {
    aliasHelp.style.display = 'none';
}

const valorMinInput = document.getElementById('valorMin');
const valorMaxInput = document.getElementById('valorMax');
let minMaxHelp = document.getElementById('minMaxHelp');
if (!minMaxHelp && valorMaxInput) {
    minMaxHelp.style.display = 'none';
}

// Dirección: oculto por defecto el mensaje de error
const direccionInput = document.getElementById('direccion');
let direccionHelp = document.getElementById('direccionHelp');
if (!direccionHelp && direccionInput) {
    direccionHelp.style.display = 'none';
}