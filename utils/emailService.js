const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOtpEmail = async (email, otp) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'TerraConnection <onboarding@resend.dev>', // Use your domain or resend.dev for testing
            to: email,
            subject: 'TerraConnection Login Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Login Verification Code</h2>
                    <p>Your verification code for TerraConnection is:</p>
                    <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px;">
                        ${otp}
                    </div>
                    <p style="color: #666;">This code will expire in 5 minutes.</p>
                    <p style="color: #999; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
                </div>
            `
        });

        if (error) {
            console.error('❌ Resend error:', error);
            return false;
        }

        console.log('✅ Email sent successfully:', data.id);
        return true;
    } catch (error) {
        console.error('❌ Error sending OTP email:', error);
        return false;
    }
};

module.exports = {
    sendOtpEmail
};