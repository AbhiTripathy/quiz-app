
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();

// Register
router.post('/auth/register', async (req, res) => {
    try {
        const { name, email, password, role, inviteCode } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: 'Name, email and password are required.'
            });
        }

        if (typeof name !== 'string' || typeof email !== 'string' ||
            typeof password !== 'string') {
            return res.status(400).json({
                message: 'Invalid input.'
            });
        }

        if (name.trim().length === 0 || name.length > 100) {
            return res.status(400).json({
                message: 'Name must be between 1 and 100 characters.'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must contain at least 8 characters.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                message: 'Enter a valid email address.'
            });
        }

        // Admin registration requires a server-side invitation code.
        let userRole = 'user';

        if (role === 'admin') {
            if (!process.env.ADMIN_INVITE_CODE ||
                inviteCode !== process.env.ADMIN_INVITE_CODE) {
                return res.status(403).json({
                    message: 'Invalid admin invitation code.'
                });
            }

            userRole = 'admin';
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const [result] = await pool.execute(
            `INSERT INTO users (name, email, password, role)
             VALUES (?, ?, ?, ?)`,
            [name.trim(), normalizedEmail, hashedPassword, userRole]
        );

        res.status(201).json({
            message: 'Registration successful.',
            userId: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'An account with this email already exists.'
            });
        }

        console.error('Registration error:', error.message);
        res.status(500).json({
            message: 'Something went wrong.'
        });
    }
});

// Login
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({
                message: 'Email and password are required.'
            });
        }

        const [users] = await pool.execute(
            `SELECT id, name, email, password, role
             FROM users
             WHERE email = ?`,
            [email.trim().toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const user = users[0];
        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        // Regenerate session to prevent session fixation.
        req.session.regenerate((error) => {
            if (error) {
                console.error(error.message);
                return res.status(500).json({
                    message: 'Could not create session.'
                });
            }

            req.session.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            };

            req.session.save((error) => {
                if (error) {
                    console.error(error.message);
                    return res.status(500).json({
                        message: 'Could not save session.'
                    });
                }

                res.json({
                    message: 'Login successful.',
                    user: req.session.user
                });
            });
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({
            message: 'Something went wrong.'
        });
    }
});

// Current logged-in user
router.get('/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.session.user });
});

// Logout
router.post('/auth/logout', requireAuth, (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                message: 'Could not log out.'
            });
        }

        res.clearCookie('quiz.sid');
        res.json({ message: 'Logged out successfully.' });
    });
});

// Get all published quizzes
router.get('/quizzes', async (req, res) => {
    try {
        const { category } = req.query;

        let sql = `
            SELECT
                q.id,
                q.title,
                q.description,
                q.duration_minutes,
                c.name AS category,
                COUNT(DISTINCT qu.id) AS question_count
            FROM quizzes q
            JOIN categories c ON q.category_id = c.id
            LEFT JOIN questions qu ON q.id = qu.quiz_id
            WHERE q.is_published = TRUE
        `;

        const params = [];

        if (category) {
            const categoryId = Number(category);

            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                return res.status(400).json({
                    message: 'Invalid category.'
                });
            }

            sql += ' AND q.category_id = ?';
            params.push(categoryId);
        }

        sql += `
            GROUP BY q.id, c.name
            ORDER BY q.id DESC
        `;

        const [quizzes] = await pool.execute(sql, params);

        res.json({ quizzes });
    } catch (error) {
        console.error('Quiz listing error:', error.message);
        res.status(500).json({
            message: 'Could not retrieve quizzes.'
        });
    }
});

