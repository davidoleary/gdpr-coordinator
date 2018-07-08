const crypto = require('matches-crypto');

const key = process.env.encryptionKey;

module.exports = {
  db: {
    URI: 'mongodb://localhost/GDPR-coordinator',
  },
  systemEndPoints: {
    nav: {
      endpoint: '',
    },
    hybris: {
      endpoint: '',
      username: crypto.decrypt('', key),
      password: crypto.decrypt('', key),
    },
    bi: {
      mssqlServer: '',
      mssqlDomain: '',
      user: crypto.decrypt('', key),
      password: crypto.decrypt('', key),
    },
    esb: {
      endpoint: '',
    },
    salesforce: {
      endpoint: '',
      username: crypto.decrypt('', key),
      password: crypto.decrypt('', key),
    },
  },
  cron: {
    salesforcePull: {
      schedule: '00 */1 * * * *',
      isEnable: true,
    },
  },
  mail: {
    from: 'gdprunittester@somecompany.com',
    to: 'gdprunittester@somecompany.com',
  },
};
