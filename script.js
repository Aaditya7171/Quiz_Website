// Global variables
let categories = [];
let questions = [];
let currentQuestionIndex = 0;
let selectedDifficulty = '';
let score = 0;
let timeLeft = 30;
let timer;
let timeBonus = 0;
let userAnswers = [];
let sessionToken = '';

// DOM Elements
const landingPage = document.getElementById('landing-page');
const quizPage = document.getElementById('quiz-page');
const resultsPage = document.getElementById('results-page');
const loadingOverlay = document.getElementById('loading-overlay');

const categorySelect = document.getElementById('category');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');
const amountInput = document.getElementById('amount');
const amountValue = document.getElementById('amount-value');
const startBtn = document.getElementById('start-btn');

const currentQuestionEl = document.getElementById('current-question');
const totalQuestionsEl = document.getElementById('total-questions');
const progressFill = document.querySelector('.progress-fill');
const timerText = document.querySelector('.timer-text');
const timerFill = document.querySelector('.timer-fill');
const scoreText = document.querySelector('.score-text');
const questionText = document.querySelector('.question-text');
const optionsContainer = document.querySelector('.options-container');
const nextBtn = document.getElementById('next-btn');

const finalScoreValue = document.querySelector('.score-value');
const correctAnswersEl = document.querySelector('.correct-answers');
const timeBonusEl = document.querySelector('.time-bonus');
const reviewBtn = document.getElementById('review-btn');
const restartBtn = document.getElementById('restart-btn');
const answersReview = document.querySelector('.answers-review');
const reviewList = document.querySelector('.review-list');
const closeReviewBtn = document.getElementById('close-review-btn');

// Initialize the app
document.addEventListener('DOMContentLoaded', init);

async function init() {
    showLoading();

    // Get session token
    await getSessionToken();

    // Fetch categories from API
    await fetchCategories();

    // Set up event listeners
    amountInput.addEventListener('input', updateAmountValue);
    difficultyBtns.forEach(btn => {
        btn.addEventListener('click', selectDifficulty);
    });

    startBtn.addEventListener('click', startQuiz);
    nextBtn.addEventListener('click', goToNextQuestion);
    reviewBtn.addEventListener('click', showAnswersReview);
    closeReviewBtn.addEventListener('click', hideAnswersReview);
    restartBtn.addEventListener('click', resetQuiz);

    // Initialize amount value display
    updateAmountValue();

    // Load preferences
    loadPreferences();

    hideLoading();
}

// Get session token from API
async function getSessionToken() {
    try {
        const response = await fetch('https://opentdb.com/api_token.php?command=request');
        const data = await response.json();

        if (data.response_code === 0) {
            sessionToken = data.token;
            console.log('Session token obtained:', sessionToken);
        } else {
            console.error('Failed to get session token:', data);
        }
    } catch (error) {
        console.error('Error getting session token:', error);
    }
}

// Fetch categories from the Open Trivia DB API
async function fetchCategories() {
    try {
        const response = await fetch('https://opentdb.com/api_category.php');
        const data = await response.json();

        if (data.trivia_categories && data.trivia_categories.length > 0) {
            categories = data.trivia_categories;

            // Clear existing options
            categorySelect.innerHTML = '<option value="">Any Category</option>';

            // Populate category dropdown
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });

            console.log('Categories loaded:', categories.length);
        } else {
            throw new Error('No categories returned from API');
        }
    } catch (error) {
        console.error('Error fetching categories:', error);
        alert('Failed to load categories. Please refresh the page.');
    }
}

// Update the amount value display
function updateAmountValue() {
    amountValue.textContent = amountInput.value;
}

// Handle difficulty button selection
function selectDifficulty(e) {
    difficultyBtns.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    selectedDifficulty = e.target.dataset.difficulty;
}

// Start the quiz
async function startQuiz() {
    const amount = amountInput.value;
    const categoryId = categorySelect.value;

    // Construct API URL
    let apiUrl = `https://opentdb.com/api.php?amount=${amount}`;

    if (categoryId) {
        apiUrl += `&category=${categoryId}`;
    }

    if (selectedDifficulty) {
        apiUrl += `&difficulty=${selectedDifficulty}`;
    }

    // Add session token if available
    if (sessionToken) {
        apiUrl += `&token=${sessionToken}`;
    }

    console.log('API URL:', apiUrl);

    try {
        showLoading();
        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log('API Response:', data);

        if (data.response_code === 0) {
            questions = data.results;
            currentQuestionIndex = 0;
            score = 0;
            timeBonus = 0;
            userAnswers = [];

            // Update UI
            totalQuestionsEl.textContent = questions.length;
            scoreText.textContent = score;

            // Show quiz page
            showPage(quizPage);

            // Load first question
            loadQuestion();
        } else if (data.response_code === 4) {
            // Token empty, reset token and try again
            await resetSessionToken();
            startQuiz();
        } else {
            throw new Error(`API Error: Response code ${data.response_code}`);
        }

        hideLoading();
    } catch (error) {
        console.error('Error starting quiz:', error);
        hideLoading();
        alert('Failed to load quiz questions. Please try again.');
    }
}

