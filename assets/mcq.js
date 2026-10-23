// Variable for number of questions displayed per test (can be changed when needed)
const QUESTIONS_PER_TEST = 10;
let currentTestQuestions = [];
let allSubjectQuestions = [];
let availableChapters = [];

const DIFFICULTY_ORDER = {
  'Easy': 1,
  'Medium': 2,
  'Hard': 3
};

document.getElementById('generateBtn').addEventListener('click', generateTest);
document.getElementById('submitBtn').addEventListener('click', submitTest);
document.getElementById('chapterFilter').addEventListener('change', generateTest);
window.addEventListener('DOMContentLoaded', initQuizPage);

async function initQuizPage() {
  await loadSubjectData();
  populateChapterDropdown();
  generateTest();
}

async function loadSubjectData() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const subject = urlParams.get('subject') || 'hindi';
    
    allSubjectQuestions = [];
    availableChapters = [];

    // Try loading manifest.json first (for modular subjects)
    try {
      const manifestRes = await fetch(`data/${subject}/manifest.json`);
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        availableChapters = manifest.chapters || [];
        for (const ch of availableChapters) {
          try {
            const chRes = await fetch(`data/${subject}/chapter-${ch}.json`);
            if (chRes.ok) {
              const chData = await chRes.json();
              allSubjectQuestions = allSubjectQuestions.concat(chData);
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
      allSubjectQuestions = await response.json();
      
      // Extract unique chapters from questions if available
      const chapterSet = new Set();
      allSubjectQuestions.forEach(q => {
        if (q.chapter && q.chapter !== '-') chapterSet.add(q.chapter);
      });
      availableChapters = Array.from(chapterSet).sort((a, b) => Number(a) - Number(b));
    }
  } catch (error) {
    console.error('Could not load subject data:', error);
    alert('Error loading question bank. Check your data folder.');
  }
}

function populateChapterDropdown() {
  const select = document.getElementById('chapterFilter');
  // Keep the default "All Chapters" option
  select.innerHTML = '<option value="all">All Chapters</option>';

  availableChapters.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch;
    opt.textContent = `Chapter ${ch}`;
    select.appendChild(opt);
  });
}

async function generateTest() {
  if (allSubjectQuestions.length === 0) await loadSubjectData();
  if (allSubjectQuestions.length === 0) return;

  const selectedChapter = document.getElementById('chapterFilter').value;

  // Filter by chapter if a specific one is selected
  let questionPool = allSubjectQuestions;
  if (selectedChapter !== 'all') {
    questionPool = allSubjectQuestions.filter(q => String(q.chapter) === String(selectedChapter));
  }

  // Include both MCQ and True/False question types
  questionPool = questionPool.filter(q => q.type === 'MCQ' || q.type === 'True/False');

  if (questionPool.length === 0) {
    document.getElementById('quizContainer').innerHTML = '<p style="text-align:center; font-weight:800; color:#475569; padding: 20px;">No questions found for this chapter.</p>';
    document.getElementById('totalMarks').textContent = 0;
    document.getElementById('submitBtn').disabled = true;
    return;
  }

  // Randomly shuffle available questions
  const shuffled = [...questionPool].sort(() => 0.5 - Math.random());

  // Select up to QUESTIONS_PER_TEST (or all if fewer available)
  const testLimit = Math.min(QUESTIONS_PER_TEST, shuffled.length);
  currentTestQuestions = shuffled.slice(0, testLimit);

  // Sort selected questions by difficulty for a smooth testing experience
  currentTestQuestions.sort((a, b) => {
    const diffA = DIFFICULTY_ORDER[a.difficulty] || 2;
    const diffB = DIFFICULTY_ORDER[b.difficulty] || 2;
    if (diffA !== diffB) return diffA - diffB;
    return (a.marks || 1) - (b.marks || 1);
  });

  const totalMarks = currentTestQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

  document.getElementById('resultsBanner').classList.add('hidden');
  document.getElementById('submitBtn').disabled = false;

  renderTest(currentTestQuestions, totalMarks);
}

function renderTest(questions, totalMarks) {
  const container = document.getElementById('quizContainer');
  document.getElementById('totalMarks').textContent = totalMarks;
  container.innerHTML = '';

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
