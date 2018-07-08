import config from 'config';
import mongoose from 'mongoose';
import mfLogger from 'mf-logger';
import { Mockgoose } from 'mockgoose';

const { URI, options } = config.db;

mongoose.Promise = global.Promise;
mongoose.set('debug', process.env.DEBUG === true);

/**
 * Actual connection for server
 */
const openRealConnection = () => new Promise((resolve, reject) =>
  mongoose.connect(URI, options, (err) => {
    if (err) {
      mfLogger.error(`Failed to connect to mongo with error ${err.message}`);
      return reject(err);
    }
    mfLogger.info('Connected to mongodb OK!');
    return resolve();
  }),
);

/**
 * Fake connection for unit-testing
 */
const openFake = () => new Promise(async (resolve, reject) => {
  const mockgoose = new Mockgoose(mongoose);
  await mockgoose.prepareStorage();
  mongoose.connect(URI, options, (err, res) => {
    if (err) return reject(err);
    resolve();
  });
});

/**
 * Close opened connection
 */
const close = () => mongoose.disconnect();


let open = openRealConnection;
if (process.env.NODE_ENV === 'unit-test') {
  open = openFake;
}

export {
  close,
  open,
};
