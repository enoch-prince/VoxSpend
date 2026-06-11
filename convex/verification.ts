import { action, query, mutation, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const VERIFICATION_SUBJECT = 'Verify your VoxSpend email';

function generateVerificationCode(): string {
  // Rejection-sample a uniform integer in [0, 1_000_000) using Web Crypto.
  const range = 1_000_000;
  const max = Math.floor(0xffffffff / range) * range;
  const buf = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= max);
  return String(n % range).padStart(6, '0');
}

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildEmailBody(code: string): string {
  return `Your VoxSpend verification code is: ${code}\n\n` +
    'Enter this code in the app to finish signing in and start tracking your spending.';
}

async function sendEmailWithSendGrid(sender: string, recipient: string, body: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SendGrid API key is not configured.');
  }

  const payload = {
    personalizations: [
      {
        to: [{ email: recipient }],
        subject: VERIFICATION_SUBJECT,
      },
    ],
    from: { email: sender, name: 'VoxSpend' },
    content: [{ type: 'text/plain', value: body }],
  };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SendGrid email failed: ${response.status} ${text}`);
  }
}

async function sendEmailWithMailgun(sender: string, recipient: string, body: string) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    throw new Error('Mailgun configuration is incomplete.');
  }

  const auth = Buffer.from(`api:${apiKey}`).toString('base64');
  const params = new URLSearchParams();
  params.set('from', sender);
  params.set('to', recipient);
  params.set('subject', VERIFICATION_SUBJECT);
  params.set('text', body);

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mailgun email failed: ${response.status} ${text}`);
  }
}

async function sendEmailWithMailerSend(sender: string, recipient: string, body: string) {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    throw new Error('MailerSend API key is not configured.');
  }

  const personalization = [
        {
            email: recipient,
            data: {
                otp: body,
                account: {
                    name: "VoxSpend",
                },
                support_email: "info@voxspend.com"
            }
        }
    ];

  const payload = {
    from: { email: sender, name: 'VoxSpend' },
    to: [{ email: recipient }],
    subject: VERIFICATION_SUBJECT,
    text: body,
    personalization: personalization,
    template_id: "o65qngk1xn8lwr12",
  };

  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MailerSend email failed: ${response.status} ${text}`);
  }
}

async function sendVerificationEmail(email: string, code: string) {
  const body = buildEmailBody(code);
  const sender =
    process.env.SENDGRID_FROM ||
    process.env.MAILGUN_FROM ||
    process.env.MAILERSEND_FROM ||
    process.env.EMAIL_FROM ||
    process.env.MAIL_FROM;

  if (process.env.SENDGRID_API_KEY) {
    if (!sender) throw new Error('Email sender address is not configured.');
    return await sendEmailWithSendGrid(sender, email, body);
  }

  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    if (!sender) throw new Error('Email sender address is not configured.');
    return await sendEmailWithMailgun(sender, email, body);
  }

  if (process.env.MAILERSEND_API_KEY) {
    if (!sender) throw new Error('Email sender address is not configured.');
    return await sendEmailWithMailerSend(sender, email, code);
  }

  // No provider configured. Convex always sets NODE_ENV=production, so we
  // can't rely on it to decide between dev-log-fallback and prod-throw.
  // Instead: when nothing is wired up, log the code to Convex logs so dev
  // works out of the box. Real production deployments MUST configure either
  // SENDGRID_API_KEY, MAILGUN_API_KEY (+ MAILGUN_DOMAIN), or MAILERSEND_API_KEY,
  // or set REQUIRE_EMAIL_PROVIDER=true to make this branch throw instead.
  if (process.env.REQUIRE_EMAIL_PROVIDER === 'true') {
    throw new Error(
      'No email provider is configured. Set SENDGRID_API_KEY, MAILGUN_API_KEY, or MAILERSEND_API_KEY in the environment.',
    );
  }

  console.warn(
    `[verification] No email provider configured — logging code to Convex logs. ` +
      `Configure SENDGRID_API_KEY, MAILGUN_API_KEY, or MAILERSEND_API_KEY (and a sender address) before production.`,
  );
  console.info(`VoxSpend verification code for ${email}: ${code}`);
}

export const emailVerificationStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { emailVerified: false, email: null };
    }

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();

    return {
      emailVerified: profile?.emailVerified === true,
      email: profile?.email ?? null,
    };
  },
});

export const _storeVerificationCode = internalMutation({
  args: {
    userId: v.id('users'),
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, {
        email: args.email,
        emailVerified: profile.emailVerified ?? false,
      });
    } else {
      await ctx.db.insert('userProfiles', {
        userId: args.userId,
        email: args.email,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      });
    }

    const existing = await ctx.db
      .query('emailVerifications')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        codeHash: args.codeHash,
        expiresAt: args.expiresAt,
        attempts: 0,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert('emailVerifications', {
        userId: args.userId,
        email: args.email,
        codeHash: args.codeHash,
        expiresAt: args.expiresAt,
        attempts: 0,
        createdAt: Date.now(),
      });
    }
  },
});

export const _verifyCodeInDb = internalMutation({
  args: {
    userId: v.id('users'),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('emailVerifications')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();

    if (!existing) {
      return { success: false, reason: 'notfound' };
    }

    if (Date.now() > existing.expiresAt) {
      await ctx.db.delete(existing._id);
      return { success: false, reason: 'expired' };
    }

    if (existing.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return { success: false, reason: 'locked' };
    }

    if (args.codeHash !== existing.codeHash) {
      await ctx.db.patch(existing._id, {
        attempts: existing.attempts + 1,
      });
      return { success: false, reason: 'invalid' };
    }

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, {
        emailVerified: true,
      });
    } else {
      const identity = await ctx.auth.getUserIdentity();
      await ctx.db.insert('userProfiles', {
        userId: args.userId,
        email: identity?.email ?? existing.email,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      });
    }

    await ctx.db.delete(existing._id);
    return { success: true };
  },
});

export const requestEmailVerification = action({
  args: {},
  handler: async (ctx: any) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');

    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email;
    if (!email) {
      throw new Error('Could not determine your email address.');
    }

    const code = generateVerificationCode();
    const codeHash = await hashCode(code);
    const expiresAt = Date.now() + VERIFICATION_TTL_MS;

    await ctx.runMutation(internal.verification._storeVerificationCode, {
      userId,
      email,
      codeHash,
      expiresAt,
    });

    await sendVerificationEmail(email, code);
    return { success: true };
  },
});

export const verifyEmailOtp = action({
  args: {
    code: v.string(),
  },
  handler: async (ctx: any, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');

    const codeHash = await hashCode(args.code);
    const result = await ctx.runMutation(internal.verification._verifyCodeInDb, {
      userId,
      codeHash,
    });

    if (!result.success) {
      switch (result.reason) {
        case 'notfound':
          throw new Error('Verification code not found. Request a new code.');
        case 'expired':
          throw new Error('Verification code has expired. Request a new one.');
        case 'locked':
          throw new Error('Too many attempts. Request a new verification code.');
        case 'invalid':
          throw new Error('Invalid verification code.');
        default:
          throw new Error('Verification failed.');
      }
    }
    return { success: true };
  },
});
