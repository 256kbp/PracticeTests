const TARGET_MARKS = 20;
let currentTestQuestions = [];

// Difficulty rank order for sorting easy -> hard
const DIFFICULTY_ORDER = {
  'Easy': 1,
  'Medium': 2,
  'Hard': 3
};

document.getElementById('generateBtn').addEventListener('click', generateTest);
document.getElementById('submitBtn').addEventListener('click', submitTest);

window.addEventListener('DOMContentLoaded', generateTest);

async function fetchQuestions() {
  try {
    const response = await fetch('questions.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Could not load questions:', error);
    alert('Error loading question bank. Make sure questions.json is served properly.');
    return [];
  }
}

async function generateTest() {
  const allQuestions = await fetchQuestions();
  if (allQuestions.length === 0) return;

  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());

  currentTestQuestions = [];
  let currentMarks = 0;

  for (const q of shuffled) {
    // Avoid precision drift when accumulating decimal marks (e.g. 0.5)
    if (Math.round((currentMarks + q.marks) * 100) / 100 <= TARGET_MARKS) {
      currentTestQuestions.push(q);
      currentMarks = Math.round((currentMarks + q.marks) * 100) / 100;
    }
    if (currentMarks === TARGET_MARKS) break;
  }

  // Sort selected questions from easiest to hardest
  currentTestQuestions.sort((a, b) => {
    const diffA = DIFFICULTY_ORDER[a.difficulty] || 2;
    const diffB = DIFFICULTY_ORDER[b.difficulty] || 2;
    if (diffA !== diffB) return diffA - diffB;
    return a.marks - b.marks; // Sub-sort by marks if difficulty is equal
  });

  // Hide results banner and re-enable submit button
  document.getElementById('resultsBanner').classList.add('hidden');
  document.getElementById('submitBtn').disabled = false;

  renderTest(currentTestQuestions, currentMarks);
}

function renderTest(questions, totalMarks) {
  const container = document.getElementById('quizContainer');
  document.getElementById('totalMarks').textContent = totalMarks;
  container.innerHTML = '';

  if (questions.length === 0) {
    container.innerHTML = '<p>No questions could be selected to reach 20 marks.</p>';
    return;
  }

  questions.forEach((q, index) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `question-${q.id}`;

    let inputHtml = '';

    // Treat both MCQ and True/False questions as radio-button options
    const isMultipleChoice = (q.type === 'MCQ' || q.type === 'True/False') && q.options && q.options.length > 0;

    if (isMultipleChoice) {
      inputHtml = `
        <ul class="options-list">
          ${q.options.map((opt) => `
            <li>
              <label>
                <input type="radio" name="q_${q.id}" value="${opt}">
                <span>${opt}</span>
              </label>
            </li>
          `).join('')}
        </ul>
      `;
    } else {
      // Short Form and Long Form text inputs
      inputHtml = `
        <textarea name="q_${q.id}" class="text-answer-input" placeholder="Type your answer here..."></textarea>
      `;
    }

    const marksLabel = q.marks === 1 ? '1 Mark' : `${q.marks} Marks`;

    card.innerHTML = `
      <div class="question-meta">
        <span class="badge">Q${index + 1}</span>
        <span class="badge">Chapter ${q.chapter}</span>
        <span class="badge">${q.difficulty}</span>
        <span class="badge">${q.type}</span>
        <span class="badge" style="margin-left: auto;"><strong>${marksLabel}</strong></span>
      </div>
      <div class="question-text">${q.question}</div>
      ${inputHtml}
      <div id="feedback_${q.id}" class="feedback-box hidden"></div>
    `;

    container.appendChild(card);
  });
}

function submitTest() {
  let earnedMarks = 0;
  const totalPossible = currentTestQuestions.reduce((sum, q) => sum + q.marks, 0);

  currentTestQuestions.forEach((q) => {
    const feedbackBox = document.getElementById(`feedback_${q.id}`);
    feedbackBox.classList.remove('hidden', 'feedback-correct', 'feedback-incorrect');

    const isMultipleChoice = q.type === 'MCQ' || q.type === 'True/False';

    if (isMultipleChoice) {
      const selectedOption = document.querySelector(`input[name="q_${q.id}"]:checked`);
      const userAnswer = selectedOption ? selectedOption.value : null;

      if (userAnswer === q.answer) {
        earnedMarks += q.marks;
        feedbackBox.classList.add('feedback-correct');
        feedbackBox.innerHTML = `<strong>Correct! (+${q.marks} marks)</strong><br>${q.explanation}`;
      } else {
        feedbackBox.classList.add('feedback-incorrect');
        feedbackBox.innerHTML = `
          <strong>Incorrect (0/${q.marks} marks)</strong><br>
          <strong>Correct Answer:</strong> ${q.answer}<br>
          <strong>Explanation:</strong> ${q.explanation}
        `;
      }
    } else {
      // Short Form & Long Form (Self-evaluation / Model answer reference)
      feedbackBox.classList.add('feedback-correct');
      feedbackBox.innerHTML = `
        <strong>Model Answer:</strong> ${q.answer}<br>
        <strong>Explanation/Rubric:</strong> ${q.explanation}
      `;
    }
  });

  // Calculate Percentage & Update Banner cleanly handling potential float values
  earnedMarks = Math.round(earnedMarks * 100) / 100;
  const totalPossibleFormatted = Math.round(totalPossible * 100) / 100;
  const percentage = totalPossibleFormatted > 0 ? Math.round((earnedMarks / totalPossibleFormatted) * 100) : 0;
  
  document.getElementById('userScore').textContent = earnedMarks;
  document.getElementById('maxScore').textContent = totalPossibleFormatted;
  document.getElementById('scorePercentage').textContent = percentage;
  
  const resultsBanner = document.getElementById('resultsBanner');
  resultsBanner.classList.remove('hidden');
  resultsBanner.scrollIntoView({ behavior: 'smooth' });

  // Disable submit after evaluation
  document.getElementById('submitBtn').disabled = true;
}
