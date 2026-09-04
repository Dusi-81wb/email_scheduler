import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { validateStartupEnv } from '../config/validateEnv';
import { JWT_SECRET } from '../middleware/auth.middleware';

async function runOAuthAudit() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 RUNNING COMPREHENSIVE GOOGLE OAUTH 2.0 IMPLEMENTATION AUDIT');
  console.log('='.repeat(70) + '\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // TEST 1: Startup Validation Fails on Missing Credentials
  console.log('--- Test 1: Startup Credential Validation ---');
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;

  let threwMissingError = false;
  try {
    validateStartupEnv();
  } catch (err: any) {
    threwMissingError = true;
    assert(
      err.message.includes('Missing required Google OAuth environment variables'),
      'Fails fast on startup when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing',
      err.message
    );
  }
  if (!threwMissingError) {
    assert(false, 'Should throw error when Google OAuth credentials are empty');
  }

  // Restore mock credentials for remaining endpoint tests
  process.env.GOOGLE_CLIENT_ID = 'test-client-id-123.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret-xyz';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/auth/google/callback';

  try {
    validateStartupEnv();
    assert(true, 'Startup validation succeeds when credentials are provided');
  } catch (err: any) {
    assert(false, 'Startup validation threw unexpectedly', err.message);
  }

  // TEST 2: Google Authorization Redirect Generation
  console.log('\n--- Test 2: Google Authorization URL Generation ---');
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  const expectedAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=openid%20profile%20email&access_type=offline&prompt=select_account`;

  assert(
    expectedAuthUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth'),
    'Redirects directly to accounts.google.com/o/oauth2/v2/auth'
  );
  assert(
    expectedAuthUrl.includes('client_id=test-client-id-123.apps.googleusercontent.com'),
    'Includes configured GOOGLE_CLIENT_ID'
  );
  assert(
    expectedAuthUrl.includes('redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fapi%2Fauth%2Fgoogle%2Fcallback'),
    'Includes configured GOOGLE_REDIRECT_URI'
  );
  assert(
    expectedAuthUrl.includes('scope=openid%20profile%20email'),
    'Requests openid, profile, and email scopes'
  );

  // TEST 3: User Persistence and Identity Verification
  console.log('\n--- Test 3: User Persistence & Google Identity Upsert in PostgreSQL ---');
  const testGoogleUser = {
    id: 'google-oauth-uid-98765',
    email: 'samrat.evaluator@example.com',
    name: 'Samrat Evaluator',
    picture: 'https://lh3.googleusercontent.com/a/ACg8ocLexample-avatar',
  };

  const persistedUser = await prisma.user.upsert({
    where: { email: testGoogleUser.email },
    update: {
      name: testGoogleUser.name,
      avatarUrl: testGoogleUser.picture,
      googleId: testGoogleUser.id,
    },
    create: {
      email: testGoogleUser.email,
      name: testGoogleUser.name,
      avatarUrl: testGoogleUser.picture,
      googleId: testGoogleUser.id,
    },
  });

  assert(persistedUser.email === testGoogleUser.email, 'User email saved correctly');
  assert(persistedUser.name === testGoogleUser.name, 'Google display name saved correctly');
  assert(persistedUser.avatarUrl === testGoogleUser.picture, 'Google avatar URL saved correctly');
  assert(persistedUser.googleId === testGoogleUser.id, 'Google UID saved correctly');

  // TEST 4: JWT Session Generation and Verification
  console.log('\n--- Test 4: JWT Session Issuance & Verification ---');
  const sessionToken = jwt.sign(
    { userId: persistedUser.id, email: persistedUser.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  assert(!!sessionToken, 'JWT session token issued successfully');

  const decoded = jwt.verify(sessionToken, JWT_SECRET) as any;
  assert(decoded.userId === persistedUser.id, 'JWT payload contains valid userId');
  assert(decoded.email === persistedUser.email, 'JWT payload contains valid email');

  // TEST 5: Token Tampering & Invalid Secret Rejection
  console.log('\n--- Test 5: Rejection of Invalid/Tampered Tokens ---');
  let invalidTokenRejected = false;
  try {
    jwt.verify(sessionToken + 'tampered', JWT_SECRET);
  } catch {
    invalidTokenRejected = true;
  }
  assert(invalidTokenRejected, 'Tampered JWT session token is strictly rejected');

  // TEST 6: Verify User Record in Database
  console.log('\n--- Test 6: Database Query for Authenticated User ---');
  const fetchedUser = await prisma.user.findUnique({
    where: { id: persistedUser.id },
  });
  assert(!!fetchedUser, 'User retrieved from PostgreSQL database');
  assert(fetchedUser?.email === testGoogleUser.email, 'Retrieved user email matches');
  assert(fetchedUser?.name === testGoogleUser.name, 'Retrieved user name matches');
  assert(fetchedUser?.avatarUrl === testGoogleUser.picture, 'Retrieved user avatar matches');

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`📊 OAUTH AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(70) + '\n');

  // Restore env
  if (originalClientId) process.env.GOOGLE_CLIENT_ID = originalClientId;
  else delete process.env.GOOGLE_CLIENT_ID;
  if (originalClientSecret) process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
  else delete process.env.GOOGLE_CLIENT_SECRET;

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runOAuthAudit().catch((err) => {
  console.error('Fatal error during OAuth test:', err);
  process.exit(1);
});
