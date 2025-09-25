// Email Sending Logic
document.getElementById('contact-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;

    const response = await fetch('/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
    });
    const result = await response.json();
    if (response.ok) {
        document.getElementById('contact-form').reset();
        alert(result.success);
    } else {
        alert(result.error);
    }
});

// JavaScript to toggle the sidebar
document.getElementById('registerBtn').addEventListener('click', function(e) {
    e.preventDefault();
    const acc = document.getElementById('registerAccordion');
    acc.style.display = acc.style.display === 'none' || acc.style.display === '' ? 'block' : 'none';
    // Optional: close accordion if clicked outside
    document.addEventListener('click', function handler(event) {
        if (!acc.contains(event.target) && event.target.id !== 'registerBtn') {
            acc.style.display = 'none';
            document.removeEventListener('click', handler);
        }
    });
});

document.getElementById('startNowBtn').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('start-now').scrollIntoView({ behavior: 'smooth' });
});