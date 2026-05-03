export const checkEmailTypo = (email: string): string | null => {
  if (!email || !email.includes('@')) return null;

  const [localPart, domain] = email.split('@');
  if (!domain) return null;

  const lowerDomain = domain.toLowerCase();

  const domainCorrections: { [key: string]: string } = {
    // Gmail typos
    'gnail.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmil.com': 'gmail.com',
    'gemail.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'gmail.co': 'gmail.com',
    
    // Yahoo typos
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com.ph': 'yahoo.com.ph',
    'yahoo.con': 'yahoo.com',
    'yahoo.co': 'yahoo.com',

    // Hotmail typos
    'hotmai.com': 'hotmail.com',
    'hotmal.com': 'hotmail.com',
    'hotmil.com': 'hotmail.com',

    // Outlook typos
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
  };

  if (domainCorrections[lowerDomain]) {
    return `${localPart}@${domainCorrections[lowerDomain]}`;
  }

  return null;
};