// Reset session token
async function resetSessionToken() {
    try {
        const response = await fetch(`https://opentdb.com/api_token.php?command=reset&token=${sessionToken}`);
        const data = await response.json();

        if (data.response_code === 0) {
            console.log('Session token reset successfully');
        } else {
            // Get a new token instead
            await getSessionToken();
        }
    } catch (error) {
        console.error('Error resetting session token:', error);
        await getSessionToken();
    }
}

// Load the current question
function loadQuestion() {
    if (!questions || questions.length === 0 || currentQuestionIndex >= questions.length) {
        console.error('No questions available or index out of bounds');
        alert('Error loading question. Please restart the quiz.');
        resetQuiz();
        return;
    }

    const question = questions[currentQuestionIndex];
    console.log('Loading question:', question);

    // Update progress
    currentQuestionEl.textContent = currentQuestionIndex + 1;
    progressFill.style.width = `${((currentQuestionIndex + 1) / questions.length) * 100}%`;

    // Set question text
    questionText.innerHTML = decodeHTML(question.question);

    // Clear previous options
    optionsContainer.innerHTML = '';

    // Create an array with all answers
    const answers = [...question.incorrect_answers, question.correct_answer];

    // Shuffle answers
    const shuffledAnswers = shuffleArray(answers);

    // Add options to the container
    shuffledAnswers.forEach(answer => {
        const option = document.createElement('div');
        option.className = 'option';
        option.innerHTML = decodeHTML(answer);
        option.addEventListener('click', () => selectOption(option, answer, question.correct_answer));
        optionsContainer.appendChild(option);
    });

    // Reset and start timer
    resetTimer();
    startTimer();

    // Hide next button initially
    nextBtn.style.display = 'none';
}

// Handle option selection
function selectOption(optionElement, selectedAnswer, correctAnswer) {
    // Prevent selecting another option if one is already selected
    if (document.querySelector('.option.selected')) {
        return;
    }

    // Stop the timer
    clearInterval(timer);

    // Mark selected option
    optionElement.classList.add('selected');

    // Calculate time bonus for correct answer
    const currentTimeBonus = timeLeft > 0 ? timeLeft : 0;

    // Check if answer is correct
    const isCorrect = selectedAnswer === correctAnswer;

    // Store user's answer
    userAnswers.push({
        question: questions[currentQuestionIndex].question,
        userAnswer: selectedAnswer,
        correctAnswer: correctAnswer,
        isCorrect: isCorrect
    });

    // Update UI based on correctness
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        const optionAnswer = option.innerHTML;

        // Add feedback icon
        const feedbackIcon = document.createElement('span');
        feedbackIcon.className = 'option-feedback';

        if (decodeHTML(optionAnswer) === decodeHTML(correctAnswer)) {
            option.classList.add('correct');
            feedbackIcon.innerHTML = '<i class="fas fa-check"></i>';
            option.appendChild(feedbackIcon);
        } else if (option === optionElement && !isCorrect) {
            option.classList.add('incorrect');
            feedbackIcon.innerHTML = '<i class="fas fa-times"></i>';
            option.appendChild(feedbackIcon);
        }
    });

    // Update score if correct
    if (isCorrect) {
        score += 10;
        timeBonus += currentTimeBonus;
        scoreText.textContent = score + timeBonus;
    }

    // Show next button
    nextBtn.style.display = 'block';
}

// Go to the next question or end the quiz
function goToNextQuestion() {
    currentQuestionIndex++;

    if (currentQuestionIndex < questions.length) {
        loadQuestion();
    } else {
        endQuiz();
    }
}

// End the quiz and show results
function endQuiz() {
    // Calculate final score
    const finalScore = score + timeBonus;

    // Update results page
    finalScoreValue.textContent = finalScore;
    correctAnswersEl.textContent = `${userAnswers.filter(a => a.isCorrect).length}/${questions.length}`;
    timeBonusEl.textContent = timeBonus;

    // Show results page
    showPage(resultsPage);
}

