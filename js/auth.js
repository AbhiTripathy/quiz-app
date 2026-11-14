
const form = document.getElementById('auth-form');

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') || 'login';
const role = params.get('role') || 'user';

const isRegister = mode === 'register';
const isAdmin = role === 'admin';

// Form elements
const nameField = document.getElementById('name-field');
const confirmField = document.getElementById('confirm-field');
const inviteField = document.getElementById('invite-field');

const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirm-password');
const inviteInput = document.getElementById('invite-code');

const errorElement = document.getElementById('form-error');
const submitButton = document.getElementById('submit-btn');

// Text elements
const eyebrow = document.getElementById('eyebrow');
const heroTitle = document.getElementById('hero-title');
const heroDescription = document.getElementById('hero-description');

const formLabel = document.getElementById('form-label');
const formTitle = document.getElementById('form-title');
const formDescription = document.getElementById('form-description');

const switchText = document.getElementById('switch-text');
const switchLink = document.getElementById('switch-link');
const roleLabel = document.getElementById('role-label');

// Validate URL parameters
if (!['login', 'register'].includes(mode) ||
    !['user', 'admin'].includes(role)) {
    window.location.replace('/');
}

// Configure visible fields
nameField.hidden = !isRegister;
confirmField.hidden = !isRegister;
inviteField.hidden = !(isRegister && isAdmin);

nameInput.required = isRegister;
confirmInput.required = isRegister;
inviteInput.required = isRegister && isAdmin;

passwordInput.autocomplete = isRegister
    ? 'new-password'
    : 'current-password';

// Configure page content
if (isRegister) {
    eyebrow.textContent = 'START YOUR JOURNEY';
    heroTitle.innerHTML = 'CREATE<br>YOUR ACCOUNT.';
    heroDescription.textContent =
        'Join Quizroom and discover what you know.';

    formLabel.textContent = 'NEW ACCOUNT';
    formTitle.textContent = 'Sign up.';
    formDescription.textContent =
        'Create your account to get started.';

    submitButton.textContent = 'CREATE ACCOUNT ↗';

    switchText.textContent = 'Already have an account?';
    switchLink.textContent = 'Sign in ↗';

} else {
    eyebrow.textContent = 'YOUR KNOWLEDGE JOURNEY';
    heroTitle.innerHTML = 'WELCOME<br>BACK.';
    heroDescription.textContent =
        'Pick up where you left off. There is always something new to learn.';

    formLabel.textContent = 'ACCOUNT ACCESS';
    formTitle.textContent = 'Sign in.';
    formDescription.textContent =
        'Enter your credentials to continue.';

    submitButton.textContent = 'SIGN IN ↗';

    switchText.textContent = 'New here?';
    switchLink.textContent = 'Create an account ↗';
}

roleLabel.textContent = isAdmin ? 'ADMIN ACCOUNT' : 'USER ACCOUNT';

// Switch between login and registration
switchLink.href = isRegister
    ? `/pages/auth.html?mode=login&role=${role}`
    : `/pages/auth.html?mode=register&role=${role}`;

// Handle form submission
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorElement.textContent = '';

    if (isRegister && passwordInput.value !== confirmInput.value) {
        errorElement.textContent = 'Passwords do not match.';
        return;
    }

    submitButton.disabled = true;

    const payload = {
        email: emailInput.value.trim(),
        password: passwordInput.value
    };

    if (isRegister) {
        payload.name = nameInput.value.trim();
        payload.role = role;

        if (isAdmin) {
            payload.inviteCode = inviteInput.value;
        }
    }

    const endpoint = isRegister
        ? '/api/auth/register'
        : '/api/auth/login';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed.');
        }

        if (isRegister) {
            window.location.href =
                `/pages/auth.html?mode=login&role=${role}`;
            return;
        }

        window.location.href = data.user.role === 'admin'
            ? '/pages/admin.html'
            : '/pages/dashboard.html';

    } catch (error) {
        errorElement.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});
