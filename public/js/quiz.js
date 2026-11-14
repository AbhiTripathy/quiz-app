
const $ = id => document.getElementById(id);

const params = new URLSearchParams(window.location.search);
const quizId = Number(params.get('id'));

let quiz = null;
let questions = [];
let answers = {};

let currentQuestion = 0;
let attemptId = null;
let expiresAt = null;
let timerInterval = null;
let submitted = false;

const letters = 'ABCDEFGHIJ'.split('');

const pendingSaves = new Map();

// Load quiz information before starting.
async function loadQuiz() {
    if (!Number.isInteger(quizId) || quizId <= 0) {
        showError('Invalid quiz ID.');
        return;
    }

    try {
        const response = await fetch(`/api/quizzes/${quizId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Could not load quiz.');
        }

        quiz = data.quiz;

        $('quiz-title').textContent = quiz.title;
        $('quiz-description').textContent = quiz.description || '';
        $('quiz-category').textContent = quiz.category.toUpperCase();

        $('question-count').textContent = quiz.questions.length;
        $('quiz-duration').textContent = `${quiz.duration_minutes} MIN`;

        const totalMarks = quiz.questions.reduce(
            (sum, question) => sum + Number(question.marks),
            0
        );

        $('total-marks').textContent = totalMarks;

        $('active-category').textContent = quiz.category.toUpperCase();
        $('active-title').textContent = quiz.title;

    } catch (error) {
        showError(error.message);
        $('start-quiz').disabled = true;
    }
}

function showError(message) {
    $('submit-message').textContent = message;
    $('submit-modal').classList.remove('hidden');
}

// Start a real attempt.
async function startQuiz() {
    $('start-quiz').disabled = true;

    try {
        const response = await fetch(
            `/api/quizzes/${quizId}/attempts`,
            {
                method: 'POST',
                credentials: 'same-origin'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href =
                    '/pages/auth.html?mode=login&role=user';
                return;
            }

            throw new Error(data.message || 'Could not start quiz.');
        }

        attemptId = data.attempt.id;
        expiresAt = new Date(data.attempt.expiresAt).getTime();

        if (!Number.isFinite(expiresAt)) {
            throw new Error('Invalid expiry time received from server.');
        }

        questions = data.attempt.questions;

        if (questions.length === 0) {
            throw new Error('This quiz has no questions.');
        }

        quiz.title = data.attempt.quiz;
        submitted = false;

        $('instructions-screen').classList.add('hidden');
        $('active-screen').classList.remove('hidden');

        $('active-title').textContent = quiz.title;

        renderQuestion();
        startTimer();

    } catch (error) {
        showError(error.message);
        $('start-quiz').disabled = false;
    }
}

// Render the current question.
function renderQuestion() {
    const question = questions[currentQuestion];

    $('question-number').textContent =
        `QUESTION ${String(currentQuestion + 1).padStart(2, '0')}`;

    $('question-position').textContent =
        `QUESTION ${String(currentQuestion + 1).padStart(2, '0')} / ${questions.length}`;

    $('question-text').textContent = question.question;

    document.querySelector('.question-top span:last-child').textContent =
        `${question.marks} MARKS`;

    $('options-container').innerHTML = question.options.map(
        (option, index) => `
            <button
                class="option ${
                    answers[question.id] === option.id ? 'selected' : ''
                }"
                data-option-id="${option.id}"
                type="button"
                ${submitted ? 'disabled' : ''}
            >
                <span class="option-key">${letters[index]}</span>
                <span>${escapeHTML(option.text)}</span>
            </button>
        `
    ).join('');

    $('previous-btn').disabled = currentQuestion === 0;
    $('previous-btn').style.opacity =
        currentQuestion === 0 ? '0.4' : '1';

    $('next-btn').textContent =
        currentQuestion === questions.length - 1
            ? 'LAST QUESTION'
            : 'NEXT QUESTION →';

    renderNavigator();
    updateProgress();
}

// Render question navigator.
function renderNavigator() {
    $('question-grid').innerHTML = questions.map(
        (question, index) => `
            <button
                class="question-number
                    ${index === currentQuestion ? 'current' : ''}
                    ${answers[question.id] ? 'answered' : ''}"
                data-question="${index}"
                type="button"
            >
                ${index + 1}
            </button>
        `
    ).join('');
}

// Update progress.
function updateProgress() {
    const answered = Object.keys(answers).length;

    $('answered-count').textContent = `${answered} ANSWERED`;

    $('progress-fill').style.width =
        `${((currentQuestion + 1) / questions.length) * 100}%`;
}

// Escape option text before inserting HTML.
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

// Save an answer to the backend.
function saveAnswer(questionId, optionId) {
    const previousSave = pendingSaves.get(questionId) || Promise.resolve();

    const save = previousSave
        .catch(() => {})
        .then(async () => {
            const response = await fetch(
                `/api/attempts/${attemptId}/answers`,
                {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        questionId,
                        optionId
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Could not save answer.');
            }
        });

    pendingSaves.set(questionId, save);

    save.finally(() => {
        if (pendingSaves.get(questionId) === save) {
            pendingSaves.delete(questionId);
        }
    }).catch(() => {});

    return save;
}

// Select an option.
$('options-container').addEventListener('click', async event => {
    const option = event.target.closest('.option');

    if (!option || submitted) return;

    const question = questions[currentQuestion];
    const optionId = Number(option.dataset.optionId);

    answers[question.id] = optionId;
    renderQuestion();

    try {
        await saveAnswer(question.id, optionId);
    } catch (error) {
        console.error('Answer saving error:', error.message);
        $('submit-message').textContent =
            'An answer could not be saved. Please try selecting it again.';
    }
});

// Navigate questions.
$('previous-btn').addEventListener('click', () => {
    if (currentQuestion > 0) {
        currentQuestion--;
        renderQuestion();
    }
});

$('next-btn').addEventListener('click', () => {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        renderQuestion();
    }
});

$('question-grid').addEventListener('click', event => {
    const button = event.target.closest('.question-number');

    if (!button) return;

    currentQuestion = Number(button.dataset.question);
    renderQuestion();
});

// Countdown based on server expiry.
function startTimer() {
    updateTimer();

    timerInterval = setInterval(() => {
        updateTimer();
    }, 1000);
}

function updateTimer() {
    const timeLeft = Math.max(
        0,
        Math.ceil((expiresAt - Date.now()) / 1000)
    );

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    $('timer-display').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (timeLeft <= 60) {
        document.querySelector('.timer').classList.add('warning');
    }

    if (timeLeft === 0) {
        clearInterval(timerInterval);
        submitQuiz(true);
    }
}

// Submission confirmation.
$('submit-quiz').addEventListener('click', () => {
    const unanswered = questions.length - Object.keys(answers).length;

    $('submit-message').textContent = unanswered
        ? `You have ${unanswered} unanswered question(s). Are you sure you want to submit?`
        : 'You have answered every question. Are you ready to submit?';

    $('submit-modal').classList.remove('hidden');
});

$('cancel-submit').addEventListener('click', () => {
    $('submit-modal').classList.add('hidden');
});

$('confirm-submit').addEventListener('click', () => {
    submitQuiz(false);
});

// Submit to backend.
async function submitQuiz(autoSubmitted = false) {
    if (submitted || !attemptId) return;

    submitted = true;
    clearInterval(timerInterval);

    $('confirm-submit').disabled = true;
    $('submit-quiz').disabled = true;

    try {
        // Wait for all pending answer saves before submitting.
        await Promise.all([...pendingSaves.values()]);

        const response = await fetch(
            `/api/attempts/${attemptId}/submit`,
            {
                method: 'POST',
                credentials: 'same-origin'
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Could not submit quiz.');
        }

        window.location.href =
            `/pages/result.html?attemptId=${attemptId}`;

    } catch (error) {
        console.error('Submission error:', error.message);

        submitted = false;
        $('confirm-submit').disabled = false;
        $('submit-quiz').disabled = false;

        $('submit-message').textContent =
            `${error.message} Please try submitting again.`;

        $('submit-modal').classList.remove('hidden');
    }
}

// Start button.
$('start-quiz').addEventListener('click', startQuiz);

// Load quiz details on page load.
loadQuiz();
