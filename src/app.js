import express from 'express';
import bodyParser from 'body-parser';
import xmlparser from 'express-xml-bodyparser';
import runMiddleware from 'run-middleware';
import mfLogger from 'mf-logger';
import { loggingLevel, appName, cron, basePath, nodeEnv } from 'config';
import 'isomorphic-fetch';
import updateRTBFStatus from './controllers/updateRTBFStatus';
import salesforce from './controllers/salesforce';
import navMiddleware from './lib/nav-middleware';
import { saleforcePull, reminderJob, counterJob, saleforceCompleteJob } from './lib/cron-setup';

const loggerOptions = {
  env: nodeEnv,
  logger: {
    isEnabled: true,
    level: loggingLevel,
    appName,
    logStash: {
      isEnabled: false,
    },
  },
  dataDog: {
    isEnabled: false,
  },
};

mfLogger.configure(loggerOptions);

const xml2jsDefaults = {
  explicitArray: false,
  normalize: false,
  normalizeTags: false,
  trim: true,
};

xmlparser.regexp = /^application\/xml$/i; // TODO: what does NAV send text/xml or application/xml

const app = express();
runMiddleware(app);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(xmlparser(xml2jsDefaults));
app.use(navMiddleware);

const router = express.Router();

// Right To Be Forgotten
router.post('/v1/updateRTBFStatus', updateRTBFStatus.POST);
router.post('/v1/sendIndividualInitialisation', salesforce.POST);
router.post('/v1/sendIndividualCompletions', salesforce.POSTComplete);

router.get('/', (req, res) => {
  res.json({ message: 'welcome to GDPR!' });
});

app.use(`${basePath}/api`, router);


saleforcePull(app, cron.salesforcePull);
reminderJob(cron.reminderJob);
counterJob(cron.counterJob);
saleforceCompleteJob(app, cron.salesforceCompletedPull);

export default app;
