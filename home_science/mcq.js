const TARGET_MARKS = 20;
const MAX_TRUE_FALSE_COUNT = 4; // Capped at a maximum of 4 T/F questions per test
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
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - File not found at path: ${response.url}`);
    }
    
    const allQuestions = await response.json();
    
    // Filter BOTH MCQ and True/False questions for objective practice
    return allQuestions.filter(q => q.type === 'MCQ' || q.type === 'True/False');
  } catch (error) {
    console.error('Could not load questions:', error);
    alert(`Error loading question bank:\n${error.message}`);
    return [];
  }
}

async function generateTest() {
  const objectiveQuestions = await fetchQuestions();
  if (objectiveQuestions.length === 0) return;

  const trueFalseQuestions = [...objectiveQuestions.filter(q => q.type === 'True/False')].sort(() => 0.5 - Math.random());
  const mcqQuestions = [...objectiveQuestions.filter(q => q.type === 'MCQ')].sort(() => 0.5 - Math.random());

  currentTestQuestions = [];
  let currentMarks = 0;
  let trueFalseCount = 0;

  // 1. First, select up to MAX_TRUE_FALSE_COUNT True/False questions
  for (const q of trueFalseQuestions) {
    if (trueFalseCount < MAX_TRUE_FALSE_COUNT) {
      if (Math.round((currentMarks + q.marks) * 100) / 100 <= TARGET_MARKS) {
        currentTestQuestions.push(q);
        currentMarks = Math.round((currentMarks + q.marks) * 100) / 100;
        trueFalseCount++;
      }
    } else {
      break;
    }
  }

  // 2. Fill the remaining marks using standard MCQs
  for (const q of mcqQuestions) {
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
    container.innerHTML = '<p>No objective questions could be selected to reach 20 marks.</p>';
    return;
  }

  questions.forEach((q, index) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `question-${q.id}`;

    const inputHtml = `
      <ul class="options-list">
        ${q.options ? q.options.map((opt) => `
          <li>
            <label>
              <input type="radio" name="q_${q.id}" value="${opt}">
              <span>${opt}</span>
            </label>
          </li>
        `).join('') : ''}
      </ul>
    `;

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
  });

  // Round floating-point sums and update results banner
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
