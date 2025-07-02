// JavaScript para manejar la validación del formulario
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('userRegistrationForm');
    form.addEventListener('submit', async function (event) {
        event.preventDefault();  // ⬅️ Este debe estar al principio

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            alert('Las contraseñas no coinciden. Por favor, inténtelo de nuevo.');
            return;
        }
        // Llama a esPasswordFuerte de utils.js (global)
        if (!esPasswordFuerte(password)) {
            alert('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un símbolo.');
            return;
        }

        const formData = new FormData(this);
        try {
            const result = await registrarUsuario(formData);

            if (result.message) {
                alert(result.message + "\nMail de usuario: " + result.user_email);
                this.reset();
                window.location.href = "signin.html"; // Redirige al login después del registro exitoso
            } else {
                alert('Error al registrar el usuario: ' + (result.error || 'Inténtelo nuevamente.'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error de conexión con el servidor.');
        }
    });
});