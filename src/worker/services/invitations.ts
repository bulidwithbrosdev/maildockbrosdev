// User account activation invitations and credential delivery
import type { Env } from '../env';
import { all, first, run } from '../db/db';
import { loadSettings, type AppSettings } from '../db/settings';
import { badRequest, errorMessage, HttpError, notFound, tooMany } from '../lib/errors';
import { randomToken, sha256Hex } from '../lib/crypto';
import { hashPassword, passwordProblem } from '../lib/password';
import { domainOf, isValidAddress, type Address } from '../mail/address';
import { buildMime } from '../mail/mime';
import { newMessageId } from '../mail/threading';
import { adapterFor, type ProviderRow } from '../providers';
import { audit, auditStmt } from './audit';
import { getUser, type UserRow } from './users';
import type { SessionUser } from '../types';
import type { OutgoingMessage } from '../providers/types';
import { PROVIDER_INFO } from '../../shared/constants';
import { log, logError } from '../lib/log';

export const INVITATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

export interface UserInvitationRow {
  id: number;
  user_id: number;
  token_hash: string;
  recipient_email: string;
  status: 'pending' | 'sent' | 'accepted' | 'expired' | 'failed';
  error: string | null;
  sent_at: number | null;
  expires_at: number;
  accepted_at: number | null;
  created_at: number;
}

