document.querySelector("#registerBtn").addEventListener("click", (e) => {
    const name = document.querySelector("#name").value.trim();
    const email = document.querySelector("#email").value;
    const password = document.querySelector("#password").value;
    const role = document.querySelector("#role").value;
    const confirmPassword = document.querySelector("#confirm-password").value;

    clearErrors();
    let valid = true; 

    if(!name){
        showError("name-error", "Name is required");
        valid = false;
    }

    if(!email){
        showError("email-error", "Email is required");
        valid = false;
    }

    if(!role){
        showError("role-error", "Role is required");
        valid = false;
    }

    if (password.length < 8) {
        showError('password-error', 'Password must be at least 8 characters');
        valid = false;
    }

    if (password !== confirmPassword) {
        showError('confirm-password-error', 'Passwords do not match');
        valid = false;
    }

    if (valid) {
        submitRegistration({ name, email, password, role });
    }
});

function clearErrors(){
    document.querySelectorAll(".form-error").forEach(el => el.textContent = '');
}

function showError(id, message){
    document.querySelector("#" + id).textContent = message;
}

async function submitRegistration(data){
    const registerBtn = document.querySelector("#registerBtn");
    registerBtn.disabled = true;
    registerBtn.textContent = "Submitting...";
    const registerForm = document.querySelector("#registerForm");

    try {
        const response = await api("/api/auth/register", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },    
            body: JSON.stringify(data)
        });
        console.log(response);
        registerBtn.textContent = "Submitted!";
    } catch (err) {
        console.log(err);
        showError("registerError", err);
        registerBtn.disabled = false;
        registerBtn.textContent = 'Request an account';
    }
}