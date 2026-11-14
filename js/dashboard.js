const $ = id => document.getElementById(id);

const API_BASE = '/api';

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => {
        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };

        return entities[character];
    });
}

function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function renderStats(stats) {
    $('attempted').textContent = stats.attempted ?? 0;
    $('average').textContent = `${stats.average_score ?? 0}%`;
    $('best').textContent = `${stats.best_score ?? 0}%`;
}

function renderRecentAttempts(attempts) {
    const container = $('attempt-list');

    if (!attempts.length) {
        container.innerHTML = `
            <tr>
                <td colspan="4">You haven't completed any quizzes yet.</td>
            </tr>
        `;
        return;
    }

    container.innerHTML = attempts.map(attempt => {
        const status = attempt.status === 'expired'
            ? 'EXPIRED'
            : 'COMPLETED';

        const score = attempt.score_percentage == null
            ? '—'
            : `${attempt.score_percentage}%`;

        return `
            <tr>
                <td>
                    <a href="/pages/result.html?attemptId=${encodeURIComponent(attempt.id)}">
                        ${escapeHTML(attempt.quiz_title)}
                    </a>
                </td>
                <td>${formatDate(attempt.submitted_at || attempt.started_at)}</td>
                <td>${score}</td>
                <td>
                    <span class="status ${status === 'COMPLETED' ? 'good' : ''}">
                        ${status}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function renderRecommendedQuizzes(quizzes) {
    const container = $('recommended-quizzes');

    if (!quizzes.length) {
        container.innerHTML = '<p>No quizzes are available right now.</p>';
        return;
    }

    container.innerHTML = quizzes.map(quiz => `
        <article class="mini-card">
            <span class="eyebrow">${escapeHTML(quiz.category)}</span>
            <h3>${escapeHTML(quiz.title)}</h3>
            <p>
                ${quiz.question_count} QUESTIONS ·
                ${quiz.duration_minutes} MIN
            </p>
            <a href="/pages/quiz.html?id=${encodeURIComponent(quiz.id)}">
                EXPLORE ↗
            </a>
        </article>
    `).join('');
}

async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/users/me/dashboard`);

        if (response.status === 401) {
            window.location.href = '/pages/auth.html?mode=login&role=user';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to load dashboard.');
        }

        const data = await response.json();

        $('user-name').textContent = `${data.user.name}.`;

        renderStats(data.stats);
        renderRecentAttempts(data.recentAttempts);
        renderRecommendedQuizzes(data.recommendedQuizzes);

    } catch (error) {
        console.error(error);

        $('attempt-list').innerHTML = `
            <tr>
                <td colspan="4">Unable to load your activity. Please refresh.</td>
            </tr>
        `;

        $('recommended-quizzes').innerHTML =
            '<p>Unable to load recommended quizzes.</p>';
    }
}

async function logout() {
    try {
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Logout failed.');
        }

        window.location.href = '/pages/auth.html?mode=login&role=user';

    } catch (error) {
        console.error(error);
        alert('Unable to log out. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();

    $('.logout-btn')?.addEventListener('click', logout);
});

async function loadAdminDashboard() {
    try {
        const response = await fetch(`${API_BASE}/admin/dashboard`);

        if (response.status === 401) {
            window.location.href = '/pages/auth.html?mode=login&role=admin';
            return;
        }

        if (response.status === 403) {
            window.location.href = '/pages/index.html';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to load admin dashboard.');
        }

        const data = await response.json();

        $('user-name').textContent = `${data.admin.name}.`;

        $('total-quizzes').textContent = data.stats.totalQuizzes;
        $('total-questions').textContent = data.stats.totalQuestions;
        $('total-users').textContent = data.stats.totalUsers;
        $('total-attempts').textContent = data.stats.totalAttempts;

        renderAdminQuizzes(data.recentQuizzes);

    } catch (error) {
        console.error(error);

        $('admin-quiz-list').innerHTML = `
            <tr>
                <td colspan="4">Unable to load quiz data. Please refresh.</td>
            </tr>
        `;
    }
}

function renderAdminQuizzes(quizzes) {
    const container = $('admin-quiz-list');

    if (!quizzes.length) {
        container.innerHTML = `
            <tr>
                <td colspan="4">No quizzes have been created yet.</td>
            </tr>
        `;
        return;
    }

    container.innerHTML = quizzes.map(quiz => {
        const status = Number(quiz.is_published) === 1
            ? 'PUBLISHED'
            : 'DRAFT';

        return `
            <tr>
                <td>${escapeHTML(quiz.title)}</td>
                <td>${escapeHTML(quiz.category)}</td>
                <td>${quiz.question_count}</td>
                <td>
                    <span class="status ${status === 'PUBLISHED' ? 'good' : ''}">
                        ${status}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

const role = document.body.dataset.role;

async function logout() {
    try {
        const response = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Logout failed.');
        }

        window.location.href =
            `/pages/auth.html?mode=login&role=${encodeURIComponent(role)}`;

    } catch (error) {
        console.error(error);
        alert('Unable to log out. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('.logout-btn')?.addEventListener('click', logout);

    if (role === 'admin') {
        loadAdminDashboard();
    } else if (role === 'user') {
        loadDashboard();
    }

    if (role === 'admin') {
    loadCategories().catch(error => {
        createQuizMessage.textContent = error.message;
    });

    $('create-quiz').addEventListener('click', () => {
        createQuizSection.hidden = false;
        createQuizSection.scrollIntoView({ behavior: 'smooth' });
    });

    $('cancel-create-quiz').addEventListener('click', () => {
        createQuizSection.hidden = true;
        createQuizForm.reset();
        createQuizMessage.textContent = '';
    });

    createQuizForm.addEventListener('submit', addQuiz);
}
});

const createQuizSection = $('create-quiz-section');
const createQuizForm = $('create-quiz-form');
const createQuizMessage = $('create-quiz-message');

async function loadCategories() {
    const response = await fetch(`${API_BASE}/categories`);

    if (!response.ok) {
        throw new Error('Unable to load categories.');
    }

    const categories = await response.json();
    const select = $('quiz-category');

    select.innerHTML = `
        <option value="">Select a category</option>
        ${categories.map(category => `
            <option value="${category.id}">
                ${escapeHTML(category.name)}
            </option>
        `).join('')}
    `;
}

async function addQuiz(event) {
    event.preventDefault();

    const formData = new FormData(createQuizForm);

    const quiz = {
        title: formData.get('title').trim(),
        description: formData.get('description').trim(),
        category_id: Number(formData.get('category_id')),
        duration_minutes: Number(formData.get('duration_minutes'))
    };

    createQuizMessage.textContent = 'Adding quiz...';

    try {
        const response = await fetch(`${API_BASE}/admin/quizzes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(quiz)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to add quiz.');
        }

        createQuizMessage.textContent = 'Quiz added successfully.';
        createQuizForm.reset();

        await loadAdminDashboard();

    } catch (error) {
        createQuizMessage.textContent = error.message;
    }
}