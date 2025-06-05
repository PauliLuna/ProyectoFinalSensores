// Cargar sidebar
fetch('partials/sidebar.html')
    .then(res => res.text())
    .then(html => {
        document.getElementById('sidebar-container').innerHTML = html;
        const toggleSidebarButton = document.getElementById('toggle-sidebar');
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        if (toggleSidebarButton && sidebar && mainContent) {
            toggleSidebarButton.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                mainContent.classList.toggle('sidebar-collapsed');
            });
        }
});

// Cargar top-banner
fetch('partials/top-banner.html')
    .then(res => res.text())
    .then(html => document.getElementById('top-banner-container').innerHTML = html);