export function renderInvitationEmail({
  userName,
  mailboxEmail,
  webmailUrl,
  activationUrl,
  instanceName,
}: {
  userName: string;
  mailboxEmail: string;
  webmailUrl: string;
  activationUrl: string;
  instanceName: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Your Business Email Account Is Ready';
  const appName = instanceName || 'Maildock';
  const name = userName?.trim() || mailboxEmail;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px; border-bottom: 1px solid #f1f5f9;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; width: 38px; height: 38px; border-radius: 8px; text-align: center; line-height: 38px; font-size: 20px;">
                      &#x2709;&#xFE0F;
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">${appName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px; font-size: 21px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">Your Business Email Account Is Ready</h1>
              <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Hello <strong>${name}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #334155;">Your business email account has been successfully created. Here are your account details:</p>
              
              <!-- Account Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; width: 130px;">Email Address</td>
                  <td style="padding: 13px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #0f172a; font-family: ui-monospace, SFMono-Regular, monospace;">${mailboxEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 13px 18px; font-size: 13px; color: #64748b; width: 130px;">Webmail Login</td>
                  <td style="padding: 13px 18px; font-size: 14px; color: #2563eb;"><a href="${webmailUrl}" style="color: #2563eb; text-decoration: none;">${webmailUrl}</a></td>
                </tr>
              </table>
              
              <p style="margin: 0 0 24px; font-size: 15px; color: #334155;">To activate your account, click the secure password setup link below:</p>
              
              <!-- Call to Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${activationUrl}" target="_blank" style="display: inline-block; background-color: #dc2626; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 13px 36px; border-radius: 8px; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.25);">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 12px; font-size: 12.5px; color: #64748b; line-height: 1.5;">
                This link is single-use, securely generated, and will expire after 24 hours.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; word-break: break-all;">
                If the button above does not work, copy and paste this URL into your browser:<br>
                <a href="${activationUrl}" style="color: #64748b;">${activationUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
              Secured by <strong>Maildock</strong> · Your own email, on your own domains.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hello ${name},

Your business email account has been successfully created.

Your account details:
- Email Address: ${mailboxEmail}
- Webmail Login: ${webmailUrl}

To activate your account, click the secure password setup link below:
${activationUrl}

This link is single-use, securely generated and expires after 24 hours.

--
${appName} · Powered by Maildock`;

  return { subject, html, text };
}

async function findOutboundProvider(db: D1Database, fromDomain: string): Promise<ProviderRow | null> {
  const domain = await first<{ id: number; provider_id: number | null }>(db, 'SELECT id, provider_id FROM domains WHERE name = ?', fromDomain);
  const rows = await all<ProviderRow & { pd_status: string | null }>(
    db,
    `SELECT p.*, pd.status AS pd_status FROM providers p LEFT JOIN provider_domains pd ON pd.provider_id = p.id AND pd.domain_id = ?
     ORDER BY (p.id = ?) DESC, p.is_default DESC, p.priority, p.created_at`,
    domain?.id ?? -1,
    domain?.provider_id ?? -1,
  );
  if (!rows.length) return null;
  const usable = rows.filter((p) => !PROVIDER_INFO[p.type].hasDomainApi || p.pd_status === 'verified');
  return usable[0] ?? null;
}

export async function createInvitationToken(
  db: D1Database,
  userId: number,
  recipientEmail: string,
): Promise<{ id: number; token: string; expiresAt: number }> {
  const now = Date.now();
  const expiresAt = now + INVITATION_EXPIRY_MS;
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);

  // Invalidate any existing pending/sent invitations for this user
  await run(db, "UPDATE user_invitations SET status = 'expired' WHERE user_id = ? AND status IN ('pending', 'sent')", userId);

  const res = await run(
    db,
    'INSERT INTO user_invitations (user_id, token_hash, recipient_email, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    userId,
    tokenHash,
    recipientEmail.toLowerCase().trim(),
    'pending',
    expiresAt,
    now,
  );

  return { id: res.meta.last_row_id as number, token, expiresAt };
}

export async function sendInvitation(
  env: Env,
  actor: SessionUser | null,
  userId: number,
  overrideAlternateEmail?: string | null,
  origin?: string,
  ip = '127.0.0.1',
): Promise<{ ok: boolean; status: 'sent' | 'failed'; error?: string; inviteUrl: string; sentAt: number }> {
  const user = await getUser(env.DB, userId);
  const settings = await loadSettings(env.DB);
  const now = Date.now();

  // Check rate limiting on resending invitations
  const latest = await first<UserInvitationRow>(
    env.DB,
    'SELECT * FROM user_invitations WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    userId,
  );
  if (latest?.sent_at && now - latest.sent_at < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - latest.sent_at)) / 1000);
    throw tooMany(`Please wait ${waitSec} second${waitSec === 1 ? '' : 's'} before resending an invitation.`, waitSec);
  }

  const recipientEmail = (overrideAlternateEmail?.trim() || user.alternate_email || '').toLowerCase().trim();
  if (!recipientEmail || !isValidAddress(recipientEmail)) {
    throw badRequest('Please provide a valid alternate email address to receive the credentials.', 'no_recipient_email');
  }

  // Update user's alternate_email if changed
  if (overrideAlternateEmail && overrideAlternateEmail.trim().toLowerCase() !== user.alternate_email?.toLowerCase()) {
    await run(env.DB, 'UPDATE users SET alternate_email = ? WHERE id = ?', recipientEmail, userId);
  }

  const { id: invitationId, token, expiresAt } = await createInvitationToken(env.DB, userId, recipientEmail);

  const baseOrigin = settings.appUrl || origin || 'http://localhost:5173';
  const webmailUrl = baseOrigin.replace(/\/+$/, '');
  const activationUrl = `${webmailUrl}/activate?token=${encodeURIComponent(token)}`;

  const emailContent = renderInvitationEmail({
    userName: user.name,
    mailboxEmail: user.email,
    webmailUrl,
    activationUrl,
    instanceName: settings.instanceName,
  });

  const fromDomain = domainOf(user.email);
  const from: Address = {
    name: settings.instanceName || 'Maildock',
    address: `no-reply@${fromDomain}`,
  };
  const to: Address[] = [{ name: user.name || recipientEmail, address: recipientEmail }];
  const messageId = newMessageId(fromDomain);

  let deliveryStatus: 'sent' | 'failed' = 'sent';
  let deliveryError: string | undefined;

  try {
    const provider = await findOutboundProvider(env.DB, fromDomain);
    if (provider) {
      const adapter = await adapterFor(env, provider);
      const raw = buildMime({
        from,
        to,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        messageId,
        date: new Date(now),
      });
      const outgoing: OutgoingMessage = {
        from,
        to,
        cc: [],
        bcc: [],
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        messageId,
        references: [messageId],
        attachments: [],
        raw,
      };
      await adapter.send(outgoing);
      log('invitation.sent', { userId, recipient: recipientEmail, provider: provider.type });
    } else {
      // In local development or before an outbound provider is set up, simulate delivery
      log('invitation.simulated', { userId, recipient: recipientEmail, url: activationUrl });
    }
  } catch (err) {
    deliveryStatus = 'failed';
    deliveryError = errorMessage(err);
    logError('invitation.delivery_failed', err, { userId, recipient: recipientEmail });
  }

  await run(
    env.DB,
    'UPDATE user_invitations SET status = ?, error = ?, sent_at = ? WHERE id = ?',
    deliveryStatus,
    deliveryError ?? null,
    now,
    invitationId,
  );

  if (actor) {
    await audit(env.DB, {
      userId: actor.id,
      action: 'user.invitation_sent',
      target: user.email,
      details: { recipientEmail, status: deliveryStatus, error: deliveryError },
      ip,
    });
  }

  return {
    ok: deliveryStatus === 'sent',
    status: deliveryStatus,
    error: deliveryError,
    inviteUrl: activationUrl,
    sentAt: now,
  };
}

export async function verifyInvitation(
  db: D1Database,
  token: string,
): Promise<{ ok: boolean; name: string; email: string; expiresAt: number }> {
  if (!token?.trim()) throw badRequest('Missing activation token.');
  const tokenHash = await sha256Hex(token.trim());

  const row = await first<UserInvitationRow & { name: string; email: string; user_status: string }>(
    db,
    `SELECT ui.*, u.name, u.email, u.status AS user_status 
     FROM user_invitations ui 
     JOIN users u ON u.id = ui.user_id 
     WHERE ui.token_hash = ?`,
    tokenHash,
  );

  if (!row) throw notFound('This invitation link is invalid or has expired.');
  if (row.status === 'accepted') throw badRequest('This invitation has already been accepted.', 'invitation_accepted');
  if (row.expires_at < Date.now()) {
    await run(db, "UPDATE user_invitations SET status = 'expired' WHERE id = ?", row.id);
    throw badRequest('This invitation link has expired. Please ask your administrator to send a new one.', 'invitation_expired');
  }

  return {
    ok: true,
    name: row.name,
    email: row.email,
    expiresAt: row.expires_at,
  };
}

export async function acceptInvitation(
  env: Env,
  token: string,
  password: string,
  ip: string,
): Promise<{ ok: boolean; email: string }> {
  const problem = passwordProblem(password);
  if (problem) throw badRequest(problem, 'weak_password');

  const tokenHash = await sha256Hex(token.trim());
  const now = Date.now();

  const row = await first<UserInvitationRow & { name: string; email: string; user_id: number }>(
    env.DB,
    `SELECT ui.*, u.name, u.email 
     FROM user_invitations ui 
     JOIN users u ON u.id = ui.user_id 
     WHERE ui.token_hash = ?`,
    tokenHash,
  );

  if (!row) throw notFound('This invitation link is invalid or has expired.');
  if (row.status === 'accepted') throw badRequest('This invitation has already been accepted.', 'invitation_accepted');
  if (row.expires_at < now) {
    await run(env.DB, "UPDATE user_invitations SET status = 'expired' WHERE id = ?", row.id);
    throw badRequest('This invitation link has expired. Please ask your administrator to send a new one.', 'invitation_expired');
  }

  const passwordHash = await hashPassword(password);

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, status = ? WHERE id = ?').bind('active', row.user_id),
    env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, row.user_id),
    env.DB.prepare("UPDATE user_invitations SET status = 'accepted', accepted_at = ? WHERE id = ?").bind(now, row.id),
    env.DB.prepare("UPDATE user_invitations SET status = 'expired' WHERE user_id = ? AND id != ? AND status IN ('pending', 'sent')").bind(row.user_id, row.id),
    auditStmt(env.DB, { userId: row.user_id, action: 'user.invitation_accepted', target: row.email, ip }),
  ]);

  return { ok: true, email: row.email };
}