// Get quiz details
router.get('/quizzes/:id', async (req, res) => {
    try {
        const quizId = Number(req.params.id);

        if (!Number.isInteger(quizId) || quizId <= 0) {
            return res.status(400).json({
                message: 'Invalid quiz ID.'
            });
        }

        // Retrieve published quiz
        const [quizzes] = await pool.execute(
            `SELECT
                q.id,
                q.title,
                q.description,
                q.duration_minutes,
                c.name AS category
             FROM quizzes q
             JOIN categories c ON q.category_id = c.id
             WHERE q.id = ? AND q.is_published = TRUE`,
            [quizId]
        );

        if (quizzes.length === 0) {
            return res.status(404).json({
                message: 'Quiz not found.'
            });
        }

        // Retrieve questions and options
        const [rows] = await pool.execute(
            `SELECT
                qu.id AS question_id,
                qu.question_text,
                qu.marks,
                o.id AS option_id,
                o.option_text
             FROM questions qu
             JOIN options o ON qu.id = o.question_id
             WHERE qu.quiz_id = ?
             ORDER BY qu.id, o.id`,
            [quizId]
        );

        // Group options under their respective questions
        const questions = [];

        for (const row of rows) {
            let question = questions.find(
                item => item.id === row.question_id
            );

            if (!question) {
                question = {
                    id: row.question_id,
                    question: row.question_text,
                    marks: row.marks,
                    options: []
                };

                questions.push(question);
            }

            question.options.push({
                id: row.option_id,
                text: row.option_text
            });
        }

        res.json({
            quiz: {
                ...quizzes[0],
                questions
            }
        });
    } catch (error) {
        console.error('Quiz details error:', error.message);
        res.status(500).json({
            message: 'Could not retrieve quiz.'
        });
    }
});

//attempts

