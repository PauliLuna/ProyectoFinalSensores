document.getElementById('inviteForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    try {
        const result = await invitarUsuario(formData);

        if (result.message) {
            document.getElementById('successMessage').textContent =
                `Se mandó un correo de invitación a ${formData.get('mail')}`;
            document.getElementById('successModal').style.display = 'block';
        } else {
            alert(result.error || "Error al invitar usuario");
        }
    } catch (error) {
        alert("Error de conexión con el servidor.");
    }
});

// Cerrar el modal de éxito
document.getElementById('closeModal').onclick = function() {
    document.getElementById('successModal').style.display = 'none';
    location.reload();
};

window.onclick = function(event) {
    const modal = document.getElementById('successModal');
    if (event.target === modal) {
        modal.style.display = 'none';
        location.reload();
    }
};