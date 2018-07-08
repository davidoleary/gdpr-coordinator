module.exports = {
  port: 3019,
  nodeEnv: process.env.NODE_ENV,
  loggingLevel: 'info',
  appName: 'gdpr-coordinator',
  basePath: '/gdpr',
  ntlmProxy: 'http://127.0.0.1:5865',
  smtpServer: 'smtp://localhost',
  db: {
    URI: 'mongodb://localhost/GDPR-coordinator',
    options: {
      useMongoClient: true,
    },
  },
  cron: {
    salesforcePull: {
      schedule: '00 */15 * * * *',
      isEnable: false,
    },
    salesforceCompletedPull: {
      schedule: '00 */15 * * * *',
      isEnable: 'nope',
    },
    reminderJob: {
      schedule: '00 0 8 * * *',
      isEnable: false,
      numberOfDaysWithoutChangeAllowed: 3,
    },
    counterJob: {
      schedule: '00 0 7 * * *',
      isEnable: false,
      numberOfRequestsAllowed: 2,
      isEnforcementEnabled: false,
    },
  },
  systemEndPoints: {
    bi: {
      database: '',
    },
  },
  mail: {
    from: 'gdprunittester@somecompany.com',
    to: 'gdprunittester@somecompany.com',
  },
};
