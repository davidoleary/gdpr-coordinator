const crypto = require('matches-crypto');

const key = process.env.encryptionKey;

module.exports = {
  db: {
    URI: '',
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
      schedule: '00 */15 * * * *',
      isEnable: false,
    },
  },
  mail: {
    from: 'gdprunittester@somecompany.com',
    to: 'gdprunittester@somecompany.com',
  },
};
