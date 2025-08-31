// JavaScript para manejar la validación del formulario
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('userRegistrationForm');
    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        let hasError = false;

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (password !== confirmPassword) {
            noMatchPass.style.display = 'block';
                hasError = true;
        } else {
            noMatchPass.style.display = 'none';
        }

        if (esPasswordFuerte(password)) {
            strongPass.style.color = 'rgb(29, 53, 87)';
        } else {
            strongPass.style.color = '#e63946';
            hasError = true;
        }

        if (hasError) {
            alert("Por favor, revisá los datos ingresados. Hay campos con errores.");
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