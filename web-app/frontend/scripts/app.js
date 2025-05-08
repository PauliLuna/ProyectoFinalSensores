// This file contains the JavaScript code for the front end. It handles user interactions and dynamic content updates.

document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('myButton');
    const output = document.getElementById('output');

    button.addEventListener('click', function() {
        output.textContent = 'Button clicked! Hello, World!';
    });
});