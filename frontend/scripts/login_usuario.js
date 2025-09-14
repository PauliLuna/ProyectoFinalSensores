// JavaScript para manejar la validación del formulario
document.addEventListener('DOMContentLoaded', function () {
    const btnValidar = document.getElementById('btnValidarCodigo');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const noMatchCodigo = document.getElementById('noMatchCodigo');

    // Mensajes de validación de contraseña y código
    btnValidar.addEventListener('click', async function () {
        const email = document.getElementById('email').value;
        const codigo = document.getElementById('codigo').value;

        // Validación básica de email en FE
        if (!email.includes('@')) {
            alert('Ingrese un correo electrónico válido.');
            return;
        }

        // Llamada al backend para validar código
        try {
            const res = await fetch('/verificar-codigo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mailUsuario: email, codigo: codigo })
            });
            const data = await res.json();
            if (data.valido) {
                noMatchCodigo.style.display = 'none';
                step2.style.display = '';
                step1.style.display = 'none';
            } else {
                noMatchCodigo.textContent = data.motivo || 'El código de invitación es inválido.';
                noMatchCodigo.style.display = 'block';
            }
        } catch (e) {
            alert('Error al verificar el código.');
        }
    });

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

        const mailUsuario = document.getElementById('email').value;
        const codeInvitation = document.getElementById('codigo').value;

        try {
            
            const verifyResult = await verificarCodigo(mailUsuario, codeInvitation)

            if (!verifyResult.valido) {
                noMatchCodigo.style.display = 'block';
                alert("Código de invitación inválido porque " + verifyResult.motivo);
                return;
            }else {
                noMatchCodigo.style.display = 'none';
            }
        } catch (error) {
            console.error("Error al verificar código:", error);
            alert("Error al verificar el código de invitación.");
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

// Registro de usuario invitado
async function registrarUsuario(formData) {
    const response = await fetch('/complete_registration', {
        method: 'POST',
        body: formData,
    });
    return response.json();
}