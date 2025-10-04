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

        // Llamada al backend para validar código
        try {
            const data = await verificarCodigo(email, codigo, "Usuario")
            if (data.valido) {
                noMatchCodigo.style.display = 'none';
                step2.style.display = '';
                step1.style.display = 'none';
            } else {
                noMatchCodigo.textContent = data.motivo || 'El código de invitación es inválido.';
                noMatchCodigo.style.display = 'block';
            }
        } catch (e) {
            document.getElementById('errorMessage').textContent =
               "Error al verificar el código.";
            document.getElementById('errorModal').style.display = 'block';
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
            document.getElementById('errorMessage').textContent =
               "Por favor, revisá los datos ingresados. Hay campos con errores.";
            document.getElementById('errorModal').style.display = 'block';
            return;
        }

        const mailUsuario = document.getElementById('email').value;
        const codeInvitation = document.getElementById('codigo').value;

        try {
            
            const verifyResult = await verificarCodigo(mailUsuario, codeInvitation, "Usuario")
            console.log("verifyResult:", verifyResult);

            if (!verifyResult.valido || verifyResult.tipoInvitacion !== "Usuario") {
                noMatchCodigo.style.display = 'block';
                document.getElementById('errorMessage').textContent =
                    "Código de invitación inválido porque " + verifyResult.motivo;
                document.getElementById('errorModal').style.display = 'block';
                return;
            }else {
                noMatchCodigo.style.display = 'none';
            }
        } catch (error) {
            document.getElementById('errorMessage').textContent =
                "Error al verificar el código de invitación.";
            document.getElementById('errorModal').style.display = 'block';
            return;
        }

        const formData = new FormData(this);
        try {
            const result = await registrarUsuario(formData);

            if (result.message) {
                document.getElementById('successMessage').innerHTML =
                    result.message + "<br> Mail de usuario: " + result.user_email;
                document.getElementById('successModal').style.display = 'block';
            } else {
                document.getElementById('errorMessage').textContent =
                    'Error al registrar el usuario: ' + (result.error || 'Inténtelo nuevamente.');
                document.getElementById('errorModal').style.display = 'block';
            }
        } catch (error) {
            document.getElementById('errorMessage').textContent =
                'Error de conexión con el servidor.';
            document.getElementById('errorModal').style.display = 'block';
        }
    });
});

// 3. Cerrar el modal de éxito
document.getElementById('closeModal').onclick = function() {
    document.getElementById('successModal').style.display = 'none';
    window.location.href = "signin.html"; // Redirige al login después del registro exitoso
};

// Registro de usuario invitado
async function registrarUsuario(formData) {
    const response = await fetch('/complete_registration', {
        method: 'POST',
        body: formData,
    });
    return response.json();
}

// Cerrar el modal de error
document.getElementById('closeErrorModal').onclick = function() {
    document.getElementById('errorModal').style.display = 'none';
};