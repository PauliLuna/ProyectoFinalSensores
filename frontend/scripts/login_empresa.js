// JavaScript para manejar el envío del formulario
document.addEventListener('DOMContentLoaded', function () {

    const btnValidar = document.getElementById('btnValidarCodigo');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const noMatchCodigo = document.getElementById('noMatchCodigo');

    btnValidar.addEventListener('click', async function () {
        const email = document.getElementById('email').value;
        const codigo = document.getElementById('codeInvitation').value;

        try {
            const data = await verificarCodigo(email, codigo, "Empresa")
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


    const form = document.getElementById('initialRegistrationForm');

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

        const mailUsuario = form.email.value;
        const codeInvitation = form.codeInvitation.value;

        try {
            
            const verifyResult = await verificarCodigo(mailUsuario, codeInvitation, "Empresa")

            if (!verifyResult.valido) {
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

        const companyData = new FormData();
        companyData.append('codeInvitation', codeInvitation);
        companyData.append('companyName', form.companyName.value);
        companyData.append('cuil', form.cuil.value);
        companyData.append('address', form.address.value);
        companyData.append('pais', form.pais.value);
        companyData.append('provincia', form.provincia.value);
        companyData.append('ciudad', form.ciudad.value);
        companyData.append('cp', form.cp.value);

        const userData = new FormData();
        userData.append('codeInvitation', codeInvitation);
        userData.append('email', mailUsuario);
        userData.append('phone', form.phone.value);
        userData.append('username', form.username.value);
        userData.append('password', password);

        try {
            const responseEmpresa = await fetch('/empresa', {
                method: 'POST',
                body: companyData
            });
            const resultEmpresa = await responseEmpresa.json();

            userData.append('idEmpresa', resultEmpresa.empresa_id);

            const responseUsuario = await fetch('/usuario', {
                method: 'POST',
                body: userData
            });
            const resultUsuario = await responseUsuario.json();

            if (responseEmpresa.ok && responseUsuario.ok) {
                // Marcar el código como usado
                try {
                    await fetch('/marcar-codigo-usado', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mailUsuario: mailUsuario, codigo: codeInvitation })
                    });
                } catch (e) {
                    // Podés loguear el error, pero no bloquea el registro
                    console.error("No se pudo marcar el código como usado:", e);
                }
                document.getElementById('successMessage').innerHTML = // Por el salto de linea
                    "Registro completado correctamente.<br> Mail de usuario: " + resultUsuario.user_email;
                document.getElementById('successModal').style.display = 'block';
            } else {
                document.getElementById('errorMessage').textContent =
                    "Error en el registro. " +
                    (resultEmpresa.error || resultUsuario.error || "");
                document.getElementById('errorModal').style.display = 'block';
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Error de conexión con el servidor.");
        }
    });
});

// Cerrar el modal de éxito
document.getElementById('closeModal').onclick = function() {
    document.getElementById('successModal').style.display = 'none';
    window.location.href = "signin.html"; // Redirige al login después del registro exitoso
};

// Cerrar el modal de error
document.getElementById('closeErrorModal').onclick = function() {
    document.getElementById('errorModal').style.display = 'none';
};