
export const waitlistTemplate = ({name}) => {
    return `
        <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">

            <h2 style="color: #007BFF;">Hello ${name},</h2>

            <p>Thank you for joining the waitlist for Chapter Dev! We are excited to have you on board.</p>
            <p>We will keep you updated on our progress and notify you as soon as we are ready to launch. In the meantime, feel free to explore our website and follow us on social media for the latest news and updates.</p>
            
            <p>Best regards,<br>The Chapter Dev Team</p>
        </div>
    `;
}