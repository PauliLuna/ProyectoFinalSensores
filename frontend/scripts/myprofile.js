if (!sessionStorage.getItem('authToken')) {
    window.location.href = "index.html";
}
const token = sessionStorage.getItem('authToken');

// 1. Poblar el formulario con los datos del usuario logueado
async function cargarPerfil() {
    const res = await fetch('/usuario_actual');
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('mail').value = data.email || '';
    document.getElementById('role').value = data.roles || '';
    document.getElementById('userName').value = data.username || '';
    document.getElementById('numCel').value = data.phone || '';
}
cargarPerfil();

// 2. Guardar cambios en el perfil
document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Validar nueva contraseña y repetida
    const newPassword = document.getElementById('newPassword').value;
    const repeatPassword = document.getElementById('repeatPassword').value;
    
    if (newPassword || repeatPassword) {
        if (newPassword !== repeatPassword) {
            alert("Las contraseñas nuevas no coinciden.");
            return;
        }
        // Llama a esPasswordFuerte de utils.js (global)
        if (!esPasswordFuerte(newPassword)) {
            alert("La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un símbolo.");
            return;
        }
    }

    const body = {
        username: document.getElementById('userName').value,
        phone: document.getElementById('numCel').value,
        currentPassword: document.getElementById('currentPassword').value,
        newPassword: newPassword
    };
    
    const result = await actualizarPerfil(body);

    if (result.message) {
        document.getElementById('successMessage').textContent = "¡Perfil actualizado con éxito!";
        document.getElementById('successModal').style.display = 'block';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('repeatPassword').value = '';
    } else {
        alert(result.error || "Error al actualizar perfil");
    }
});

// 3. Cerrar el modal de éxito
document.getElementById('closeModal').onclick = function() {
    document.getElementById('successModal').style.display = 'none';
};
window.onclick = function(event) {
    const modal = document.getElementById('successModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};
// 4. Función para mostrar/ocultar contraseñas