import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { JWT_SECRET } from '../middleware/auth.middleware';

export class AuthController {
  /**
   * Initiates the real Google OAuth authorization redirect.
   * Strictly requires Google OAuth credentials.
   */
  public static async googleAuth(req: Request, res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';

    if (!clientId || !clientId.trim()) {
      return res.status(500).json({
        error: 'Configuration Error: GOOGLE_CLIENT_ID is not configured in .env. Real Google OAuth is required.',
      });
    }

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=openid%20profile%20email&access_type=offline&prompt=select_account`;

    console.log(`🔗 Redirecting user to Google OAuth: ${googleAuthUrl}`);
    return res.redirect(googleAuthUrl);
  }

  /**
   * Handles Google OAuth authorization code callback.
   * Exchanges code for tokens, verifies identity, upserts user in database,
   * generates signed session JWT, and redirects to frontend.
   */
  public static async googleCallback(req: Request, res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const { code, error } = req.query;

    if (error) {
      console.warn('Google OAuth returned error:', error);
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(String(error))}`);
    }

    if (!code || typeof code !== 'string') {
      console.warn('Google OAuth callback missing authorization code.');
      return res.redirect(`${frontendUrl}/auth/callback?error=missing_authorization_code`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET on callback.');
      return res.redirect(`${frontendUrl}/auth/callback?error=oauth_configuration_missing`);
    }

    try {
      // 1. Exchange authorization code for Google access token
      console.log('🔄 Exchanging authorization code with Google token service...');
      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      const { access_token } = tokenResponse.data;

      // 2. Fetch authenticated user profile from Google UserInfo endpoint
      console.log('👤 Fetching verified user profile from Google...');
      const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000,
      });

      const { id: googleId, email, name, picture } = profileResponse.data;

      if (!email) {
        throw new Error('Google identity does not include an email address.');
      }

      // 3. Upsert user record in PostgreSQL database
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: name || email.split('@')[0],
          avatarUrl: picture || null,
          googleId,
        },
        create: {
          email,
          name: name || email.split('@')[0],
          avatarUrl: picture || null,
          googleId,
        },
      });

      console.log(`✅ Authenticated Google User: ${user.name} (${user.email})`);

      // 4. Issue secure signed JWT session token
      const sessionToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 5. Redirect to frontend with session token and user payload
      const userPayload = encodeURIComponent(
        JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        })
      );

      return res.redirect(`${frontendUrl}/auth/callback?token=${sessionToken}&user=${userPayload}`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error_description || err.response?.data?.error || err.message;
      console.error('❌ Google OAuth verification failed:', errorMsg);
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMsg)}`);
    }
  }

  /**
   * Returns current authenticated user based on validated JWT token.
   */
  public static async getMe(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: No active session.' });
    }

    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatarUrl: req.user.avatarUrl,
      },
    });
  }

  /**
   * Clears session and returns logout confirmation.
   */
  public static async logout(req: Request, res: Response) {
    return res.json({ success: true, message: 'Logged out successfully.' });
  }
}
