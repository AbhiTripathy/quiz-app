
const questions = [
    {
        id: 1,
        text: "Which data structure follows the LIFO principle?",
        options: ["Queue", "Stack", "Linked List", "Tree"]
    },
    {
        id: 2,
        text: "What is the average time complexity of binary search?",
        options: ["O(n)", "O(n²)", "O(log n)", "O(1)"]
    },
    {
        id: 3,
        text: "Which data structure is commonly used in BFS?",
        options: ["Stack", "Queue", "Heap", "Hash Table"]
    },
    {
        id: 4,
        text: "Which sorting algorithm has average O(n log n) time complexity?",
        options: ["Bubble Sort", "Insertion Sort", "Merge Sort", "Selection Sort"]
    },
    {
        id: 5,
        text: "Which traversal visits the root between the left and right subtrees?",
        options: ["Inorder", "Preorder", "Postorder", "Level order"]
    },
    {
        id: 6,
        text: "Which data structure is used to implement recursion?",
        options: ["Queue", "Stack", "Graph", "Heap"]
    },
    {
        id: 7,
        text: "What is the worst-case time complexity of linear search?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"]
    },
    {
        id: 8,
        text: "Which structure organizes data using key-value pairs?",
        options: ["Stack", "Hash Table", "Queue", "Tree"]
    },
    {
        id: 9,
        text: "Which algorithm finds the shortest paths from a source in a graph with non-negative edge weights?",
        options: ["Kruskal's", "Dijkstra's", "Prim's", "DFS"]
    },
    {
        id: 10,
        text: "Which data structure is typically used for implementing a priority queue?",
        options: ["Heap", "Stack", "Linked List", "Array only"]
    }
];

const answers = {};
let currentQuestion = 0;
let timeLeft = 15 * 60;
let timerInterval = null;
let submitted = false;

const $ = id => document.getElementById(id);

const letters = ["A", "B", "C", "D"];

const totalQuestions = questions.length;

// Initial quiz details
$("question-count").textContent = totalQuestions;
$("total-marks").textContent = totalQuestions;

// Render question
function renderQuestion() {

    const question = questions[currentQuestion];

    $("question-number").textContent =
        `QUESTION ${String(currentQuestion + 1).padStart(2, "0")}`;

    $("question-position").textContent =
        `QUESTION ${String(currentQuestion + 1).padStart(2, "0")} / ${totalQuestions}`;

    $("question-text").textContent = question.text;

    $("options-container").innerHTML =
        question.options.map((option, index) => `
            <button
                class="option ${answers[question.id] === index ? "selected" : ""}"
                data-option="${index}"
                type="button"
            >
                <span class="option-key">${letters[index]}</span>
                <span>${option}</span>
            </button>
        `).join("");

    $("previous-btn").disabled = currentQuestion === 0;
    $("previous-btn").style.opacity =
        currentQuestion === 0 ? "0.4" : "1";

    $("next-btn").textContent =
        currentQuestion === totalQuestions - 1
            ? "LAST QUESTION"
            : "NEXT QUESTION →";

    renderNavigator();
    updateProgress();
}

// Render question navigator
function renderNavigator() {

    $("question-grid").innerHTML =
        questions.map((question, index) => `
            <button
                class="question-number
                    ${index === currentQuestion ? "current" : ""}
                    ${answers[question.id] !== undefined ? "answered" : ""}"
                data-question="${index}"
                type="button"
            >
                ${index + 1}
            </button>
        `).join("");
}

// Update progress
function updateProgress() {

    const answered = Object.keys(answers).length;

    $("answered-count").textContent =
        `${answered} ANSWERED`;

    $("progress-fill").style.width =
        `${((currentQuestion + 1) / totalQuestions) * 100}%`;
}

// Select answer
$("options-container").addEventListener("click", event => {

    const option = event.target.closest(".option");

    if (!option || submitted) return;

    const selected = Number(option.dataset.option);

    answers[questions[currentQuestion].id] = selected;

    renderQuestion();
});

// Navigate questions
$("previous-btn").addEventListener("click", () => {

    if (currentQuestion > 0) {
        currentQuestion--;
        renderQuestion();
    }
});

$("next-btn").addEventListener("click", () => {

    if (currentQuestion < totalQuestions - 1) {
        currentQuestion++;
        renderQuestion();
    }
});

// Jump to question
$("question-grid").addEventListener("click", event => {

    const button = event.target.closest(".question-number");

    if (!button) return;

    currentQuestion = Number(button.dataset.question);

    renderQuestion();
});

// Countdown
function startTimer() {

    updateTimer();

    timerInterval = setInterval(() => {

        timeLeft--;

        updateTimer();

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitQuiz(true);
        }

    }, 1000);
}

function updateTimer() {

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    $("timer-display").textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    if (timeLeft <= 60) {
        document.querySelector(".timer").classList.add("warning");
    }
}

// Start quiz
$("start-quiz").addEventListener("click", () => {

    $("instructions-screen").classList.add("hidden");
    $("active-screen").classList.remove("hidden");

    $("active-title").textContent = "Data Structures & Algorithms";

    renderQuestion();
    startTimer();
});

// Submission confirmation
$("submit-quiz").addEventListener("click", () => {

    const unanswered = totalQuestions - Object.keys(answers).length;

    $("submit-message").textContent = unanswered
        ? `You have ${unanswered} unanswered question(s). Are you sure you want to submit?`
        : "You have answered every question. Are you ready to submit?";

    $("submit-modal").classList.remove("hidden");
});

$("cancel-submit").addEventListener("click", () => {
    $("submit-modal").classList.add("hidden");
});

$("confirm-submit").addEventListener("click", () => {
    submitQuiz(false);
});

// Submit answers
function submitQuiz(autoSubmitted) {

    if (submitted) return;

    submitted = true;
    clearInterval(timerInterval);

    // Preview only: replace with server submission API.
    const result = {
        answers,
        autoSubmitted,
        demo: true
    };

    sessionStorage.setItem("quizSubmission", JSON.stringify(result));

    window.location.href = "result.html?demo=true";
}