// Show answers review
function showAnswersReview() {
    // Clear previous review items
    reviewList.innerHTML = '';

    // Add review items for each question
    userAnswers.forEach((answer, index) => {
        const reviewItem = document.createElement('div');
        reviewItem.className = `review-item ${answer.isCorrect ? 'correct' : 'incorrect'}`;

        const questionNumber = document.createElement('div');
        questionNumber.className = 'review-question-number';
        questionNumber.textContent = `Question ${index + 1}`;

        const questionText = document.createElement('div');
        questionText.className = 'review-question';
        questionText.innerHTML = decodeHTML(answer.question);

        const answersContainer = document.createElement('div');
        answersContainer.className = 'review-answers';

        // User's answer
        const userAnswerEl = document.createElement('div');
        userAnswerEl.className = `review-answer user-answer ${answer.isCorrect ? 'correct-answer' : ''}`;
        userAnswerEl.innerHTML = `
            <i class="fas ${answer.isCorrect ? 'fa-check' : 'fa-times'}"></i>
            <span>Your answer: ${decodeHTML(answer.userAnswer)}</span>
        `;

        answersContainer.appendChild(userAnswerEl);

        // Correct answer (if user was wrong)
        if (!answer.isCorrect) {
            const correctAnswerEl = document.createElement('div');
            correctAnswerEl.className = 'review-answer correct-answer';
            correctAnswerEl.innerHTML = `
                <i class="fas fa-check"></i>
                <span>Correct answer: ${decodeHTML(answer.correctAnswer)}</span>
            `;
            answersContainer.appendChild(correctAnswerEl);
        }

        reviewItem.appendChild(questionNumber);
        reviewItem.appendChild(questionText);
        reviewItem.appendChild(answersContainer);

        reviewList.appendChild(reviewItem);
    });

    // Show review section
    answersReview.classList.remove('hidden');
}

// Hide answers review
function hideAnswersReview() {
    answersReview.classList.add('hidden');
}

// Reset quiz to start again
function resetQuiz() {
    showPage(landingPage);
}

// Timer functions
function startTimer() {
    timeLeft = 30;
    timerText.textContent = timeLeft;
    timerFill.style.width = '100%';

    timer = setInterval(() => {
        timeLeft--;
        timerText.textContent = timeLeft;
        timerFill.style.width = `${(timeLeft / 30) * 100}%`;

        if (timeLeft <= 0) {
            clearInterval(timer);

            // Auto-select wrong answer if time runs out
            const correctAnswer = questions[currentQuestionIndex].correct_answer;
            userAnswers.push({
                question: questions[currentQuestionIndex].question,
                userAnswer: 'Time expired',
                correctAnswer: correctAnswer,
                isCorrect: false
            });

            // Show correct answer
            const options = document.querySelectorAll('.option');
            options.forEach(option => {
                if (decodeHTML(option.innerHTML) === decodeHTML(correctAnswer)) {
                    option.classList.add('correct');
                    const feedbackIcon = document.createElement('span');
                    feedbackIcon.className = 'option-feedback';
                    feedbackIcon.innerHTML = '<i class="fas fa-check"></i>';
                    option.appendChild(feedbackIcon);
                }
            });

            // Show next button
            nextBtn.style.display = 'block';
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timer);
    timeLeft = 30;
    timerText.textContent = timeLeft;
    timerFill.style.width = '100%';
}

// Utility functions
function showPage(page) {
    // Hide all pages
    landingPage.classList.remove('active');
    quizPage.classList.remove('active');
    resultsPage.classList.remove('active');

    // Show the requested page
    page.classList.add('active');
}

function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

function decodeHTML(html) {
    if (!html) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

function shuffleArray(array) {
    if (!array || !Array.isArray(array)) return [];

    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Social sharing functionality
document.querySelector('.twitter').addEventListener('click', () => {
    const text = `I scored ${score + timeBonus} points on QuizMaster! Can you beat my score?`;
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`, '_blank');
});

document.querySelector('.facebook').addEventListener('click', () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
});

document.querySelector('.whatsapp').addEventListener('click', () => {
    const text = `I scored ${score + timeBonus} points on QuizMaster! Can you beat my score?`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + window.location.href)}`, '_blank');
});

// Add local storage for saving preferences
function savePreferences() {
    const preferences = {
        category: categorySelect.value,
        difficulty: selectedDifficulty,
        amount: amountInput.value
    };

    localStorage.setItem('quizPreferences', JSON.stringify(preferences));
}

function loadPreferences() {
    const savedPreferences = localStorage.getItem('quizPreferences');

    if (savedPreferences) {
        try {
            const preferences = JSON.parse(savedPreferences);

            if (preferences.category) {
                categorySelect.value = preferences.category;
            }

            if (preferences.difficulty) {
                difficultyBtns.forEach(btn => {
                    if (btn.dataset.difficulty === preferences.difficulty) {
                        btn.click();
                    }
                });
            }

            if (preferences.amount) {
                amountInput.value = preferences.amount;
                updateAmountValue();
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
            localStorage.removeItem('quizPreferences');
        }
    }
}

// Save preferences when starting quiz
startBtn.addEventListener('click', savePreferences);

// Add error handling for API requests
window.addEventListener('error', function (event) {
    console.error('Global error caught:', event.error);
    hideLoading();
    alert('An error occurred. Please refresh the page and try again.');
});

// Add console logging for debugging
console.log('Quiz application initialized');

