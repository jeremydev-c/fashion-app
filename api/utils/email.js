const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Fashion Fit <noreply@oldhousenanyuki.co.ke>';

/**
 * Send verification code email
 */
async function sendVerificationEmail(to, code, name) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Verify your Fashion Fit account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #050816; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #050816; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="background-color: #0f172a; border-radius: 16px; padding: 40px; max-width: 500px;">
                  <!-- Logo -->
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #ff6b9c, #7f5dff); border-radius: 30px; display: inline-flex; align-items: center; justify-content: center;">
                        <span style="font-size: 28px;">✨</span>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Title -->
                  <tr>
                    <td align="center" style="padding-bottom: 8px;">
                      <h1 style="margin: 0; color: #f9fafb; font-size: 24px; font-weight: 600;">
                        Verify your email
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Subtitle -->
                  <tr>
                    <td align="center" style="padding-bottom: 32px;">
                      <p style="margin: 0; color: #9ca3af; font-size: 16px;">
                        Hi ${name}, enter this code to complete your signup
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Code -->
                  <tr>
                    <td align="center" style="padding-bottom: 32px;">
                      <div style="background-color: #1e293b; border: 2px solid #ff6b9c; border-radius: 12px; padding: 20px 40px; display: inline-block;">
                        <span style="font-size: 36px; font-weight: 700; color: #ff6b9c; letter-spacing: 8px;">
                          ${code}
                        </span>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Expiry -->
                  <tr>
                    <td align="center" style="padding-bottom: 32px;">
                      <p style="margin: 0; color: #6b7280; font-size: 14px;">
                        This code expires in <strong style="color: #9ca3af;">10 minutes</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="border-top: 1px solid #1e293b; padding-top: 24px;">
                      <p style="margin: 0; color: #6b7280; font-size: 12px;">
                        If you didn't request this code, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
                
                <!-- Brand footer -->
                <table width="100%" max-width="500" cellpadding="0" cellspacing="0" style="max-width: 500px; padding-top: 24px;">
                  <tr>
                    <td align="center">
                      <p style="margin: 0; color: #4b5563; font-size: 12px;">
                        Fashion Fit — Your AI Style Assistant
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error };
    }

    console.log('✅ Verification email sent:', data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

/**
 * Generate 6-digit verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { sendVerificationEmail, generateVerificationCode };

