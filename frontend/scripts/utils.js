// Cargar sidebar y top-banner en paralelo
Promise.all([
    fetch('partials/sidebar.html').then(res => res.text()),
    fetch('partials/top-banner.html').then(res => res.text())
]).then(([sidebarHtml, topBannerHtml]) => {
    document.getElementById('sidebar-container').innerHTML = sidebarHtml;
    resaltarSidebarActivo(); 
    document.getElementById('top-banner-container').innerHTML = topBannerHtml;

    // Ahora sí existen ambos en el DOM
    const toggleSidebarButton = document.getElementById('toggle-sidebar');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const topBanner = document.querySelector('.top-banner');

    // --- aplicar estado colapsado guardado ---
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
        if (mainContent) mainContent.classList.add('sidebar-collapsed');
        if (topBanner) topBanner.classList.add('sidebar-collapsed');
    }

    if (toggleSidebarButton && sidebar && mainContent && topBanner) {
        toggleSidebarButton.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('sidebar-collapsed');
            topBanner.classList.toggle('sidebar-collapsed');
            // --- guardar estado en localStorage ---
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }

    // Llamar a la función para actualizar el nombre de la empresa
    actualizarNombreEmpresa();
    actualizarUsuarioActual();
    document.body.classList.remove('body-loading'); // <-- Mostrar todo el contenido una vez cargado el sidebar y top-banner
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

// Resalta la opción activa del sidebar según la página actual
function resaltarSidebarActivo() {
    const path = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar a').forEach(link => {
        // Quita la clase activa de todos
        link.classList.remove('active');
        // Si el href termina igual que el path actual, la marca como activa
        if (link.getAttribute('href') === path) {
            link.classList.add('active');
        }
    });
}