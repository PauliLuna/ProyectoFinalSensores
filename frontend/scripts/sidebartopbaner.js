// Cargar sidebar
fetch('partials/sidebar.html')
    .then(res => res.text())
    .then(html => document.getElementById('sidebar-container').innerHTML = html);

// Cargar top-banner
        fetch('partials/top-banner.html')
            .then(res => res.text())
            .then(html => document.getElementById('top-banner-container').innerHTML = html);