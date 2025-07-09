if (!sessionStorage.getItem('authToken')) {
    window.location.href = "index.html";
}
const token = sessionStorage.getItem('authToken');

// pop-up tipo "alerta de éxito o error" cuando se registra un sensor
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerSensorForm');

    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault(); // Esto evita que se envíe "a la antigua"

            // Validación: valor mínimo < valor máximo
            const valorMin = parseFloat(document.getElementById('valorMin').value);
            const valorMax = parseFloat(document.getElementById('valorMax').value);
            if (!isNaN(valorMin) && !isNaN(valorMax) && valorMin >= valorMax) {
                alert("El valor mínimo debe ser menor que el valor máximo.");
                return; // No submittear el form
            }

                // Recopilar asignaciones: leer el id (desde el atributo data-user-id) y el permiso de cada fila
            const assignments = Array.from(document.querySelectorAll('.user-assignment-table tbody tr')).map(row => {
                const idUsuario = row.getAttribute("data-user-id");
                const permiso = row.querySelector('.assignment-permission').value;
                const estadoAsignacion = row.querySelector('.assignment-status').textContent;
                return { idUsuario, permiso, estadoAsignacion };
            });
            // Asignar al input oculto en formato JSON:
            document.getElementById('assignments').value = JSON.stringify(assignments);

            // Enviar el formulario usando fetch
            // Crear un objeto FormData para enviar los datos del formulario
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
                alert(result.message); // pop-up
                // Limpiar la tabla de asignaciones
                const tbody = document.querySelector('.user-assignment-table tbody');
                if (tbody) {
                    tbody.innerHTML = '';
                }
                this.reset();
            } else {
                alert(result.message);
            } 
            
        });
    }
});

// Mostrar/ocultar el dropdown de añadir usuario
function toggleAddUserDropdown() {
    const dropdown = document.getElementById('addUserDropdown');
    dropdown.style.display = dropdown.style.display === 'none' || dropdown.style.display === '' ? 'block' : 'none';
}

// Simulación de añadir usuarios (debería hacerse con fetch al backend)
function addUserAssignments() {
    const select = document.getElementById('userSelect');
    const selected = Array.from(select.selectedOptions).map(opt => {
        // opt.value es ahora el id del usuario y textContent es el email
        return { id: opt.value, email: opt.textContent };
    });
    if (selected.length === 0) return;
    const tbody = document.querySelector('.user-assignment-table tbody');
    selected.forEach(user => {
        const tr = document.createElement('tr');
        // Usamos un atributo data-user-id para almacenar el id del usuario
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
    // Aquí deberías enviar los datos al backend si es necesario
}

function deleteAssignment(btn) {
    // Elimina la fila correspondiente
    const row = btn.closest('tr');
    if (row) {
        // Recupera el id del usuario de la fila eliminada
        const userId = row.getAttribute('data-user-id');
        // Vuelve a mostrar la opción en el select
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
    // Aquí deberías enviar el cambio de estado al backend
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/usuarios', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
        if(response.ok){
            const usuarios = await response.json();
            const select = document.getElementById('userSelect');
            // Vaciar el select por si tiene datos preexistentes
            select.innerHTML = "";
            // Por cada usuario, creamos una opción con value = id y texto = email
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
});