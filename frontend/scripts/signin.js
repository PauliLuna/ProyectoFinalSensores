document.getElementById('signin-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();;
    const password = document.getElementById('password').value;
    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    try {
        const result = await loginUsuario(formData);
        
        if (result && result.token) {
            sessionStorage.setItem('authToken', result.token);
            
            // --- REDIRECCIÓN POR ROL ---
            try {
                // 1. Decodificar el token para leer el payload
                const payload = jwt_decode(result.token); 
                const userRole = payload.entity_type; // Obtenemos el rol ('superAdmin' o 'usuario')
                console.log(userRole);

                // 2. Redirección basada en el rol
                if (userRole === 'superAdmin') {
                    window.location.href = 'home.html';
                } else if (userRole === 'usuario') {
                    window.location.href = 'sensoresUser.html';
                } else {
                    // Rol inesperado
                    sessionStorage.removeItem('authToken');
                    document.getElementById('invalidMessage').textContent = "Error de autenticación. Tipo de cuenta desconocido.";
                    document.getElementById('invalidModal').style.display = 'block';
                }

            } catch (decodeError) {
                sessionStorage.removeItem('authToken');
                // Mostrar mensaje de error general
                document.getElementById('invalidMessage').textContent =" Error de seguridad. Intenta iniciar sesión de nuevo.";
                document.getElementById('invalidModal').style.display = 'block';
            }

        } else if (result && result.error) {
            // Manejo de errores de credenciales, bloqueo, etc. que vienen del servidor
            document.getElementById('invalidMessage').textContent = result.error;
            document.getElementById('invalidModal').style.display = 'block';
        } else {
            // Manejo de respuesta inesperada
             document.getElementById('invalidMessage').textContent = 
                 "Credenciales inválidas. Por favor, inténtalo de nuevo.";
             document.getElementById('invalidModal').style.display = 'block';
        }
    } catch (error) {
        // Error de red o conexión
        console.error("Error en la petición de login:", error);
        document.getElementById('invalidMessage').textContent = "Error de conexión con el servidor. Verifica tu red.";
        document.getElementById('invalidModal').style.display = 'block';
    }
});

// Cerrar el modal de credenciales inválidas
document.getElementById('closeInvalidModal').onclick = function() {
    document.getElementById('invalidModal').style.display = 'none';
    location.reload();
};

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