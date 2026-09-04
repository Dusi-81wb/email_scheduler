export const validateStartupEnv = () => {
  const missingVars: string[] = [];

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_ID.trim()) {
    missingVars.push('GOOGLE_CLIENT_ID');
  }

  if (!process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CLIENT_SECRET.trim()) {
    missingVars.push('GOOGLE_CLIENT_SECRET');
  }

  if (missingVars.length > 0) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ FATAL CONFIGURATION ERROR: MISSING REQUIRED GOOGLE OAUTH CREDENTIALS');
    console.error('='.repeat(70));
    console.error(
      `The following strictly required environment variable(s) are missing in OutBox/backend/.env:\n`
    );
    missingVars.forEach((v) => console.error(`  - ${v}`));
    console.error('\nPer the project specification:');
    console.error('  * Google OAuth is the required authentication mechanism.');
    console.error('  * Mock/dev login fallbacks are strictly disabled.');
    console.error('\nPlease configure your Google OAuth credentials in OutBox/backend/.env:');
    console.error('  GOOGLE_CLIENT_ID="<your-google-client-id>.apps.googleusercontent.com"');
    console.error('  GOOGLE_CLIENT_SECRET="<your-google-client-secret>"');
    console.error('  GOOGLE_REDIRECT_URI="http://localhost:5000/api/auth/google/callback"');
    console.error('='.repeat(70) + '\n');
    throw new Error(`Missing required Google OAuth environment variables: ${missingVars.join(', ')}`);
  }

  console.log('✅ Google OAuth credentials validated successfully.');
};
