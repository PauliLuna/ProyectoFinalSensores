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
const pageSize = 3;
let currentPage = 1;
let usuariosData = [];

async function cargarUsuarios() {
    const res = await fetch('/usuarios', { headers: { 'Authorization': 'Bearer ' + token } });
    usuariosData = await res.json();
    renderUsuariosTable();
}

function renderUsuariosTable() {
    const tbody = document.getElementById('user-list-table');
    tbody.innerHTML = '';
    const totalResults = usuariosData.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalResults);
    const pageData = usuariosData.slice(startIdx, endIdx);

    pageData.forEach(u => {
    // Normalizar estado
    const estadoRaw = (u.estado || '').trim().toLowerCase();
    const isInvitado = (estadoRaw === 'invitado' || !u.username);
    const estadoLabel = estadoRaw === 'active' ? 'Activo'
                        : estadoRaw === 'inactive' ? 'Inactivo'
                        : 'Invitado';
    tbody.innerHTML += `
        <tr data-user-id="${u._id}">
            <td>${u.username || ''}</td>
            <td>${u.email || ''}</td>
            <td style="text-align: center;">
                ${
                    isInvitado
                        ? `
                            <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <span style="color:#888;">Invitado</span>
                                <span class="alias-tooltip-icon" tabindex="0" style="margin-left:4px; position: relative;">
                                    <img src="assets/informacion.png" alt="info" style="width:16px; height:16px; cursor:pointer;">
                                    <span class="alias-tooltip-text" style="min-width:220px;">
                                        <span class="alias-tooltip-arrow"></span>
                                        Este usuario aún no completó su registro, por lo que no puede ser activado ni desactivado.
                                    </span>
                                </span>
                            </div>
                        `
                        : `
                            <select class="estado-select" style="min-width: 110px;">
                                <option value="Active" ${(u.estado || '').trim().toLowerCase() === 'active' ? 'selected' : ''}>Activo</option>
                                <option value="Inactive" ${(u.estado || '').trim().toLowerCase() === 'inactive' ? 'selected' : ''}>Inactivo</option>
                            </select>
                        `
                }
            </td>
            <td style="text-align: center;">
                <button class="eliminar-btn" title="Eliminar usuario"
                    style="background:#FFFFFF; border:none; padding:0; width:44px; height:44px; display:inline-flex; align-items:center; justify-content:center;">
                    <img src="assets/trash-can.png" alt="Borrar" style="width:36px; height:36px;">
                </button>
            </td>
        </tr>
    `;
});

    // Estado dropdown handler
    tbody.querySelectorAll('.estado-select').forEach(select => {
        select.addEventListener('change', function() {
            const tr = this.closest('tr');
            const userId = tr.getAttribute('data-user-id');
            actualizarEstadoUsuario(userId, this.value);
        });
    });

    // Eliminar usuario handler
    tbody.querySelectorAll('.eliminar-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tr = this.closest('tr');
            const userId = tr.getAttribute('data-user-id');
            const email = tr.children[1].textContent;
            confirmarEliminarUsuario(userId, email);
        });
    });

    // Actualiza texto "mostrando X de Y resultados"
    document.getElementById('current-results-showing').textContent = pageData.length;
    document.getElementById('total-results').textContent = totalResults;

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('user-table-pagination');
    pagination.innerHTML = '';

    // Flecha izquierda
    const prevItem = document.createElement('li');
    prevItem.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
    prevItem.innerHTML = `<a href="#" class="page-link">&larr;</a>`;
    prevItem.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderUsuariosTable();
        }
    });
    pagination.appendChild(prevItem);

    // Números de página (máximo 5)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = 'page-item' + (i === currentPage ? ' active' : '');
        li.innerHTML = `<a href="#" class="page-link">${i}</a>`;
        li.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage !== i) {
                currentPage = i;
                renderUsuariosTable();
            }
        });
        pagination.appendChild(li);
    }

    // Flecha derecha
    const nextItem = document.createElement('li');
    nextItem.className = 'page-item' + (currentPage === totalPages ? ' disabled' : '');
    nextItem.innerHTML = `<a href="#" class="page-link">&rarr;</a>`;
    nextItem.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            renderUsuariosTable();
        }
    });
    pagination.appendChild(nextItem);
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
            <button id="btnEliminarUsuario" class="btn-danger" style="background-color: #457B9D;color: #FFFFFF;">Eliminar</button>
            <button onclick="this.parentElement.parentElement.remove()" class="btn-danger">Cancelar</button>
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