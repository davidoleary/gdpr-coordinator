const config = require('config');
const mfLogger = require('mf-logger');
const conn = require('./lib/lib/mongodb-connect');
const app = require('./lib/app').default;

conn.open().then(function() {
  app.listen(config.port, function() {
    mfLogger.info(`NodeEnv ${config.nodeEnv}`);
    mfLogger.info(`App listening at http://localhost:${config.port}`);
  });
}).catch(function(err) {
  mfLogger.error(err);
});
