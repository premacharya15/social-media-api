import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";

export const generateOTP = () => {
  return otpGenerator.generate(4, {
    digits: true,
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
};

export const sendOTPEmail = async (email, otp) => {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  let mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Your OTP Code",
    html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f2f2f2; margin: 0; padding: 0; }
        .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 10px 10px 10px 0px; border: 1px solid #dddddd; border-radius: 5px; }
        .content { text-align: center; padding: 30px 20px; }
        .content img { max-width: 100%; height: auto; margin-bottom: 40px; }
        .content h2 { font-size: 24px; color: #333333; margin: 0 0 20px 0; }
        .content p { font-size: 16px; color: #666666; margin: 0 0 20px 0; }
        .otp { font-size: 36px; font-weight: bold; color: #333333; margin: 0 0 20px 0; }
        .validity { font-size: 14px; color: #ff0000; margin: 0 0 40px 0; }
    
        @media only screen and (max-width: 768px) {
          .container {
            padding: 10px 5px;
          }
          .content {
            padding: 20px 10px;
          }
          .content h2 {
            font-size: 20px;
            margin: 0 0 15px 0;
          }
          .content p {
            font-size: 14px;
            margin: 0 0 15px 0;
          }
          .otp {
            font-size: 30px;
            margin: 0 0 15px 0;
          }
          .validity {
            font-size: 12px;
            margin: 0 0 30px 0;
          }
        }
    
        @media only screen and (max-width: 480px) {
          .container {
            padding: 5px 5px 5px 0px;
          }
          .content {
            padding: 15px 5px;
          }
          .content img {
            max-width: 70px;
            margin-bottom: 10px;
          }
          .content h2 {
            font-size: 18px;
            margin: 0 0 10px 0;
          }
          .content p {
            font-size: 12px;
            margin: 0 0 10px 0;
          }
          .otp {
            font-size: 26px;
            margin: 0 0 10px 0;
          }
          .validity {
            font-size: 10px;
            margin: 0 0 20px 0;
          }
        }
    
        @media only screen and (max-width: 320px) {
          .container {
            padding: 3px 3px 3px 0px;
          }
          .content {
            padding: 10px 3px;
          }
          .content img {
            max-width: 50px;
            margin-bottom: 5px;
          }
          .content h2 {
            font-size: 16px;
            margin: 0 0 5px 0;
          }
          .content p {
            font-size: 10px;
            margin: 0 0 5px 0;
          }
          .otp {
            font-size: 20px;
            margin: 0 0 5px 0;
          }
          .validity {
            font-size: 8px;
            margin: 0 0 10px 0;
          }
        }
    
        @media only screen and (max-width: 150px) {
          .container {
            padding: 1px 1px 1px 0px;
          }
          .content {
            padding: 5px 1px;
          }
          .content img {
            max-width: 30px;
            margin-bottom: 3px;
          }
          .content h2 {
            font-size: 12px;
            margin: 0 0 3px 0;
          }
          .content p {
            font-size: 8px;
            margin: 0 0 3px 0;
          }
          .otp {
            font-size: 16px;
            margin: 0 0 3px 0;
          }
          .validity {
            font-size: 6px;
            margin: 0 0 5px 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <img src="https://lh3.googleusercontent.com/u/0/drive-viewer/AKGpihbgrHP0syyhJ7-tGWJUDN6embcKtJMcfb_o9Aj1Qv53QUzaj8s7rcGnVWokFbOFav_MuAsLs4QcurMuSP-ItrByp1N_8nNzfLA=w1920-h912" alt="company logo">
          <h2>Here is your One Time Password</h2>
          <p>to validate your email address</p>
          <div class="otp">${otp}</div>
          <div class="validity">Valid for 10 minutes only</div>
        </div>
      </div>
    </body>
    </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendResetEmail = async (email, resetLink) => {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  let mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Password Reset Request",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f2f2f2; margin: 0; padding: 0; }
          .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border: 1px solid #dddddd; border-radius: 5px; }
          .header { text-align: center; padding: 10px 0; }
          .header img { max-width: 150px; }
          .content { text-align: center; padding: 20px; }
          .content h1 { font-size: 24px; color: #333333; }
          .content p { font-size: 16px; color: #666666; }
          .button { display: inline-block; padding: 10px 20px; font-size: 16px; background-color: #007BFF; border-radius: 5px; text-decoration: none; }
          .footer { text-align: center; padding: 10px 0; font-size: 12px; color: #999999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://lh3.googleusercontent.com/u/0/drive-viewer/AKGpihbgrHP0syyhJ7-tGWJUDN6embcKtJMcfb_o9Aj1Qv53QUzaj8s7rcGnVWokFbOFav_MuAsLs4QcurMuSP-ItrByp1N_8nNzfLA=w1920-h912" alt="Company Logo">
          </div>
          <div class="content">
            <h1>Password Reset</h1>
            <p>If you've lost your password or wish to reset it, use the link below to get started.</p>
            <a href="${resetLink}" class="button" style="color: #ffffff !important;">Reset Your Password</a>
          </div>
          <div class="footer">
            <p>If you did not request a password reset, you can safely ignore this email. Only a person with access to your email can reset your account password.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};
