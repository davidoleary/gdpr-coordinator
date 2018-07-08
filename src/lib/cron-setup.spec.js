import cron from 'cron';
import sinon from 'sinon';
import { saleforcePull, reminderJob, counterJob, saleforceCompleteJob } from './cron-setup';
import sf from '../systems/salesforce';
import * as reminder from '../lib/reminderJob';
import * as count from '../lib/count-job';

describe('Pull new RTBF requests from salesforce', () => {
  let pullRightToBeForgottenRequestsFromSalesforceStub;
  let cronJobStub;

  beforeEach((done) => {
    const dummyPromise = Promise.resolve({ NewRTBFRequests: [{
      salesForceRequestId: '1234',
    }] });
    pullRightToBeForgottenRequestsFromSalesforceStub = sinon.stub(sf, 'pullRightToBeForgottenRequestsFromSalesforce')
    .returns(dummyPromise);
    cronJobStub = sinon.stub(cron, 'CronJob').yields(null);
    done();
  });

  afterEach((done) => {
    cronJobStub.restore();
    pullRightToBeForgottenRequestsFromSalesforceStub.restore();
    done();
  });

  it('schedules pulls from saleforce', () => {
    const app = {
    };
    const settings = {
      isEnable: true,
    };

    saleforcePull(app, settings);
    sinon.assert.calledOnce(cronJobStub);
    sinon.assert.calledOnce(pullRightToBeForgottenRequestsFromSalesforceStub);
  });
});

describe('Reminder job', () => {
  let cronJobStub;
  let reminderSpy;
  beforeEach((done) => {
    cronJobStub = sinon.stub(cron, 'CronJob').yields(null);
    reminderSpy = sinon.spy(reminder, 'default');
    done();
  });

  afterEach((done) => {
    cronJobStub.restore();
    done();
  });
  it('schedules pulls from saleforce', () => {
    const settings = {
      isEnable: true,
    };

    reminderJob(settings);
    sinon.assert.calledOnce(cronJobStub);
    sinon.assert.calledOnce(reminderSpy);
  });
});

describe('Count job', () => {
  let cronJobStub;
  let countSpy;
  beforeEach((done) => {
    cronJobStub = sinon.stub(cron, 'CronJob').yields(null);
    countSpy = sinon.spy(count, 'default');
    done();
  });

  afterEach((done) => {
    cronJobStub.restore();
    done();
  });

  it('schedules reset of the processed request count', () => {
    const settings = {
      isEnable: true,
    };

    counterJob(settings);
    sinon.assert.calledOnce(cronJobStub);
    sinon.assert.calledOnce(countSpy);
  });
});

describe('pullCompleted job', () => {
  let cronJobStub;
  beforeEach((done) => {
    cronJobStub = sinon.stub(cron, 'CronJob').yields(null);
    done();
  });

  afterEach((done) => {
    cronJobStub.restore();
    done();
  });

  it('schedules reset of the processed request count', () => {
    const app = {};
    const settings = {
      isEnable: true,
    };

    saleforceCompleteJob(app, settings);
    sinon.assert.calledOnce(cronJobStub);
  });
});

describe('Pull completed RTBF requests from salesforce', () => {
  let pullCompletedRightToBeForgottenRequestsFromSalesforceStub;
  let cronJobStub;

  beforeEach((done) => {
    const dummyPromise = Promise.resolve({
      CompletedRTBFRequests: [{
        salesForceRequestId: '4321',
      }],
    });
    pullCompletedRightToBeForgottenRequestsFromSalesforceStub = sinon.stub(sf, 'pullCompletedJobsFromSalesforce')
      .returns(dummyPromise);
    cronJobStub = sinon.stub(cron, 'CronJob').yields(null);
    done();
  });

  afterEach((done) => {
    cronJobStub.restore();
    pullCompletedRightToBeForgottenRequestsFromSalesforceStub.restore();
    done();
  });

  it('schedules pulls from saleforce', () => {
    const app = {
    };
    const settings = {
      isEnable: true,
    };

    saleforceCompleteJob(app, settings);
    sinon.assert.calledOnce(cronJobStub);
    sinon.assert.calledOnce(pullCompletedRightToBeForgottenRequestsFromSalesforceStub);
  });
});
