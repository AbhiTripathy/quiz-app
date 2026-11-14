
const submission = sessionStorage.getItem("quizSubmission");

const description = document.getElementById("result-description");

if (submission) {
    const data = JSON.parse(submission);

    description.textContent = data.autoSubmitted
        ? "Your time expired and your submission was recorded."
        : "Your answers have been submitted successfully.";
} else {
    description.textContent = "No recent quiz submission found.";
}

// Scores and answer reviews will be loaded from the server.
// Never calculate the official score in this file.
