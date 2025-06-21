// Cargar sidebar y top-banner en paralelo
Promise.all([
    fetch('partials/sidebar.html').then(res => res.text()),
    fetch('partials/top-banner.html').then(res => res.text())
]).then(([sidebarHtml, topBannerHtml]) => {
    document.getElementById('sidebar-container').innerHTML = sidebarHtml;
    document.getElementById('top-banner-container').innerHTML = topBannerHtml;

    // Ahora sí existen ambos en el DOM
    const toggleSidebarButton = document.getElementById('toggle-sidebar');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const topBanner = document.querySelector('.top-banner');
    if (toggleSidebarButton && sidebar && mainContent && topBanner) {
        toggleSidebarButton.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('sidebar-collapsed');
            topBanner.classList.toggle('sidebar-collapsed');
        });
    }

    // Llamar a la función para actualizar el nombre de la empresa
    actualizarNombreEmpresa();
    actualizarUsuarioActual();
});

// Función para actualizar el nombre de la empresa en el top-banner
async function actualizarNombreEmpresa() {
    try {
        const res = await fetch('/empresa_nombre');
        if (!res.ok) return;
        const data = await res.json();
        if (data.companyName) {
            const el = document.getElementById('company-name');
            if (el) el.textContent = data.companyName;
        }
    } catch (e) {
        // Opcional: manejar error
    }
}

async function actualizarUsuarioActual() {
    try {
        const res = await fetch('/usuario_actual');
        if (!res.ok) return;
        const data = await res.json();
        if (data.username) {
            const el = document.getElementById('user-username');
            if (el) el.textContent = data.username;
        }
        if (data.roles) {
            const el = document.getElementById('user-role');
            if (el) el.textContent = data.roles; // ← solo string
        }
    } catch (e) {
        // Opcional: manejar error
    }
}