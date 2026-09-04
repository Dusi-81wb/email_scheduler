// Client-side parser for CSV / TXT lead lists

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export interface ParsedLeadsResult {
  validEmails: string[];
  totalDetected: number;
  duplicateCount: number;
}

export const parseEmailLeads = async (file: File): Promise<ParsedLeadsResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          resolve({ validEmails: [], totalDetected: 0, duplicateCount: 0 });
          return;
        }

        const matches = text.match(EMAIL_REGEX) || [];
        const normalized = matches.map((email) => email.trim().toLowerCase());
        const uniqueSet = new Set(normalized);
        const validEmails = Array.from(uniqueSet);

        resolve({
          validEmails,
          totalDetected: matches.length,
          duplicateCount: matches.length - validEmails.length,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
