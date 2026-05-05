import nodemailer from 'nodemailer';
import WaitlistUsers from '../models/WaitlistUsers.js';
import { waitlistTemplate } from '../templates/waitlist.js';
import { configDotenv } from 'dotenv';
configDotenv();

const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.SMTP_USERNAME,
//     pass: process.env.SMTP_PASSWORD,
//   },
// });

export const handleEmail = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    if (!validateEmail(email)) {
      return res.status(401).json({ error: 'Invalid email format' });
    }

    const newUser = new WaitlistUsers({ 
      name: name.trim(), 
      email: email.toLowerCase().trim() 
    });
    await newUser.save();

    // // Send email
    //  transporter.sendMail({ 
    //   from: process.env.SMTP_USERNAME,
    //   to: newUser.email,
    //   subject: 'Welcome to Chapter Dev Waitlist!',
    //   html: waitlistTemplate({ name: newUser.name }),
    // });

    console.log(`Waitlist user added and email sent: ${newUser.email}`);
    res.json({ message: 'Joined waitlist successfully!', email: newUser.email });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists in waitlist' });
    }
    console.error('Error handling email:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

