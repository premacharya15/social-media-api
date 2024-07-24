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

export const sendOTPEmail = async (email, otp, subject = "OTP Verification", message = "Here is your OTP:") => {
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
    subject: subject,
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
          <h2>${subject}</h2>
          <p>${message}</p>
          <div class="otp">${otp}</div>
          <div class="validity">Valid for 5 minutes only</div>
        </div>
      </div>
    </body>
    </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};