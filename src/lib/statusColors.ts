export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BL: { label: 'Blacklist', color: '#ffffff', bg: '#e53e3e' },
  SH: { label: 'Spamhaus', color: '#000000', bg: '#ffc800ff' },
  BR: { label: 'Barracuda', color: '#ffffff', bg: '#805ad5' },
  TO: { label: 'Timed Out', color: '#ffffff', bg: '#ed64a6' },
  EXP: { label: 'Expired', color: '#ffffff', bg: '#00b5d8' },
  ECR: { label: 'ECONNREFUSED', color: '#ffffff', bg: '#ed8936' },
  CLEAN: { label: 'Clean', color: '#ffffff', bg: '#48bb78' },
};

export function getDrnColor(drn: number): string {
  if (drn <= 5) return '#e53e3e';
  if (drn <= 10) return '#ed8936';
  return '#48bb78';
}

export function getDrnDays(nDue: string | null): number | null {
  if (!nDue) return null;
  const diff = new Date(nDue).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
