import nodemailer from 'nodemailer';
import config from 'config';
import mfLogger from 'mf-logger';

const transporter = nodemailer.createTransport(config.smtpServer);

// for testing only
// const transporter = nodemailer.createTransport({
//   host: 'smtp.ethereal.email',
//   port: 587,
//   auth: {
//     user: 'nhorrbxygdpnlx6v@ethereal.email',
//     pass: 'VRw5zQPfgek73Jttaw',
//   },
// });

const getHtmlBody = (response) => {
  if (response.customerEmailAddress) {
    delete response.customerEmailAddress;
  }
  const propsHtml = Object.keys(response).join('</br>');

  return `<b>${response.system} failed to respond or responded with and error</b>
    <br/><b>Anonymization request information:</b> 
    <br/><b>Error Status Code: ${response.errorCode}</b> 
    <br/>Error Description: ${response.errorDescription}</b> 
    <br/>SalesForceRequestId: ${response.salesForceRequestId}</b> 
    <br/><br/>${propsHtml}`;
};

const sendEmail = (html, subject) => {
  const mailOptions = {
    from: config.mail.from,
    to: config.mail.to,
    subject,
    html,
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      mfLogger.error(`Error sending email ${err}`);
      return;
    }
    mfLogger.info('Email sent');
  });
};

export default {
  sendNotification: (response) => {
    const htmlResponse = getHtmlBody(response);

    mfLogger.info(response);
    sendEmail(htmlResponse, 'GDPR coordinator - notification');
  },

  sendErrorNotification: (err) => {
    let htmlResponse = err;
    if (err instanceof Error) {
      htmlResponse = `${err.message} ${err.stack}`;
    }

    sendEmail(htmlResponse, 'GDPR coordinator - Error notification');
  },

  sendReminderNotification: (jobDetails, numberOfDaysWithoutChangeAllowed) => {
    const htmlResponse = `GDPR Report:
    <br/>The following jobs have not been updated in ${numberOfDaysWithoutChangeAllowed} days
    <br/><br/>
    ${jobDetails}`;
    sendEmail(htmlResponse, 'GDPR coordinator - Reminder notification');
  },
};
