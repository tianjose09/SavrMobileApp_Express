export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  label: string;
  color: string;
  score: number;
  missing: string[];
  progress: number; // 0–1
  requirements: PasswordRequirement[];
}

export const evaluatePasswordStrength = (password: string): PasswordStrengthResult => {
  const requirements: PasswordRequirement[] = [
    { label: 'At least 12 characters',     met: password.length >= 12 },
    { label: 'At least 1 number',           met: /[0-9]/.test(password) },
    { label: 'At least 1 lowercase letter', met: /[a-z]/.test(password) },
    { label: 'At least 1 uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'At least 1 special character',met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = requirements.filter(r => r.met).length;
  const missing  = requirements.filter(r => !r.met).map(r => r.label);

  let label = '';
  let color = '';
  let progress = metCount / requirements.length;

  if (!password) {
    return { label: '', color: 'transparent', score: 0, missing: [], progress: 0, requirements };
  }

  if (metCount <= 2) {
    label = 'Weak';
    color = '#FF4C4C';
  } else if (metCount <= 3) {
    label = 'Fair';
    color = '#E4B63F';
  } else if (metCount === 4) {
    label = 'Medium';
    color = '#E4B63F';
  } else {
    label = 'Strong';
    color = '#4CAF50';
  }

  return { label, color, score: metCount, missing, progress, requirements };
};
