export const SECURITY_QUESTION_CHOICES = [
  'What is the name of your first pet?',
  'What is the name of your primary school?',
  'What was your favorite childhood nickname?',
  'In which city were you born?',
  'What is the make of your first car?',
];

export function normalizeSecurityAnswer(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidSecurityQuestion(question) {
  return SECURITY_QUESTION_CHOICES.includes(question);
}

export function parseSecurityQuestionAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 3) {
    return [];
  }

  return answers.map((entry) => {
    if (typeof entry === 'string') {
      return {
        question: null,
        answer: normalizeSecurityAnswer(entry),
      };
    }

    const question = typeof entry?.question === 'string' ? entry.question.trim() : null;
    return {
      question,
      answer: normalizeSecurityAnswer(entry?.answer),
    };
  });
}
