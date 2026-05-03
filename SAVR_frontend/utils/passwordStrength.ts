export const evaluatePasswordStrength = (password: string) => {
  if (!password) return { label: '', color: 'transparent', score: 0, missing: [] };

  let score = 0;
  const missing = [];

  if (password.length >= 8) {
    score += 1;
    if (password.length >= 12) score += 1;
  } else {
    missing.push('8+ characters');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    missing.push('uppercase letter');
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    missing.push('lowercase letter');
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    missing.push('number');
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    missing.push('special character');
  }

  let label = '';
  let color = '';

  if (score <= 2) {
    label = 'Weak Password';
    color = '#FF4C4C';
  } else if (score <= 4) {
    label = 'Fair Password';
    color = '#E4B63F';
  } else {
    label = 'Strong Password';
    color = '#64cf68ff';
  }

  return { label, color, score, missing };
};
