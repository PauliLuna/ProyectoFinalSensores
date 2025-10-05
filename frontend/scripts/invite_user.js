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

// --- Invitar usuario ---
document.getElementById('inviteForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    try {
        const res = await fetch('/invite_user', {
            method: 'POST',
            body: formData,
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const result = await res.json();
        if (result.message) {
            document.getElementById('successMessage').textContent = result.message;
            document.getElementById('successModal').style.display = 'block';
            cargarUsuarios(); // refresca la tabla
        } else {
            document.getElementById('errorMessage').textContent = result.error || "Error al invitar usuario";
            document.getElementById('errorModal').style.display = 'block';
        }
    } catch (error) {
        document.getElementById('errorMessage').textContent = "Error de conexión con el servidor.";
        document.getElementById('errorModal').style.display = 'block';
    }
});

// --- Cerrar modales ---
document.getElementById('closeModal').onclick = function() {
    document.getElementById('successModal').style.display = 'none';
};
document.getElementById('closeErrorModal').onclick = function() {
    document.getElementById('errorModal').style.display = 'none';
};
window.onclick = function(event) {
    if (event.target === document.getElementById('successModal')) {
        document.getElementById('successModal').style.display = 'none';
    }
    if (event.target === document.getElementById('errorModal')) {
        document.getElementById('errorModal').style.display = 'none';
    }
};

// --- Cargar usuarios y renderizar tabla ---
async function cargarUsuarios() {
    const res = await fetch('/usuarios', { headers: { 'Authorization': 'Bearer ' + token } });
    const usuarios = await res.json();
    renderUsuariosTable(usuarios);
}

function renderUsuariosTable(usuarios) {
    const tbody = document.getElementById('user-list-table');
    tbody.innerHTML = '';
    usuarios.forEach(u => {
        const estado = u.estado === 'Active' ? 'Activo' : 'Inactivo';
        tbody.innerHTML += `
            <tr data-user-id="${u._id}">
                <td>${u.username || ''}</td>
                <td>${u.email || ''}</td>
                <td>
                    <select class="estado-select" style="min-width:90px;">
                        <option value="Active" ${u.estado === 'Active' ? 'selected' : ''}>Activo</option>
                        <option value="Inactive" ${u.estado === 'Inactive' ? 'selected' : ''}>Inactivo</option>
                    </select>
                </td>
                <td style="text-align:center;">
                    <button class="btn-primary btn-sm" onclick="editarUsuario('${u._id}')">Editar</button>
                </td>
                <td style="text-align:center;">
                    <img src="assets/trash-can.png" alt="Borrar" class="table-action-icon" style="width:20px; height:20px; cursor:pointer;" onclick="confirmarEliminarUsuario('${u._id}', '${u.email}')">
                </td>
            </tr>
        `;
    });

    // --- Estado dropdown handler ---
    tbody.querySelectorAll('.estado-select').forEach(select => {
        select.addEventListener('change', function() {
            const tr = this.closest('tr');
            const userId = tr.getAttribute('data-user-id');
            actualizarEstadoUsuario(userId, this.value);
        });
    });
}

// --- Actualizar estado usuario ---
async function actualizarEstadoUsuario(userId, nuevoEstado) {
    try {
        const res = await fetch(`/usuario/${userId}/estado`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        const result = await res.json();
        if (result.message) {
            document.getElementById('successMessage').textContent = result.message;
            document.getElementById('successModal').style.display = 'block';
        } else {
            document.getElementById('errorMessage').textContent = result.error || "Error al actualizar estado";
            document.getElementById('errorModal').style.display = 'block';
        }
    } catch (error) {
        document.getElementById('errorMessage').textContent = "Error de conexión con el servidor.";
        document.getElementById('errorModal').style.display = 'block';
    }
}

// --- Eliminar usuario ---
function confirmarEliminarUsuario(userId, email) {
    // Modal de confirmación
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <p>¿Está seguro que quiere eliminar el usuario <b>${email}</b>?</p>
            <button id="btnEliminarUsuario" class="btn-danger">Eliminar</button>
            <button onclick="this.parentElement.parentElement.remove()" class="btn-secondary">Cancelar</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btnEliminarUsuario').onclick = async function() {
        try {
            const res = await fetch(`/usuario/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const result = await res.json();
            if (result.message) {
                modal.remove();
                document.getElementById('successMessage').textContent = result.message;
                document.getElementById('successModal').style.display = 'block';
                cargarUsuarios();
            } else {
                document.getElementById('errorMessage').textContent = result.error || "Error al eliminar usuario";
                document.getElementById('errorModal').style.display = 'block';
            }
        } catch (error) {
            document.getElementById('errorMessage').textContent = "Error de conexión con el servidor.";
            document.getElementById('errorModal').style.display = 'block';
        }
    };
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', cargarUsuarios);