// Login
async function loginUsuario(formData) {
    const response = await fetch('/login', {
        method: 'POST',
        body: formData
    });
    return response.json();
}

// Registro de usuario invitado
async function registrarUsuario(formData) {
    const response = await fetch('/complete_registration', {
        method: 'POST',
        body: formData,
    });
    return response.json();
}

// Actualizar perfil
async function actualizarPerfil(body) {
    const response = await fetch('/usuario_actual', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(body)
    });
    return response.json();
}

// Invitar usuario
async function invitarUsuario(formData) {
    const response = await fetch('/invite_user', {
        method: 'POST',
        body: formData,
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });
    return response.json();
}

// Solicitar reset de contraseña
async function solicitarResetPassword(email) {
    const response = await fetch('/solicitar_reset_password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email})
    });
    return response.json();
}

// Resetear contraseña
async function resetearPassword(token, newPassword) {
    const response = await fetch('/reset_password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token, newPassword})
    });
    return response.json();
}

// Mostrar mensaje en un div (opcional)
function mostrarMensaje(id, mensaje, tipo='info') {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = mensaje;
        el.className = tipo;
    }
}