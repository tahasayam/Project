// document.addEventListener("DOMContentLoaded", function () {

//   const form = document.querySelector('.login-form');

//   form.addEventListener('submit', function (e) {
//     e.preventDefault();

//     const email = document.getElementById('email').value.trim();
//     const password = document.getElementById('password').value;

//     if (email === 'admin@gmail.com' && password === 'admin123') {
//       window.location.href = './admin/index.html';
//     } 
//     else if (email === 'student@gmail.com' && password === 'student123') {
//       window.location.href = './student/dashboard.html';
//     } 
//     else if (email === 'teacher@gmail.com' && password === 'teacher123') {
//       window.location.href = './teacher/index.html';
//     } 
//     else {
//       alert('Invalid email or password!');
//     }
//   });

// });


// document.querySelector('.login-form').addEventListener('submit', function (e) {
//   e.preventDefault();
//   const email = document.getElementById('email').value.trim();
//   const password = document.getElementById('password').value;

//   if (email === 'admin@gmail.com' && password === 'admin123') {
//     window.location.href = '../../admin.html/index.html';
//   } else if (email === 'student@gmail.com' && password === 'student123') {
//     window.location.href = '../student/index.html';
//   } else if (email === 'teacher@gmail.com' && password === 'teacher123') {
//     window.location.href = '../teacher/index.html';
//   } else {
//     alert('Invalid email or password! Please check your credentials.');
//   }
// });

// const togglePassword = document.getElementById('togglePassword');
// const passwordInput = document.getElementById('password');
// const eyeIcon = document.getElementById('eyeIcon');

// togglePassword.addEventListener('click', function () {
//   const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
//   passwordInput.setAttribute('type', type);
//   if (type === 'text') {
//     eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
//   } else {
//     eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
//   }
// });








document.addEventListener("DOMContentLoaded", function () {

    // =========================
    // Login Form Submit
    // =========================

    const form = document.querySelector(".login-form");

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        try {
            const response = await fetch("http://localhost:5000/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username: email, password: password })
            });

            const data = await response.json();

            if (response.ok) {
                // Store token and user info
                localStorage.setItem("token", data.token);
                localStorage.setItem("role", data.role);
                localStorage.setItem("username", data.username);

                // Redirect based on role
                if (data.role === "Admin") {
                    window.location.href = "/Pages/Admin/index.html";
                } else if (data.role === "Student") {
                    window.location.href = "/Pages/Student/attendance.html";
                } else if (data.role === "Teacher") {
                    window.location.href = "/Pages/Teacher/index.html";
                }
            } else {
                alert(data.message || "Invalid email or password!");
            }
        } catch (error) {
            console.error("Login Error:", error);
            alert("Could not connect to the server. Please ensure the backend is running.");
        }
    });

    // =========================
    // Password Toggle
    // =========================

    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    const eyeIcon = document.getElementById("eyeIcon");

    // Eye Closed (password hidden)
    const eyeClosed = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    `;

    // Eye Open / Slash (password visible)
    const eyeOpen = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>

        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>

        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>

        <line x1="1" y1="1" x2="23" y2="23"></line>
    `;

    // Default icon
    eyeIcon.innerHTML = eyeClosed;

    // Toggle Password
    togglePassword.addEventListener("click", function () {

        const isPasswordHidden = passwordInput.type === "password";

        // Change input type
        passwordInput.type = isPasswordHidden ? "text" : "password";

        // Change icon
        eyeIcon.innerHTML = isPasswordHidden ? eyeOpen : eyeClosed;

    });

});