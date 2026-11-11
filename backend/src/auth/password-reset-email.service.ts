import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class PasswordResetEmailService {
  constructor(private readonly configService: ConfigService) {}

  async send(to: string, fullName: string, resetUrl: string) {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    const from = this.configService.getOrThrow<string>('RESEND_FROM_EMAIL');
    const resend = new Resend(apiKey);
    const safeName = this.escapeHtml(fullName);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: 'Reset your DormEase password',
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:32px">
          <h1 style="color:#1d4ed8;margin-bottom:24px">DormEase</h1>
          <p>Hello ${safeName},</p>
          <p>We received a request to reset the password for your DormEase account.</p>
          <p style="margin:32px 0">
            <a href="${resetUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:600">Reset Password</a>
          </p>
          <p>This link expires in 20 minutes and can only be used once.</p>
          <p>If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
          <p style="color:#64748b;font-size:13px;margin-top:32px">DormEase — Dormitory management, simplified.</p>
        </div>
      `,
      text: [
        'DormEase password reset',
        '',
        `Hello ${fullName},`,
        'We received a request to reset the password for your DormEase account.',
        `Reset your password: ${resetUrl}`,
        '',
        'This link expires in 20 minutes and can only be used once.',
        'If you did not request a password reset, you can safely ignore this email.',
      ].join('\n'),
    });

    if (error) {
      throw new Error('Resend rejected the password reset email');
    }
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  }
}
