import { CronJob } from 'cron';
import mfLogger from 'mf-logger';
import sf from '../systems/salesforce';
import reminder from './reminderJob';
import count from './count-job';

const TIMEZONE = 'Europe/London';

export const saleforcePull = (app, cronSettings) => {
  if (!cronSettings.isEnable) {
    return;
  }

  new CronJob(cronSettings.schedule, () => {
    mfLogger.info('Pulling anonymization requests from salesforce');

    sf.pullRightToBeForgottenRequestsFromSalesforce()
      .then((data) => {
        const newAnonRequests = data.NewRTBFRequests;
        mfLogger.info(`${newAnonRequests.length} anonymisation requests found in salesforce`);

        if (newAnonRequests.length <= 0) {
          mfLogger.info('nothing to do');
          return;
        }

        app.runMiddleware('/gdpr/api/v1/sendIndividualInitialisation', {
          method: 'post',
          body: newAnonRequests,
        }, (code, body) => {
          mfLogger.info(`POST Individual Initialisation Request - result:${body}`);
        });
      })
      .catch(err => {
        /**
         * @todo
         */
      });
  }, null, true, TIMEZONE);
};

export const reminderJob = (cronSettings) => {
  if (!cronSettings.isEnable) {
    return;
  }

  new CronJob(cronSettings.schedule, () => {
    mfLogger.info('Executing reminder job');
    reminder(cronSettings);
  }, null, true, TIMEZONE);
};

export const counterJob = (cronSettings) => {
  if (!cronSettings.isEnable) {
    return;
  }

  new CronJob(cronSettings.schedule, () => {
    mfLogger.info('Executing count job');

    count(cronSettings);
  }, null, true, TIMEZONE);
};

export const saleforceCompleteJob = (app, cronSettings) => {
  if (!cronSettings.isEnable) {
    return;
  }

  new CronJob(cronSettings.schedule, () => {
    sf.pullCompletedJobsFromSalesforce()
      .then((data) => {
        const completedRequests = data.CompletedRTBFRequests;
        mfLogger.info(`${completedRequests.length} completed requests found in salesforce`);

        if (completedRequests.length <= 0) {
          mfLogger.info('nothing to do');
          return;
        }

        app.runMiddleware('/gdpr/api/v1/sendIndividualCompletions', {
          method: 'post',
          body: completedRequests,
        }, (code, body) => {
          mfLogger.info(`POST Individual Completion Request - result:${body}`);
        });
      });
  }, null, true, TIMEZONE);
};
