export const SUBJECT_CODE_MAP: Record<string, string> = {
  mathematics: 'MATH',
  math: 'MATH',
  english: 'ENG',
  kiswahili: 'KISW',
  'integrated science': 'INTSC',
  science: 'SC',
  'science and technology': 'SC',
  'social studies': 'SST',
  cre: 'CRE',
  'christian religious education': 'CRE',
  'religious education': 'CRE',
  'religious studies': 'CRE',
  'creative arts': 'CAS',
  'creative arts and sports': 'CAS',
  'creative and sports': 'CAS',
  ire: 'IRE',
  'islamic religious education': 'IRE',
  'islamic education': 'IRE',
  hre: 'HRE',
  'hindu religious education': 'HRE',
  'hindu education': 'HRE',
  agriculture: 'AGN',
  'agriculture and nutrition': 'AGN',
  'pre-technical': 'PRET',
  'pre technical': 'PRET',
  'pre-technical studies': 'PRET',
  'home science': 'HSC',
  'business studies': 'BST',
  history: 'HIST',
  geography: 'GEO',
  physics: 'PHY',
  chemistry: 'CHEM',
  biology: 'BIO',
};

const normalizeSubjectName = (value: string): string =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Return a compact display code without conflating similarly prefixed subjects.
 * The stored subject name is authoritative when present; this is important for
 * Creative Arts because its name starts with the same letters as the CRE alias.
 */
export const getSubjectCode = (name: string, code: string): string => {
  const normalizedName = normalizeSubjectName(name);
  const mappedByName = SUBJECT_CODE_MAP[normalizedName];
  if (mappedByName) return mappedByName;

  const cleanCode = String(code || '').trim().toUpperCase();
  if (cleanCode) {
    if (cleanCode.startsWith('MAT') || cleanCode === 'MA') return 'MATH';
    if (cleanCode.startsWith('ENG') || cleanCode === 'ELA') return 'ENG';
    if (cleanCode.startsWith('KIS') || cleanCode === 'KLA') return 'KISW';
    if (cleanCode.startsWith('BIO')) return 'BIO';
    if (cleanCode.startsWith('CHE')) return 'CHEM';
    if (cleanCode.startsWith('PHY')) return 'PHY';
    if (cleanCode.startsWith('INTSCI') || cleanCode.startsWith('ISC')) return 'INTSC';
    if (cleanCode.startsWith('SS')) return 'SST';
    if (cleanCode.startsWith('AGR')) return 'AGN';
    if (cleanCode.startsWith('PRE') || cleanCode.startsWith('PTS')) return 'PRET';
    if (cleanCode.startsWith('CAS') || cleanCode === 'CA') return 'CAS';
    if (cleanCode.startsWith('CRE') || cleanCode.startsWith('CHR')) return 'CRE';
    if (cleanCode.startsWith('IRE') || cleanCode === 'ISL') return 'IRE';
    if (cleanCode.startsWith('HRE') || cleanCode === 'HIN') return 'HRE';
    return cleanCode.replace(/\d+/g, '').substring(0, 5) || cleanCode.substring(0, 5);
  }

  return String(name || '').replace(/[^A-Za-z]/g, '').substring(0, 5).toUpperCase() || 'SUB';
};

export const normalizeSubjectNameForTest = normalizeSubjectName;

/** Religious-subject code (CRE / IRE / HRE), else null. */
export const getReligiousCode = (name: string, code: string): string | null => {
  const c = getSubjectCode(name, code);
  return c === 'CRE' || c === 'IRE' || c === 'HRE' ? c : null;
};

