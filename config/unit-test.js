const crypto = require('matches-crypto');

const key = process.env.encryptionKey;

module.exports = {
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
    counterJob: {
      isEnforcementEnabled: true,
    },
  },
  mail: {
    from: 'gdprunittester@somecompany.com',
    to: 'gdprunittester@somecompany.com',
  },
};
