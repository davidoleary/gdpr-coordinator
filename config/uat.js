const crypto = require('matches-crypto');

const key = process.env.encryptionKey;

module.exports = {
  db: {
    URI: '',
    options: {
      useMongoClient: true,
      user: crypto.decrypt('', key),
      pass: crypto.decrypt('', key),
      server: {
        ssl: true,
        autoReconnect: true,
        socketOptions: {
          keepAlive: 1,
        },
      },
    },
  },
  systemEndPoints: {
    nav: {
      endpoint: '',
    },
    hybris: {
      endpoint: '',
      username: '',
      password: '',
    },
    bi: {
      mssqlServer: '',
      mssqlDomain: '',
      user: '',
      password: '',
    },
    esb: {
      endpoint: '',
    },
    salesforce: {
      endpoint: '',
      username: '',
      password: '',
    },
  },
  cron: {
    salesforcePull: {
      schedule: '',
      isEnable: false,
    },
  },
  mail: {
    from: 'gdprunittester@somecompany.com',
    to: 'gdprunittester@somecompany.com',
  },
};
