
const quizzes = [
    {
        id: 1,
        title: "Data Structures & Algorithms",
        description: "Test your understanding of fundamental DSA concepts.",
        category: "programming",
        questions: 20,
        duration: 30
    },
    {
        id: 2,
        title: "JavaScript Fundamentals",
        description: "Variables, closures, promises and more.",
        category: "programming",
        questions: 15,
        duration: 20
    },
    {
        id: 3,
        title: "Object Oriented Programming",
        description: "Classes, inheritance, polymorphism and abstraction.",
        category: "programming",
        questions: 20,
        duration: 25
    },
    {
        id: 4,
        title: "Fundamentals of Physics",
        description: "Mechanics, thermodynamics and electromagnetism.",
        category: "science",
        questions: 15,
        duration: 20
    },
    {
        id: 5,
        title: "Human Biology",
        description: "Explore the systems of the human body.",
        category: "science",
        questions: 20,
        duration: 25
    },
    {
        id: 6,
        title: "Linear Algebra",
        description: "Matrices, vectors and linear transformations.",
        category: "mathematics",
        questions: 15,
        duration: 20
    },
    {
        id: 7,
        title: "Probability & Statistics",
        description: "Distributions, probability and statistical inference.",
        category: "mathematics",
        questions: 20,
        duration: 30
    },
    {
        id: 8,
        title: "General Knowledge",
        description: "A little bit of everything.",
        category: "general",
        questions: 25,
        duration: 30
    }
];

const container = document.getElementById("quiz-container");
const countLabel = document.getElementById("quiz-count");

let activeCategory = "all";
let activeView = "grid";

// Render quiz cards
function renderQuizzes() {

    const filtered = quizzes.filter(quiz =>
        activeCategory === "all" ||
        quiz.category === activeCategory
    );

    countLabel.textContent =
        `${filtered.length} QUIZZES FOUND`;

    if (filtered.length === 0) {
        container.innerHTML =
            '<p class="empty-state">No quizzes found.</p>';
        return;
    }

    container.innerHTML = filtered.map((quiz, index) => `
        <article class="quiz-card">

            <span class="quiz-number">
                ${String(index + 1).padStart(2, "0")}
            </span>

            <div class="quiz-info">
                <h3>${quiz.title}</h3>
                <p>${quiz.description}</p>
            </div>

            <span class="quiz-category">
                ${quiz.category.toUpperCase()}
            </span>

            <div class="quiz-meta">
                <span>${quiz.questions} QUESTIONS</span>
                <span>${quiz.duration} MIN</span>
            </div>

            <button class="quiz-action"
                data-quiz-id="${quiz.id}">
                TAKE QUIZ ↗
            </button>

        </article>
    `).join("");
}

// Category filtering
document.querySelectorAll(".filter-btn").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelector(".filter-btn.active")
            ?.classList.remove("active");

        button.classList.add("active");

        activeCategory = button.dataset.category;

        renderQuizzes();
    });
});

// Stack / Grid switching
document.querySelectorAll(".view-btn").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelector(".view-btn.active")
            ?.classList.remove("active");

        button.classList.add("active");

        activeView = button.dataset.view;

        container.className = `quiz-container ${activeView}`;
    });
});

// Quiz selection
container.addEventListener("click", event => {

    const button = event.target.closest(".quiz-action");

    if (!button) return;

    const quizId = Number(button.dataset.quizId);

    // Placeholder until authentication and API are implemented
    window.location.href = `quiz.html?id=${quizId}`;
});

// Initial rendering
renderQuizzes();
