// Obtener token de la URL
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
document.getElementById('resetPasswordForm').style.display = 'none';
document.getElementById('resetResult').style.display = 'none';

if (!token) {
    document.getElementById('loadingMsg').style.display = 'none';
    document.getElementById('resetResult').style.display = 'block';
    document.getElementById('resetResult').textContent = "Token inválido.";
    
} else {
    // Validar token apenas se carga la página
    fetch('/reset_password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token, validateOnly: true})
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok && data.error && (data.error.toLowerCase().includes("expirado") || data.error.toLowerCase().includes("inválido"))) {
            window.location.href = "token_expired.html";
            return;
        }
        // Si es válido:
        document.getElementById('loadingMsg').style.display = 'none';
        document.getElementById('resetPasswordForm').style.display = 'block';
        document.getElementById('resetResult').style.display = 'block';
    });
}
// Función para validar la fortaleza de la contraseña
document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (newPassword !== confirmPassword) {
        document.getElementById('resetResult').textContent = "Las contraseñas no coinciden.";
        return;
    }
    if (!esPasswordFuerte(newPassword)) {
        document.getElementById('resetResult').textContent = "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un símbolo.";
        return;
    }
    
    const data = await resetearPassword(token, newPassword);

    if (data.message) {
        document.getElementById('resetResult').textContent = "¡Contraseña restablecida con éxito! Redirigiendo...";
        setTimeout(() => window.location.href = "signin.html", 2000);
    } else {
        // Si el error es de token expirado, redirige
        if (data.error && (data.error.toLowerCase().includes("expirado") || data.error.toLowerCase().includes("inválido"))) {
            window.location.href = "token_expired.html";
        } else {
            document.getElementById('resetResult').textContent = data.error || "Error al restablecer la contraseña.";
        }
    }
});