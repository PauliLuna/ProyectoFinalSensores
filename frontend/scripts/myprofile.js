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

// 1. Poblar el formulario con los datos del usuario logueado
async function cargarPerfil() {
    const res = await fetch('/usuario_actual', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('mail').value = data.email || '';
    document.getElementById('role').value = data.roles || '';
    document.getElementById('userName').value = data.username || '';
    document.getElementById('numCel').value = data.phone || '';
    // Preferencias de alertas
    const prefs = data.notificacionesAlertas || {};
    document.getElementById('notifCritica').checked = !!prefs.critica;
    document.getElementById('notifInformativa').checked = !!prefs.informativa;
    document.getElementById('notifPreventiva').checked = !!prefs.preventiva;
    document.getElementById('notifSeguridad').checked = !!prefs.seguridad;
}

cargarPerfil();

// 2. Guardar cambios en el perfil
document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Validar nueva contraseña y repetida
    const newPassword = document.getElementById('newPassword').value;
    const repeatPassword = document.getElementById('repeatPassword').value;
    
    if (newPassword || repeatPassword) {
        if (newPassword !== repeatPassword) {
            document.getElementById('errorMessage').textContent =
               "Las contraseñas nuevas no coinciden.";
            document.getElementById('errorModal').style.display = 'block';
            return;
        }
        // Llama a esPasswordFuerte de utils.js (global)
        if (!esPasswordFuerte(newPassword)) {
            document.getElementById('errorMessage').textContent =
               "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un símbolo.";
            document.getElementById('errorModal').style.display = 'block';
            return;
        }
    }

    const body = {
        username: document.getElementById('userName').value,
        phone: document.getElementById('numCel').value,
        currentPassword: document.getElementById('currentPassword').value,
        newPassword: newPassword,
        notificacionesAlertas: {
        critica: document.getElementById('notifCritica').checked,
        informativa: document.getElementById('notifInformativa').checked,
        preventiva: document.getElementById('notifPreventiva').checked,
        seguridad: document.getElementById('notifSeguridad').checked
        }
    };
    
    const result = await actualizarPerfil(body); // from usuarios.js

    if (result.message) {
        document.getElementById('successMessage').textContent = "¡Perfil actualizado con éxito!";
        document.getElementById('successModal').style.display = 'block';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('repeatPassword').value = '';
    } else {
        document.getElementById('errorMessage').textContent =
               result.error || "Error al actualizar perfil";
        document.getElementById('errorModal').style.display = 'block';
    }
});

// Cerrar el modal de éxito
document.getElementById('closeModal').onclick = function() {
    document.getElementById('successModal').style.display = 'none';
};

// Cerrar el modal de error
document.getElementById('closeErrorModal').onclick = function() {
    document.getElementById('errorModal').style.display = 'none';
};