// JavaScript para manejar el envío del formulario
document.addEventListener('DOMContentLoaded', function () {
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
            alert("Por favor, revisá los datos ingresados. Hay campos con errores.");
            return;
        }

        const mailUsuario = form.email.value;
        const codeInvitation = form.codeInvitation.value;

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
                alert("Registro completado correctamente");
                form.reset();
                window.location.href = "signin.html";
            } else {
                alert("Error en el registro. " +
                    (resultEmpresa.error || resultUsuario.error || ""));
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Error de conexión con el servidor.");
        }
    });
});