document.addEventListener('DOMContentLoaded', async () => {
    try {
        const token = sessionStorage.getItem('authToken');
        if (!token) {
            return;
        }

        const payload = isTokenExpired(token);
        const userRole = payload.entity_type;

        // Determinar qué sidebar cargar según el rol
        let sidebarPath = "";
        if (userRole === "superAdmin") {
            sidebarPath = "partials/sidebar.html";
        } else if (userRole === "usuario") {
            sidebarPath = "partials/sidebarUser.html";
        } else {
            console.warn("Rol desconocido:", userRole);
            return;
        }

        // Cargar sidebar y top-banner en paralelo
        const [sidebarHtml, topBannerHtml] = await Promise.all([
            fetch(sidebarPath).then(res => res.text()),
            fetch('partials/top-banner.html').then(res => res.text())
        ]);

        // Insertar los partials
        document.getElementById('sidebar-container').innerHTML = sidebarHtml;
        document.getElementById('top-banner-container').innerHTML = topBannerHtml;

        // --- Activar funciones de UI ---
        resaltarSidebarActivo(); 

        // Logout
        const logoutLink = document.getElementById('logout-link');
        if (logoutLink) {
            logoutLink.addEventListener('click', e => {
                e.preventDefault();
                // sessionStorage.removeItem('authToken');
                sessionStorage.clear(); // o remover solo las claves específicas
                localStorage.clear();
                window.location.href = "signin.html";
            });
        }

        // Toggle Sidebar
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
                localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            });
        }

        // Actualizar datos de sesión en UI
        actualizarNombreEmpresa();
        actualizarUsuarioActual();

        document.body.classList.remove('body-loading'); // mostrar contenido

    } catch (err) {
        console.error("Error cargando sidebar/top-banner:", err);
    }
});

// Función para actualizar el nombre de la empresa en el top-banner
async function getEmpresaNombreCached() {
    const cacheKey = 'empresa_nombre';

    // ¿Ya lo tengo en cache?
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);

    // Si no, lo pido al backend
    const res = await fetch('/empresa_nombre', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return null;

    const data = await res.json();
    sessionStorage.setItem(cacheKey, JSON.stringify(data)); // Guardar en cache
    return data;
}

async function actualizarNombreEmpresa() {
    const data = await getEmpresaNombreCached();
    if (data?.companyName) {
        const el = document.getElementById('company-name');
        if (el) el.textContent = data.companyName;
    }
}

// Función para actualizar el nombre del usuario en el top-banner
async function getUsuarioActualCached() {
    const cacheKey = 'usuario_actual';

    // 1. ¿Existe en el cache?
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    // 2. Si no existe en cache → pedir al backend
    const res = await fetch('/usuario_actual', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });

    if (!res.ok) return null;

    const data = await res.json();

    // 3. Guardar en cache
    sessionStorage.setItem(cacheKey, JSON.stringify(data));

    return data;
}

async function actualizarUsuarioActual() {
    const data = await getUsuarioActualCached();
    if (!data) return;

    if (data.username) {
        const el = document.getElementById('user-username');
        if (el) el.textContent = data.username;
    }

    if (data.roles) {
        const el = document.getElementById('user-role');
        if (el) el.textContent = data.roles;
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

// --- Función para mostrar/ocultar contraseña ---
function togglePassword(inputId, eyeIconId) {
    const passwordInput = document.getElementById(inputId);
    const eyeIcon = document.getElementById(eyeIconId);
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        eyeIcon.textContent = "👁️";
    } else {
        passwordInput.type = "password";
        eyeIcon.textContent = "🙈";
    }
}

// --- Validación de contraseña fuerte ---
function esPasswordFuerte(pass) {
    return (
        pass.length >= 8 &&
        /[A-Z]/.test(pass) &&    // al menos una mayúscula
        /[a-z]/.test(pass) &&    // al menos una minúscula
        /[^A-Za-z0-9]/.test(pass) // al menos un símbolo
    );
}

// Verificar si el usuario está autenticado y el token no está expirado + Decodificar payload
function isTokenExpired(token) {
    if (!token) return null;

    try {
        // 1. Decodificar el token (Base64 URL)
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));

        // Verificar Expiración
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return null;
        }
        // 3. Si es válido y no expirado, retornar el payload completo
        return payload;

    } catch (e) {
        return null;
    }
}