router.post('/quizzes/:id/attempts', requireAuth, async (req, res) => {
    let connection;

    try {
        const quizId = Number(req.params.id);

        if (!Number.isInteger(quizId) || quizId <= 0) {
            return res.status(400).json({ message: 'Invalid quiz ID.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [quizzes] = await connection.execute(
            `SELECT id, title, duration_minutes
             FROM quizzes
             WHERE id = ? AND is_published = TRUE
             FOR SHARE`,
            [quizId]
        );

        if (quizzes.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Quiz not found.' });
        }

        const quiz = quizzes[0];

        const [questions] = await connection.execute(
            `SELECT id, question_text, marks
             FROM questions
             WHERE quiz_id = ?
             ORDER BY id`,
            [quizId]
        );

        if (questions.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                message: 'This quiz has no questions.'
            });
        }

        const totalMarks = questions.reduce(
            (sum, question) => sum + question.marks,
            0
        );

        const [result] = await connection.execute(
            `INSERT INTO attempts
                (user_id, quiz_id, expires_at, total_marks)
             VALUES (
                ?, ?,
                DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE),
                ?
             )`,
            [req.session.user.id, quizId, quiz.duration_minutes, totalMarks]
        );

        const [expiry] = await connection.execute(
            `SELECT DATE_FORMAT(
                expires_at, '%Y-%m-%dT%H:%i:%sZ'
             ) AS expires_at
             FROM attempts
             WHERE id = ?`,
            [result.insertId]
        );

        const [options] = await connection.execute(
            `SELECT
                o.id AS option_id,
                o.question_id,
                o.option_text
             FROM options o
             JOIN questions q ON q.id = o.question_id
             WHERE q.quiz_id = ?
             ORDER BY q.id, o.id`,
            [quizId]
        );

        const questionsWithOptions = questions.map(question => ({
            id: question.id,
            question: question.question_text,
            marks: question.marks,
            options: options
                .filter(option => option.question_id === question.id)
                .map(option => ({
                    id: option.option_id,
                    text: option.option_text
                }))
        }));

        await connection.commit();

        res.status(201).json({
            message: 'Quiz attempt started.',
            attempt: {
                id: result.insertId,
                quiz: quiz.title,
                durationMinutes: quiz.duration_minutes,
                expiresAt: expiry[0].expires_at,
                questions: questionsWithOptions
            }
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error('Start attempt error:', error.message);
        res.status(500).json({ message: 'Could not start quiz.' });
    } finally {
        if (connection) connection.release();
    }
});


//

router.put('/attempts/:id/answers', requireAuth, async (req, res) => {
    let connection;

    try {
        const attemptId = Number(req.params.id);
        const { questionId, optionId } = req.body;

        if (
            !Number.isInteger(attemptId) || attemptId <= 0 ||
            !Number.isInteger(questionId) || questionId <= 0 ||
            !Number.isInteger(optionId) || optionId <= 0
        ) {
            return res.status(400).json({ message: 'Invalid input.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [attempts] = await connection.execute(
            `SELECT id, quiz_id, expires_at, status
             FROM attempts
             WHERE id = ? AND user_id = ?
             FOR UPDATE`,
            [attemptId, req.session.user.id]
        );

        if (attempts.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Attempt not found.' });
        }

        const attempt = attempts[0];

        if (attempt.status !== 'in_progress') {
            await connection.rollback();
            return res.status(409).json({
                message: 'This attempt is no longer active.'
            });
        }

        const [time] = await connection.execute(
            'SELECT UTC_TIMESTAMP() >= ? AS expired',
            [attempt.expires_at]
        );

        if (time[0].expired) {
            await connection.execute(
                `UPDATE attempts SET status = 'expired'
                 WHERE id = ?`,
                [attemptId]
            );

            await connection.commit();
            return res.status(409).json({
                message: 'Time is up. This attempt has expired.'
            });
        }

        // Ensure the question belongs to this quiz and the option
        // belongs to that exact question.
        const [validOptions] = await connection.execute(
            `SELECT o.id
             FROM questions q
             JOIN options o ON o.question_id = q.id
             WHERE q.id = ?
               AND q.quiz_id = ?
               AND o.id = ?`,
            [questionId, attempt.quiz_id, optionId]
        );

        if (validOptions.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Invalid question or option.'
            });
        }

        await connection.execute(
            `INSERT INTO attempt_answers
                (attempt_id, question_id, selected_option_id)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                selected_option_id = VALUES(selected_option_id),
                answered_at = CURRENT_TIMESTAMP`,
            [attemptId, questionId, optionId]
        );

        await connection.commit();

        res.json({ message: 'Answer saved.' });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error('Save answer error:', error.message);
        res.status(500).json({ message: 'Could not save answer.' });
    } finally {
        if (connection) connection.release();
    }
});


router.post('/attempts/:id/submit', requireAuth, async (req, res) => {
    let connection;

    try {
        const attemptId = Number(req.params.id);

        if (!Number.isInteger(attemptId) || attemptId <= 0) {
            return res.status(400).json({ message: 'Invalid attempt ID.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [attempts] = await connection.execute(
            `SELECT id, quiz_id, expires_at, status, total_marks
             FROM attempts
             WHERE id = ? AND user_id = ?
             FOR UPDATE`,
            [attemptId, req.session.user.id]
        );

        if (attempts.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Attempt not found.' });
        }

        const attempt = attempts[0];

        if (attempt.status !== 'in_progress') {
            await connection.rollback();
            return res.status(409).json({
                message: 'This attempt has already ended.'
            });
        }

        const [time] = await connection.execute(
            'SELECT UTC_TIMESTAMP() >= ? AS expired',
            [attempt.expires_at]
        );

        const status = time[0].expired ? 'expired' : 'submitted';

        // Calculate marks using the correct answers in the database.
        const [scores] = await connection.execute(
            `SELECT COALESCE(SUM(q.marks), 0) AS score
             FROM attempt_answers aa
             JOIN questions q ON q.id = aa.question_id
             JOIN options o
               ON o.id = aa.selected_option_id
              AND o.question_id = aa.question_id
             WHERE aa.attempt_id = ?
               AND o.is_correct = TRUE`,
            [attemptId]
        );

        const score = scores[0].score;

        await connection.execute(
            `UPDATE attempts
             SET score = ?,
                 status = ?,
                 submitted_at = UTC_TIMESTAMP()
             WHERE id = ?`,
            [score, status, attemptId]
        );

        await connection.commit();

        res.json({
            message: status === 'expired'
                ? 'Time expired. Your answers have been evaluated.'
                : 'Quiz submitted successfully.',
            result: {
                attemptId,
                score,
                totalMarks: attempt.total_marks,
                status
            }
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error('Submit attempt error:', error.message);
        res.status(500).json({ message: 'Could not submit quiz.' });
    } finally {
        if (connection) connection.release();
    }
});

// Get detailed result and answer review
router.get('/attempts/:id/result', requireAuth, async (req, res) => {
    try {
        const attemptId = Number(req.params.id);

        if (!Number.isInteger(attemptId) || attemptId <= 0) {
            return res.status(400).json({ message: 'Invalid attempt ID.' });
        }

        // Verify ownership and completion
        const [attempts] = await pool.execute(
            `SELECT
                a.id,
                a.status,
                a.score,
                a.total_marks,
                a.started_at,
                a.submitted_at,
                q.title AS quiz_title
             FROM attempts a
             JOIN quizzes q ON q.id = a.quiz_id
             WHERE a.id = ? AND a.user_id = ?`,
            [attemptId, req.session.user.id]
        );

        if (attempts.length === 0) {
            return res.status(404).json({ message: 'Attempt not found.' });
        }

        const attempt = attempts[0];

        if (!['submitted', 'expired'].includes(attempt.status)) {
            return res.status(409).json({
                message: 'This quiz has not been submitted yet.'
            });
        }

        // Retrieve each question, selected answer and correct answer
        const [rows] = await pool.execute(
            `SELECT
                q.id AS question_id,
                q.question_text,
                q.marks,
                selected.option_text AS selected_answer,
                correct.option_text AS correct_answer,
                CASE
                    WHEN selected.is_correct = TRUE THEN TRUE
                    ELSE FALSE
                END AS is_correct
             FROM questions q
             LEFT JOIN attempt_answers aa
                ON aa.question_id = q.id
               AND aa.attempt_id = ?
             LEFT JOIN options selected
                ON selected.id = aa.selected_option_id
               AND selected.question_id = q.id
             LEFT JOIN options correct
                ON correct.question_id = q.id
               AND correct.is_correct = TRUE
             WHERE q.quiz_id = (
                SELECT quiz_id FROM attempts WHERE id = ?
             )
             ORDER BY q.id`,
            [attemptId, attemptId]
        );

        const correctCount = rows.filter(row => row.is_correct).length;
        const answeredCount = rows.filter(
            row => row.selected_answer !== null
        ).length;

        const totalQuestions = rows.length;
        const incorrectCount = answeredCount - correctCount;
        const unansweredCount = totalQuestions - answeredCount;

        const totalMarks = Number(attempt.total_marks);
        const score = Number(attempt.score);

        res.json({
            result: {
                attemptId: attempt.id,
                quizTitle: attempt.quiz_title,
                status: attempt.status,
                score,
                totalMarks,
                accuracy: totalMarks > 0
                    ? Number((score / totalMarks * 100).toFixed(2))
                    : 0,
                correctCount,
                incorrectCount,
                unansweredCount,
                totalQuestions,
                startedAt: attempt.started_at,
                submittedAt: attempt.submitted_at,
                review: rows.map(row => ({
                    questionId: row.question_id,
                    question: row.question_text,
                    marks: row.marks,
                    selectedAnswer: row.selected_answer,
                    correctAnswer: row.correct_answer,
                    isCorrect: Boolean(row.is_correct)
                }))
            }
        });
    } catch (error) {
        console.error('Result retrieval error:', error.message);
        res.status(500).json({
            message: 'Could not retrieve result.'
        });
    }
});

// Get current user's quiz history
router.get('/users/me/attempts', requireAuth, async (req, res) => {
    try {
        const [attempts] = await pool.execute(
            `SELECT
                a.id AS attempt_id,
                q.id AS quiz_id,
                q.title AS quiz_title,
                c.name AS category,
                a.score,
                a.total_marks,
                a.status,
                a.started_at,
                a.submitted_at
             FROM attempts a
             JOIN quizzes q ON q.id = a.quiz_id
             JOIN categories c ON c.id = q.category_id
             WHERE a.user_id = ?
             ORDER BY a.started_at DESC
             LIMIT 20`,
            [req.session.user.id]
        );

        res.json({ attempts });
    } catch (error) {
        console.error('Attempt history error:', error.message);
        res.status(500).json({
            message: 'Could not retrieve attempt history.'
        });
    }
});

// Get categories
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await pool.execute(
            `SELECT id, name, description
             FROM categories
             ORDER BY name`
        );

        res.json({ categories });
    } catch (error) {
        console.error('Category retrieval error:', error.message);
        res.status(500).json({
            message: 'Could not retrieve categories.'
        });
    }
});

// Create quiz
router.post('/admin/quizzes', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const { title, description, categoryId, durationMinutes } = req.body;

        if (
            typeof title !== 'string' ||
            !title.trim() ||
            title.trim().length > 200 ||
            !Number.isInteger(categoryId) ||
            categoryId <= 0 ||
            !Number.isInteger(durationMinutes) ||
            durationMinutes < 1 ||
            durationMinutes > 600 ||
            (description !== undefined && description !== null &&
                typeof description !== 'string')
        ) {
            return res.status(400).json({
                message: 'Invalid quiz details.'
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO quizzes
(category_id, created_by, title, description, duration_minutes, is_published)
VALUES (?, ?, ?, ?, ?, TRUE)`,
            [
                categoryId,
                req.session.user.id,
                title.trim(),
                description?.trim() || null,
                durationMinutes
            ]
        );

        res.status(201).json({
            message: 'Quiz created.',
            quizId: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                message: 'Selected category does not exist.'
            });
        }

        console.error('Quiz creation error:', error.message);
        res.status(500).json({
            message: 'Could not create quiz.'
        });
    }
});

// Add a question with its options
router.post(
    '/admin/quizzes/:id/questions',
    requireAuth,
    requireRole('admin'),
    async (req, res) => {
        let connection;

        try {
            const quizId = Number(req.params.id);
            const { question, marks, options } = req.body;

            if (
                !Number.isInteger(quizId) || quizId <= 0 ||
                typeof question !== 'string' || !question.trim() ||
                !Number.isInteger(marks) || marks < 1 || marks > 100 ||
                !Array.isArray(options) ||
                options.length < 2 || options.length > 10 ||
                options.some(option =>
                    typeof option.text !== 'string' ||
                    !option.text.trim() ||
                    option.text.length > 500 ||
                    typeof option.isCorrect !== 'boolean'
                ) ||
                options.filter(option => option.isCorrect).length !== 1
            ) {
                return res.status(400).json({
                    message: 'Invalid question or options.'
                });
            }

            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [quizzes] = await connection.execute(
                `SELECT id, is_published
                 FROM quizzes
                 WHERE id = ?
                 FOR UPDATE`,
                [quizId]
            );

            if (quizzes.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    message: 'Quiz not found.'
                });
            }

            if (quizzes[0].is_published) {
                await connection.rollback();
                return res.status(409).json({
                    message: 'Unpublish the quiz before editing it.'
                });
            }

            const [result] = await connection.execute(
                `INSERT INTO questions (quiz_id, question_text, marks)
                 VALUES (?, ?, ?)`,
                [quizId, question.trim(), marks]
            );

            const questionId = result.insertId;

            for (const option of options) {
                await connection.execute(
                    `INSERT INTO options
                        (question_id, option_text, is_correct)
                     VALUES (?, ?, ?)`,
                    [questionId, option.text.trim(), option.isCorrect]
                );
            }

            await connection.commit();

            res.status(201).json({
                message: 'Question added successfully.',
                questionId
            });
        } catch (error) {
            if (connection) await connection.rollback();

            console.error('Question creation error:', error.message);
            res.status(500).json({
                message: 'Could not add question.'
            });
        } finally {
            if (connection) connection.release();
        }
    }
);

// Publish quiz
router.patch(
    '/admin/quizzes/:id/publish',
    requireAuth,
    requireRole('admin'),
    async (req, res) => {
        let connection;

        try {
            const quizId = Number(req.params.id);

            if (!Number.isInteger(quizId) || quizId <= 0) {
                return res.status(400).json({
                    message: 'Invalid quiz ID.'
                });
            }

            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [quizzes] = await connection.execute(
                `SELECT id, is_published
                 FROM quizzes
                 WHERE id = ?
                 FOR UPDATE`,
                [quizId]
            );

            if (quizzes.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    message: 'Quiz not found.'
                });
            }

            const [questions] = await connection.execute(
                `SELECT
                    q.id,
                    COUNT(o.id) AS option_count,
                    SUM(o.is_correct = TRUE) AS correct_count
                 FROM questions q
                 LEFT JOIN options o ON o.question_id = q.id
                 WHERE q.quiz_id = ?
                 GROUP BY q.id`,
                [quizId]
            );

            if (
                questions.length === 0 ||
                questions.some(q =>
                    Number(q.option_count) < 2 ||
                    Number(q.correct_count) !== 1
                )
            ) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Every question needs at least two options and exactly one correct answer.'
                });
            }

            await connection.execute(
                `UPDATE quizzes
                 SET is_published = TRUE
                 WHERE id = ?`,
                [quizId]
            );

            await connection.commit();

            res.json({ message: 'Quiz published successfully.' });
        } catch (error) {
            if (connection) await connection.rollback();

            console.error('Quiz publishing error:', error.message);
            res.status(500).json({
                message: 'Could not publish quiz.'
            });
        } finally {
            if (connection) connection.release();
        }
    }
);

router.get(
    '/admin/quizzes',
    requireAuth,
    requireRole('admin'),
    async (req, res) => {
        try {
            const [quizzes] = await pool.execute(
                `SELECT
                    q.id,
                    q.title,
                    q.description,
                    q.duration_minutes,
                    q.is_published,
                    c.name AS category,
                    COUNT(DISTINCT qu.id) AS question_count
                 FROM quizzes q
                 JOIN categories c ON c.id = q.category_id
                 LEFT JOIN questions qu ON qu.quiz_id = q.id
                 GROUP BY q.id, c.name
                 ORDER BY q.id DESC`
            );

            res.json({ quizzes });
        } catch (error) {
            console.error('Admin quiz listing error:', error.message);
            res.status(500).json({
                message: 'Could not retrieve quizzes.'
            });
        }
    }
);

router.get('/users/me/dashboard', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const [statsRows] = await pool.query(
            `SELECT
                COUNT(*) AS attempted,
                ROUND(AVG(
                    CASE
                        WHEN total_marks > 0
                        THEN (score / total_marks) * 100
                    END
                ), 1) AS average_score,
                ROUND(MAX(
                    CASE
                        WHEN total_marks > 0
                        THEN (score / total_marks) * 100
                    END
                ), 1) AS best_score
             FROM attempts
             WHERE user_id = ?
               AND status IN ('submitted', 'expired')`,
            [userId]
        );

        const [recentAttempts] = await pool.query(
            `SELECT
                a.id,
                q.title AS quiz_title,
                c.name AS category,
                a.started_at,
                a.submitted_at,
                a.status,
                a.score,
                a.total_marks,
                ROUND(
                    CASE
                        WHEN a.total_marks > 0
                        THEN (a.score / a.total_marks) * 100
                        ELSE 0
                    END
                ) AS score_percentage
             FROM attempts a
             JOIN quizzes q ON q.id = a.quiz_id
             JOIN categories c ON c.id = q.category_id
             WHERE a.user_id = ?
               AND a.status IN ('submitted', 'expired')
             ORDER BY a.submitted_at DESC
             LIMIT 5`,
            [userId]
        );

        const [recommendedQuizzes] = await pool.query(
            `SELECT
                q.id,
                q.title,
                q.description,
                c.name AS category,
                q.duration_minutes,
                COUNT(DISTINCT qu.id) AS question_count
             FROM quizzes q
             JOIN categories c ON c.id = q.category_id
             LEFT JOIN questions qu ON qu.quiz_id = q.id
             WHERE q.is_published = TRUE
             GROUP BY q.id
             ORDER BY q.id DESC
             LIMIT 3`
        );

        res.json({
            user: {
                name: req.session.user.name
            },
            stats: statsRows[0],
            recentAttempts,
            recommendedQuizzes
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            message: 'Unable to load dashboard.'
        });
    }
});

router.get(
    '/admin/dashboard',
    requireAuth,
    requireRole('admin'),
    async (req, res) => {
        try {
            const [
                [quizRows],
                [questionRows],
                [userRows],
                [attemptRows],
                [recentQuizzes]
            ] = await Promise.all([
                db.query(
                    'SELECT COUNT(*) AS total FROM quizzes'
                ),

                db.query(
                    'SELECT COUNT(*) AS total FROM questions'
                ),

                db.query(
                    "SELECT COUNT(*) AS total FROM users WHERE role = 'user'"
                ),

                db.query(
                    'SELECT COUNT(*) AS total FROM attempts'
                ),

                db.query(
                    `SELECT
                        q.id,
                        q.title,
                        c.name AS category,
                        q.is_published,
                        COUNT(DISTINCT qu.id) AS question_count
                     FROM quizzes q
                     JOIN categories c ON c.id = q.category_id
                     LEFT JOIN questions qu ON qu.quiz_id = q.id
                     GROUP BY q.id, q.title, c.name, q.is_published
                     ORDER BY q.id DESC
                     LIMIT 5`
                )
            ]);

            res.json({
                admin: {
                    name: req.session.user.name
                },
                stats: {
                    totalQuizzes: quizRows[0].total,
                    totalQuestions: questionRows[0].total,
                    totalUsers: userRows[0].total,
                    totalAttempts: attemptRows[0].total
                },
                recentQuizzes
            });

        } catch (error) {
            console.error('Admin dashboard error:', error);

            res.status(500).json({
                message: 'Unable to load admin dashboard.'
            });
        }
    }
);

module.exports = router;
