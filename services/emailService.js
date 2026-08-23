const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@society-maintenance.com';

let transporter = null;

// Initialize transporter if host & credentials exist
if (SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_HOST !== 'smtp.example.com') {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  } catch (err) {
    console.warn(`[EMAIL SERVICE] Failed initializing SMTP transporter: ${err.message}`);
  }
}

/**
 * Generic email sending function with safe fallback
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to) return false;

  const mailOptions = {
    from: `Society Maintenance Tracker <${FROM_EMAIL}>`,
    to,
    subject,
    text,
    html: html || `<p>${text.replace(/\n/g, '<br>')}</p>`
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EMAIL SENT] To: ${to} | Subject: "${subject}" | MessageID: ${info.messageId}`);
      return true;
    } catch (err) {
      console.warn(`[EMAIL WARNING] Failed sending email to ${to}: ${err.message}. (Server request continues safely)`);
      return false;
    }
  } else {
    // Development Mode Console Log Preview (No crash if SMTP unavailable)
    console.log(`=======================================================`);
    console.log(`[EMAIL DEV PREVIEW / MOCK LOG]`);
    console.log(` -> To: ${to}`);
    console.log(` -> Subject: ${subject}`);
    console.log(` -> Body:\n${text}`);
    console.log(`=======================================================`);
    return true;
  }
}

/**
 * Trigger email notification on Complaint Status Change
 */
async function notifyComplaintStatusChange({ residentEmail, residentName, complaintNumber, category, oldStatus, newStatus, note }) {
  const nameStr = residentName || 'Resident';
  const subject = `Complaint ${complaintNumber} Status Updated`;

  const text = `Hello ${nameStr},

Your maintenance complaint ${complaintNumber} regarding ${category || 'General'} has been updated.

Previous Status: ${oldStatus}
New Status: ${newStatus}
${note ? `Note: ${note}` : ''}

Please log in to Society Maintenance Tracker to view the complete complaint history.

Best regards,
Society Maintenance Office`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #2563eb; margin-top: 0;">🏢 Society Maintenance Tracker</h2>
      <p>Hello <strong>${nameStr}</strong>,</p>
      <p>Your maintenance complaint <strong>${complaintNumber}</strong> regarding <strong>${category || 'General'}</strong> has been updated by the Admin team.</p>

      <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>Previous Status:</strong> ${oldStatus}</p>
        <p style="margin: 4px 0;"><strong>New Status:</strong> <span style="color: #059669; font-weight: bold;">${newStatus}</span></p>
        ${note ? `<p style="margin: 4px 0; font-style: italic; color: #475569;"><strong>Admin Note:</strong> "${note}"</p>` : ''}
      </div>

      <p>Please log in to your account to inspect the full timeline history.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b;">This is an automated notification from your Apartment Society Management system.</p>
    </div>
  `;

  return sendEmail({ to: residentEmail, subject, text, html });
}

/**
 * Broadcast email notification to residents when an Important Notice is published
 */
async function notifyImportantNotice(residentEmails, noticeTitle, noticeContent, noticeDate) {
  if (!Array.isArray(residentEmails) || residentEmails.length === 0) return;

  const subject = `📌 [IMPORTANT NOTICE] ${noticeTitle}`;
  const text = `Important Society Notice:

Title: ${noticeTitle}
Date: ${noticeDate || new Date().toLocaleDateString()}

Content:
${noticeContent}

Please check the Resident Notice Board for updates.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 2px solid #dc2626; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #dc2626; margin-top: 0;">📌 Important Society Notice</h2>
      <h3 style="color: #0f172a; margin-bottom: 8px;">${noticeTitle}</h3>
      <p style="font-size: 12px; color: #64748b; margin-top: 0;">Published: ${noticeDate || new Date().toLocaleString()}</p>

      <div style="background-color: #fef2f2; padding: 16px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 20px 0; white-space: pre-line; color: #374151;">
        ${noticeContent}
      </div>

      <p style="font-size: 13px; color: #475569;">You are receiving this email because this announcement was marked as <strong>Important</strong> by Society Management.</p>
    </div>
  `;

  for (const email of residentEmails) {
    await sendEmail({ to: email, subject, text, html });
  }
}

module.exports = {
  sendEmail,
  notifyComplaintStatusChange,
  notifyImportantNotice
};
