import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Gmail SMTP via nodemailer — zero-cost, no domain needed, just a Gmail
// account with 2-Step Verification and an App Password (see .env.example).
// Without GMAIL_USER/GMAIL_APP_PASSWORD set, this logs instead of sending so
// local dev doesn't need them configured, mirroring how GoogleConfiguredGuard
// degrades gracefully when Google OAuth credentials are missing.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string | undefined;

  constructor(private configService: ConfigService) {
    const user = this.configService.get<string>('GMAIL_USER');
    const pass = this.configService.get<string>('GMAIL_APP_PASSWORD');
    this.fromAddress = user;
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
      this.logger.warn(
        'GMAIL_USER/GMAIL_APP_PASSWORD not set — password-reset emails will be logged, not sent.',
      );
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `[email not configured] Would have sent "${subject}" to ${to}`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({
        from: `Geo Ranao <${this.fromAddress}>`,
        to,
        subject,
        html,
      });
    } catch (err) {
      // Swallowed deliberately — the caller (AuthService.requestPasswordReset)
      // must always return the same generic response whether or not the
      // email actually went out, so a transient SMTP failure here can't
      // become a side channel for guessing which emails have accounts.
      this.logger.error(
        `Failed to send email to ${to}: ${(err as Error).message}`,
      );
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send(
      to,
      'Reset your Geo Ranao password',
      `<p>We received a request to reset the password for your Geo Ranao account.</p>
       <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 30 minutes.</p>
       <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    );
  }

  async sendGoogleOnlyNotice(to: string): Promise<void> {
    await this.send(
      to,
      'About your Geo Ranao account',
      `<p>We received a password-reset request for this email, but this account signs in with
       Google and has no password to reset.</p>
       <p>Please use the "Sign in with Google" button on the login page instead.</p>`,
    );
  }
}
