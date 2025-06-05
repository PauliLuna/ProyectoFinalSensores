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
});