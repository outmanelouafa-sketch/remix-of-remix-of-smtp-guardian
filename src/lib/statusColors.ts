export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BL: { label: 'Blacklist', color: '#e53e3e', bg: 'rgba(229,62,62,0.15)' },
  SH: { label: 'Spamhaus', color: '#ecc94b', bg: 'rgba(236,201,75,0.15)' },
  BR: { label: 'Barracuda', color: '#805ad5', bg: 'rgba(128,90,213,0.15)' },
  TO: { label: 'Timed Out', color: '#ed64a6', bg: 'rgba(237,100,166,0.15)' },
  EXP: { label: 'Expired', color: '#00b5d8', bg: 'rgba(0,181,216,0.15)' },
  ECR: { label: 'ECONNREFUSED', color: '#ed8936', bg: 'rgba(237,137,54,0.15)' },
  CLEAN: { label: 'Clean', color: '#48bb78', bg: 'rgba(72,187,120,0.15)' },
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
