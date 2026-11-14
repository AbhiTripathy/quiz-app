
const $ = id => document.getElementById(id);

const params = new URLSearchParams(window.location.search);
const attemptId = Number(params.get('attemptId'));

async function loadResult() {
    const description = $('result-description');
    const reviewList = $('review-list');

    if (!Number.isInteger(attemptId) || attemptId <= 0) {
        description.textContent = 'Invalid result link.';
        return;
    }

    try {
        const response = await fetch(
            `/api/attempts/${attemptId}/result`,
            {
                credentials: 'same-origin'
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            window.location.href =
                '/pages/auth.html?mode=login&role=user';
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || 'Could not load results.');
        }

        const result = data.result;

        // Submission status
        description.textContent =
            result.status === 'expired'
                ? 'Your time expired. Your answers were evaluated.'
                : 'Your answers have been submitted successfully.';

        // Score
        $('result-score').innerHTML =
            `${result.score}<span> / ${result.totalMarks}</span>`;

        $('result-grade').textContent =
            `${result.accuracy}% MARKS EARNED`;

        // Statistics
        $('correct-count').textContent = result.correctCount;
        $('incorrect-count').textContent = result.incorrectCount;
        $('unanswered-count').textContent = result.unansweredCount;
        $('accuracy').textContent = `${result.accuracy}%`;

        // Answer review
        if (result.review.length === 0) {
            reviewList.innerHTML =
                '<p class="eyebrow">NO QUESTIONS TO REVIEW.</p>';
            return;
        }

        reviewList.innerHTML = result.review.map((item, index) => {
            const status = item.isCorrect
                ? 'correct'
                : item.selectedAnswer
                    ? 'incorrect'
                    : 'unanswered';

            const statusLabel = {
                correct: 'CORRECT',
                incorrect: 'INCORRECT',
                unanswered: 'NOT ANSWERED'
            }[status];

            return `
                <article class="review-card ${status}">
                    <div class="review-heading">
                        <span class="eyebrow">
                            QUESTION ${String(index + 1).padStart(2, '0')}
                        </span>

                        <span class="review-status">
                            ${statusLabel}
                        </span>
                    </div>

                    <h3>${escapeHTML(item.question)}</h3>

                    <p>
                        <strong>Your answer:</strong>
                        ${escapeHTML(item.selectedAnswer || 'Not answered')}
                    </p>

                    <p>
                        <strong>Correct answer:</strong>
                        ${escapeHTML(item.correctAnswer || 'Not available')}
                    </p>

                    <p class="review-marks">
                        ${item.marks} MARKS
                    </p>
                </article>
            `;
        }).join('');

    } catch (error) {
        console.error('Result loading error:', error.message);

        description.textContent = error.message;
        reviewList.innerHTML =
            '<p class="empty-state">Unable to load answer review.</p>';
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

loadResult();
