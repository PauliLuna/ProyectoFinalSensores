document.getElementById('signin-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();;
    const password = document.getElementById('password').value;
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    try {
        const result = await loginUsuario(formData);
        if (result.token) {
            sessionStorage.setItem('authToken', result.token);
            window.location.href = "home.html";
        } else {
            alert(result.error || "Credenciales inválidas");
        }
    } catch (error) {
        alert("Error de conexión con el servidor.");
    }
});

// Mostrar modal
document.querySelector('.forgot-link a').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('resetModal').style.display = 'block';
});

// Cerrar modal
document.getElementById('closeResetModal').onclick = function() {
    document.getElementById('resetModal').style.display = 'none';
    document.getElementById('resetMsg').textContent = '';
    document.querySelector('#resetRequestForm button[type="submit"]').disabled = false;
};

// Enviar solicitud de recuperación
document.getElementById('resetRequestForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value.trim().toLowerCase();;
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;

    const data = await solicitarResetPassword(email);

    document.getElementById('resetMsg').textContent = data.message || data.error;

    // Solo dejar el botón deshabilitado si fue exitoso o si ya existe un token válido
    if (
        data.message &&
        (
            data.message.startsWith("Ya se envió") ||
            data.message.startsWith("Se ha enviado un correo")
        )
    ) {
        btn.disabled = true;
    } else {
        btn.disabled = false;
    }
});