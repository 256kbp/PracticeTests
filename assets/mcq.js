// Variable for number of questions displayed per test (can be changed when needed)
const QUESTIONS_PER_TEST = 10;
let currentTestQuestions = [];

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
    const urlParams = new URLSearchParams(window.location.search);
    const subject = urlParams.get('subject') || 'hindi';
    const chapter = urlParams.get('chapter');
    
    let allQuestions = [];

    if (chapter) {
      const response = await fetch(`data/${subject}/chapter-${chapter}.json`);
      if (!response.ok) throw new Error(`Could not load chapter-${chapter}.json`);
      allQuestions = await response.json();
    } else {
      // Try loading manifest.json first (for modular subjects like maths)
      try {
        const manifestRes = await fetch(`data/${subject}/manifest.json`);
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          for (const ch of manifest.chapters) {
            try {
              const chRes = await fetch(`data/${subject}/chapter-${ch}.json`);
              if (chRes.ok) {
                const chData = await chRes.json();
                allQuestions = allQuestions.concat(chData);
              }
            } catch (err) {
              console.warn(`Could not load chapter ${ch}`, err);
            }
          }
        } else {
          throw new Error('No manifest');
        }
      } catch (e) {
        // Fallback to traditional questions.json for single-file subjects
        const response = await fetch(`data/${subject}/questions.json`);
        if (!response.ok) throw new Error(`Could not load questions.json for ${subject}`);
        allQuestions = await response.json();
      }
    }
    
    // Include both MCQ and True/False question types
    return allQuestions.filter(q => q.type === 'MCQ' || q.type === 'True/False');
  } catch (error) {
    console.error('Could not load questions:', error);
    alert('Error loading question bank. Check your data folder.');
    return [];
  }
}

async function generateTest() {
  const questionPool = await fetchQuestions();
  if (questionPool.length === 0) return;

  // Randomly shuffle all available questions
  const shuffled = [...questionPool].sort(() => 0.5 - Math.random());

  // Select exactly QUESTIONS_PER_TEST (10) questions per test
  currentTestQuestions = shuffled.slice(0, QUESTIONS_PER_TEST);

  // Sort selected questions by difficulty for a smooth testing experience
  currentTestQuestions.sort((a, b) => {
    const diffA = DIFFICULTY_ORDER[a.difficulty] || 2;
    const diffB = DIFFICULTY_ORDER[b.difficulty] || 2;
    if (diffA !== diffB) return diffA - diffB;
    return (a.marks || 1) - (b.marks || 1);
  });

  // Calculate total marks available for the selected test questions
  const totalMarks = currentTestQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

  document.getElementById('resultsBanner').classList.add('hidden');
  document.getElementById('submitBtn').disabled = false;

  renderTest(currentTestQuestions, totalMarks);
}

function renderTest(questions, totalMarks) {
  const container = document.getElementById('quizContainer');
  document.getElementById('totalMarks').textContent = totalMarks;
  container.innerHTML = '';

  if (questions.length === 0) {
    container.innerHTML = '<p>No questions could be selected for this test.</p>';
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

    const chapterBadge = q.chapter && q.chapter !== '-' ? `<span class="badge badge-small">Chapter ${q.chapter}</span>` : '';
    const qMarks = q.marks !== undefined ? q.marks : 1;

    card.innerHTML = `
      <div class="question-meta-top">
        <span class="badge">Q${index + 1}</span>
        <span class="badge"><strong>${qMarks} Mark${qMarks > 1 ? 's' : ''}</strong></span>
      </div>
      <div class="question-text">${q.question}</div>
      ${inputHtml}
      <div id="feedback_${q.id}" class="feedback-box hidden"></div>
      <div class="question-meta-bottom">
        ${chapterBadge}
        <span class="badge badge-small">${q.difficulty}</span>
        <span class="badge badge-small">${q.type}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

function submitTest() {
  let earnedMarks = 0;
  const totalPossible = currentTestQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

  currentTestQuestions.forEach((q) => {
    const feedbackBox = document.getElementById(`feedback_${q.id}`);
    feedbackBox.classList.remove('hidden', 'feedback-correct', 'feedback-incorrect');

    const selectedOption = document.querySelector(`input[name="q_${q.id}"]:checked`);
    const userAnswer = selectedOption ? selectedOption.value : null;
    const qMarks = q.marks !== undefined ? q.marks : 1;

    // Highlight options (correct and incorrect selections)
    const radios = document.querySelectorAll(`input[name="q_${q.id}"]`);
    radios.forEach(radio => {
      const label = radio.closest('label');
      if (label) {
        label.classList.remove('correct', 'incorrect');
        if (radio.value === q.answer) {
          label.classList.add('correct');
        } else if (radio.checked && radio.value !== q.answer) {
          label.classList.add('incorrect');
        }
      }
    });

    if (userAnswer === q.answer) {
      earnedMarks += qMarks;
      feedbackBox.classList.add('feedback-correct');
      feedbackBox.innerHTML = `<strong>Correct! (+${qMarks} mark${qMarks > 1 ? 's' : ''})</strong><br>${q.explanation}`;
    } else {
      feedbackBox.classList.add('feedback-incorrect');
      feedbackBox.innerHTML = `
        <strong>Incorrect (0/${qMarks} mark${qMarks > 1 ? 's' : ''})</strong><br>
        <strong>Correct Answer:</strong> ${q.answer}<br>
        <strong>Explanation:</strong> ${q.explanation}
      `;
    }
  });

  const percentage = totalPossible > 0 ? Math.round((earnedMarks / totalPossible) * 100) : 0;
  document.getElementById('userScore').textContent = earnedMarks;
  document.getElementById('maxScore').textContent = totalPossible;
  document.getElementById('scorePercentage').textContent = percentage;
  
  document.getElementById('resultsBanner').classList.remove('hidden');
  document.getElementById('summary').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('submitBtn').disabled = true;
}
