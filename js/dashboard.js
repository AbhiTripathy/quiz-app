
const role = document.body.dataset.role;

const $ = id => document.getElementById(id);

// Temporary sample data
const userData = {
    name: "Learner",
    attempted: 12,
    average: 78,
    best: 96,
    attempts: [
        ["Data Structures", "15 Nov 2026", "92%"],
        ["JavaScript Fundamentals", "13 Nov 2026", "76%"],
        ["Linear Algebra", "10 Nov 2026", "58%"]
    ]
};

const adminData = {
    name: "Administrator",
    quizzes: 24,
    questions: 480,
    users: 156,
    attempts: 892,
    recentQuizzes: [
        ["Data Structures", "Programming", 20, "PUBLISHED"],
        ["Human Biology", "Science", 15, "PUBLISHED"],
        ["Advanced Mathematics", "Mathematics", 25, "DRAFT"]
    ]
};

// USER DASHBOARD
function renderUserDashboard() {

    $("user-name").textContent = userData.name + ".";

    $("attempted").textContent = userData.attempted;
    $("average").textContent = userData.average + "%";
    $("best").textContent = userData.best + "%";

    $("attempt-list").innerHTML = userData.attempts.map(
        ([quiz, date, score]) => `
            <tr>
                <td>${quiz}</td>
                <td>${date}</td>
                <td>${score}</td>
                <td><span class="status good">COMPLETED</span></td>
            </tr>
        `
    ).join("");
}

// ADMIN DASHBOARD
function renderAdminDashboard() {

    $("user-name").textContent = adminData.name + ".";

    $("total-quizzes").textContent = adminData.quizzes;
    $("total-questions").textContent = adminData.questions;
    $("total-users").textContent = adminData.users;
    $("total-attempts").textContent = adminData.attempts;

    $("admin-quiz-list").innerHTML =
        adminData.recentQuizzes.map(
            ([quiz, category, questions, status]) => `
                <tr>
                    <td>${quiz}</td>
                    <td>${category}</td>
                    <td>${questions}</td>
                    <td>
                        <span class="status ${status === "PUBLISHED" ? "good" : ""}">
                            ${status}
                        </span>
                    </td>
                </tr>
            `
        ).join("");
}

// INITIALIZE
if (role === "user") {
    renderUserDashboard();
} else if (role === "admin") {
    renderAdminDashboard();
}

// TEMPORARY NAVIGATION
document.querySelector(".logout-btn")?.addEventListener("click", () => {
    window.location.href = "auth.html?mode=login&role=" + role;
});

if (role === "admin") {

    $("create-quiz").addEventListener("click", () => {
        alert("Quiz creation will be implemented next.");
    });

    $("manage-quizzes").addEventListener("click", () => {
        alert("Quiz management will be implemented next.");
    });

    $("manage-questions").addEventListener("click", () => {
        alert("Question management will be implemented next.");
    });

    $("manage-categories").addEventListener("click", () => {
        alert("Category management will be implemented next.");
    });

    $("manage-users").addEventListener("click", () => {
        alert("User management will be implemented next.");
    });
}
