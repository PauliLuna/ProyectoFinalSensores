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

document.getElementById('inviteForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    try {
        const result = await invitarUsuario(formData);

        if (result.message) {
            document.getElementById('successMessage').textContent =
                `Se mandó un correo de invitación a ${formData.get('mail')}`;
            document.getElementById('successModal').style.display = 'block';
        } else {
            document.getElementById('errorMessage').textContent =
               result.error || "Error al invitar usuario";
            document.getElementById('errorModal').style.display = 'block';
        }
    } catch (error) {
        document.getElementById('errorMessage').textContent =
            "Error de conexión con el servidor.";
        document.getElementById('errorModal').style.display = 'block';
    }
});

// Cerrar el modal de éxito
document.getElementById('closeModal').onclick = function() {
    document.getElementById('successModal').style.display = 'none';
    location.reload();
};

// Cerrar el modal de error
document.getElementById('closeErrorModal').onclick = function() {
    document.getElementById('errorModal').style.display = 'none';
};


window.onclick = function(event) {
    const modal = document.getElementById('successModal');
    if (event.target === modal) {
        modal.style.display = 'none';
        location.reload();
    }
};