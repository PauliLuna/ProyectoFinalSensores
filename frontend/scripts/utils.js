// Cargar sidebar
fetch('partials/sidebar.html')
    .then(res => res.text())
    .then(html => {
        document.getElementById('sidebar-container').innerHTML = html;
        // Ahora que el sidebar está cargado, agrega el event listener
        const toggleSidebarButton = document.getElementById('toggle-sidebar');
        const sidebar = document.querySelector('.sidebar');
        if (toggleSidebarButton && sidebar) {
            toggleSidebarButton.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }
    });

// Cargar top-banner
fetch('partials/top-banner.html')
    .then(res => res.text())
    .then(html => document.getElementById('top-banner-container').innerHTML = html);