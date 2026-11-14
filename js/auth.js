
const params = new URLSearchParams(window.location.search);

const mode = params.get("mode") === "register" ? "register" : "login";
const role = params.get("role") === "admin" ? "admin" : "user";

const isRegister = mode === "register";
const isAdmin = role === "admin";

const $ = id => document.getElementById(id);

const fields = {
    name: $("name-field"),
    confirm: $("confirm-field"),
    invite: $("invite-field")
};

// Configure visible fields
fields.name.classList.toggle("hidden", !isRegister);
fields.confirm.classList.toggle("hidden", !isRegister);
fields.invite.classList.toggle("hidden", !isRegister || !isAdmin);

// Configure required fields
$("name").required = isRegister;
$("confirm-password").required = isRegister;
$("invite-code").required = isRegister && isAdmin;

// Configure page content
$("hero-title").innerHTML = isRegister
    ? "JOIN THE<br>CURIOUS."
    : "WELCOME<br>BACK.";

$("hero-description").textContent = isRegister
    ? "Create an account and start challenging what you know."
    : "Pick up where you left off. There's always something new to learn.";

$("eyebrow").textContent = isAdmin
    ? "ADMINISTRATION"
    : "YOUR KNOWLEDGE JOURNEY";

$("form-label").textContent = isAdmin
    ? "ADMIN ACCESS"
    : "ACCOUNT ACCESS";

$("form-title").textContent = isRegister
    ? "Create account."
    : "Sign in.";

$("form-description").textContent = isAdmin
    ? "Access the quiz management dashboard."
    : "Enter your credentials to continue.";

$("submit-btn").textContent = isRegister
    ? "CREATE ACCOUNT ↗"
    : "SIGN IN ↗";

$("role-label").textContent = isAdmin
    ? "ADMIN ACCOUNT"
    : "USER ACCOUNT";

$("switch-text").textContent = isRegister
    ? "Already have an account?"
    : "New here?";

$("switch-link").textContent = isRegister
    ? "Sign in ↗"
    : "Create an account ↗";

$("switch-link").href =
    `auth.html?mode=${isRegister ? "login" : "register"}&role=${role}`;

$("admin-link").href = isAdmin
    ? "auth.html?mode=login&role=user"
    : "auth.html?mode=login&role=admin";

$("admin-link").textContent = isAdmin ? "USER ↗" : "ADMIN ↗";

$("password").autocomplete = isRegister
    ? "new-password"
    : "current-password";

// Form submission
$("auth-form").addEventListener("submit", async event => {
    event.preventDefault();

    const error = $("form-error");
    const button = $("submit-btn");

    error.textContent = "";

    const password = $("password").value;
    const confirmPassword = $("confirm-password").value;

    if (isRegister && password !== confirmPassword) {
        error.textContent = "Passwords do not match.";
        return;
    }

    const payload = {
        email: $("email").value.trim(),
        password,
        role
    };

    if (isRegister) {
        payload.name = $("name").value.trim();
    }

    if (isRegister && isAdmin) {
        payload.inviteCode = $("invite-code").value;
    }

    button.disabled = true;
    button.textContent = "PLEASE WAIT...";

    try {
        const endpoint = isRegister
            ? "/api/auth/register"
            : "/api/auth/login";

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Something went wrong.");
        }

        window.location.href = isAdmin
            ? "/pages/admin.html"
            : "/pages/dashboard.html";

    } catch (err) {
        error.textContent = err.message;
    } finally {
        button.disabled = false;
        button.textContent = isRegister
            ? "CREATE ACCOUNT ↗"
            : "SIGN IN ↗";
    }
});
