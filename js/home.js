
const container = document.getElementById('quiz-container');
const countLabel = document.getElementById('quiz-count');

let quizzes = [];
let activeCategory = 'all';
let activeView = 'grid';

// Convert database category names into homepage filter names.
function normalizeCategory(category) {
    const categories = {
        'programming': 'programming',
        'science': 'science',
        'mathematics': 'mathematics',
        'general knowledge': 'general'
    };

    return categories[category.toLowerCase()] || 'other';
}

// Fetch published quizzes from the backend.
async function loadQuizzes() {
    container.innerHTML = '<p class="empty-state">Loading quizzes...</p>';

    try {
        const response = await fetch('/api/quizzes');

        if (!response.ok) {
            throw new Error('Could not load quizzes.');
        }

        const data = await response.json();

        quizzes = data.quizzes.map(quiz => ({
            id: quiz.id,
            title: quiz.title,
            description: quiz.description || 'Test your knowledge.',
            category: normalizeCategory(quiz.category),
            questions: Number(quiz.question_count),
            duration: Number(quiz.duration_minutes)
        }));

        renderQuizzes();

    } catch (error) {
        console.error('Quiz loading error:', error);

        countLabel.textContent = 'UNABLE TO LOAD QUIZZES';
        container.innerHTML =
            '<p class="empty-state">Something went wrong. Please try again later.</p>';
    }
}

// Render quiz cards.
function renderQuizzes() {
    const filtered = quizzes.filter(quiz =>
        activeCategory === 'all' ||
        quiz.category === activeCategory
    );

    countLabel.textContent = `${filtered.length} QUIZZES FOUND`;

    if (filtered.length === 0) {
        container.innerHTML =
            '<p class="empty-state">No quizzes found.</p>';
        return;
    }

    container.innerHTML = filtered.map((quiz, index) => `
        <article class="quiz-card">

            <span class="quiz-number">
                ${String(index + 1).padStart(2, '0')}
            </span>

            <div class="quiz-info">
                <h3>${escapeHTML(quiz.title)}</h3>
                <p>${escapeHTML(quiz.description)}</p>
            </div>

            <span class="quiz-category">
                ${escapeHTML(quiz.category.toUpperCase())}
            </span>

            <div class="quiz-meta">
                <span>${quiz.questions} QUESTIONS</span>
                <span>${quiz.duration} MIN</span>
            </div>

            <button class="quiz-action" data-quiz-id="${quiz.id}">
                TAKE QUIZ ↗
            </button>

        </article>
    `).join('');
}

// Escape database text before inserting it into HTML.
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

// Category filtering.
document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelector('.filter-btn.active')
            ?.classList.remove('active');

        button.classList.add('active');
        activeCategory = button.dataset.category;

        renderQuizzes();
    });
});

// Stack / Grid switching.
document.querySelectorAll('.view-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelector('.view-btn.active')
            ?.classList.remove('active');

        button.classList.add('active');
        activeView = button.dataset.view;

        container.className = `quiz-container ${activeView}`;
    });
});

// Quiz selection.
container.addEventListener('click', event => {
    const button = event.target.closest('.quiz-action');

    if (!button) return;

    const quizId = Number(button.dataset.quizId);

    window.location.href = `/pages/quiz.html?id=${quizId}`;
});

// Initial load.
container.className = `quiz-container ${activeView}`;
loadQuizzes();
