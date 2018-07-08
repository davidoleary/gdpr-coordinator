import 'isomorphic-fetch';
import fetchMock from 'fetch-mock';
import { expect } from 'chai';
import sinon from 'sinon';
import jsforce from 'jsforce';
import mongoose from 'mongoose';
import { Mockgoose } from 'mockgoose';
import AuditLog from '../models/audit-log';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';
import notifier from '../helpers/notifier';
import { open } from '../lib/mongodb-connect';
import salesforce from './salesforce';

const mockgoose = new Mockgoose(mongoose);

const checkValidBody = (result) => {
  const salesForceRequestId = result.CompletedRTBFAcknowledgments[0].salesForceRequestId;
  if (salesForceRequestId !== 'SF12345') {
    return false;
  }
  if (result.CompletedRTBFAcknowledgments[0].status !== WORKFLOW_STATUSES.COMPLETED) {
    return false;
  }
  return true;
};

const checkErrorBody = (result) => {
  const salesForceRequestId = result.CompletedRTBFAcknowledgments[0].salesForceRequestId;
  if (salesForceRequestId !== 'SF56789') {
    return false;
  }
  if (result.CompletedRTBFAcknowledgments[0].status !== 'Error') {
    return false;
  }

  if (result.CompletedRTBFAcknowledgments[0].message !== 'Invalid request - not processed') {
    return false;
  }
  return true;
};

// TODO: refactor tor reduce duplication
describe('Pull request from salesforce', () => {
  describe('Salesforce Login', () => {
    let loginStub;
    let getStub;
    let jsforceStub;
    let apexStub;
    let sendErrorNotificationStub;

    beforeEach((done) => {
      sendErrorNotificationStub = sinon.stub(notifier, 'sendErrorNotification');
      getStub = sinon.stub().yields(undefined, 'done');
      apexStub = {
        get: getStub,
      };
      loginStub = sinon.stub().yields('fake connection error', {
        conn: {
          apex: {
            get: getStub,
          },
        },
        userInfo: {},
      });
      jsforceStub = sinon.stub(jsforce, 'Connection').returns({
        apex: apexStub,
        login: loginStub,
      });
      done();
    });

    afterEach((done) => {
      jsforceStub.restore();
      sendErrorNotificationStub.restore();
      done();
    });

    it('failure sends notification email', async () => {
      try {
        await salesforce.pullRightToBeForgottenRequestsFromSalesforce();
      } catch (err) {
        sinon.assert.calledOnce(sendErrorNotificationStub);
      }
    });
  });

  describe('pullRightToBeForgottenRequestsFromSalesforce', () => {
    let loginStub;
    let getStub;
    let jsforceStub;
    let apexStub;

    beforeEach((done) => {
      getStub = sinon.stub().yields(undefined, 'done');
      apexStub = {
        get: getStub,
      };
      loginStub = sinon.stub().yields(undefined, {
        conn: {
          apex: {
            get: getStub,
          },
        },
        userInfo: {},
      });
      jsforceStub = sinon.stub(jsforce, 'Connection').returns({
        apex: apexStub,
        login: loginStub,
      });
      done();
    });

    afterEach((done) => {
      jsforceStub.restore();
      done();
    });

    it('gets new jobs from salesforce', async () => {
      await salesforce.pullRightToBeForgottenRequestsFromSalesforce();
      sinon.assert.calledWith(getStub, '/NewRTBFRequests');
    });

    it('get completed jobs from salesforce', async () => {
      await salesforce.pullCompletedJobsFromSalesforce();
      sinon.assert.calledWith(getStub, '/CompletedRTBFRequests');
    });
  });

  describe('acknowledgeCompletionWithSalesforce', () => {
    let loginStub;
    let postStub;
    let jsforceStub;
    beforeEach((done) => {
      postStub = sinon.stub().yields(undefined, 'done');
      loginStub = sinon.stub().yields(undefined, {
        conn: {
          apex: {
            post: postStub,
          },
        },
        userInfo: {},
      });
      jsforceStub = sinon.stub(jsforce, 'Connection').returns({
        apex: {
          post: postStub,
        },
        login: loginStub,
      });
      done();
    });

    afterEach((done) => {
      jsforceStub.restore();
      done();
    });

    it('tells salesforce when node has proccessed PROCESSED_IN_SALESFORCE request', async () => {
      const response = {
        salesForceRequestId: 'SF12345',
        status: WORKFLOW_STATUSES.COMPLETED,
      };

      await salesforce.acknowledgeCompletionWithSalesforce(response);
      sinon.assert.calledWith(postStub, '/CompletedRTBFAcknowledgments', sinon.match(checkValidBody));
    });

    it('tells salesforce when PROCESSED_IN_SALESFORCE processin has failed', async () => {
      const response = {
        salesForceRequestId: 'SF56789',
        error: {
          message: 'Invalid request - not processed',
        },
      };

      await salesforce.acknowledgeCompletionWithSalesforce(response);
      sinon.assert.calledWith(postStub, '/CompletedRTBFAcknowledgments', sinon.match(checkErrorBody));
    });
  });

  describe('acknowledgeInitialisationFromSalesforce', () => {
    let loginStub;
    let postStub;
    let jsforceStub;
    beforeEach((done) => {
      postStub = sinon.stub().yields(undefined, 'done');
      loginStub = sinon.stub().yields(undefined, {
        conn: {
          apex: {
            post: postStub,
          },
        },
        userInfo: {},
      });
      jsforceStub = sinon.stub(jsforce, 'Connection').returns({
        apex: {
          post: postStub,
        },
        login: loginStub,
      });
      done();
    });

    afterEach((done) => {
      jsforceStub.restore();
      done();
    });

    it('tells salesforce when a job has passed', async () => {
      const responses = [{
        salesForceRequestId: 'SF12345',
        status: 'ACKNOWLEDGED',
      }];

      await salesforce.acknowledgeInitialisationFromSalesforce(responses);
      sinon.assert.calledWith(postStub, '/RTBFRequestAcknowledgements');
    });

    it('tells salesforce when a job has failed', async () => {
      const responses = [{
        salesForceRequestId: 'SF54321',
        status: 'Error',
        message: 'Invalid request - not processed',
      }];

      await salesforce.acknowledgeInitialisationFromSalesforce(responses);
      sinon.assert.calledWith(postStub, '/RTBFRequestAcknowledgements');
    });
  });

  describe('salesforce execute', () => {
    let sendNotificationStub;
    let sendErrorNotificationStub;
    before(async () => {
      await open();
    });

    let loginStub;
    let postStub;
    let jsforceStub;
    beforeEach(async () => {
      mockgoose.helper.reset();
      sendNotificationStub = sinon.stub(notifier, 'sendNotification');
      sendErrorNotificationStub = sinon.stub(notifier, 'sendErrorNotification');

      const details = {
        sequenceId: 1,
        salesForceRequestId: 'R100SALESFORCE',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        system: SYSTEMS.SALESFORCE,
        workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_ESB,
        nodeAppStatus: helpers.IN_PROGRESS,
        logTime: Date.now(),
        remainingDays: 3,
        actionDescription: 'Something happening',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      };

      const auditInstance = new AuditLog(details);
      await auditInstance.save();
    });

    afterEach((done) => {
      jsforceStub.restore();
      fetchMock.restore();
      sendNotificationStub.restore();
      sendErrorNotificationStub.restore();
      mockgoose.helper.reset();
      done();
    });

    it('tells salesforce to anonymise its data', async () => {
      postStub = sinon.stub().yields(undefined, 'done');
      loginStub = sinon.stub().yields(undefined, {
        conn: {
          apex: {
            post: postStub,
          },
        },
        userInfo: {},
      });
      jsforceStub = sinon.stub(jsforce, 'Connection').returns({
        apex: {
          post: postStub,
        },
        login: loginStub,
      });

      const data = {
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R100SALESFORCE',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.SENT_TO_SALESFORCE,
      };

      await salesforce.execute(data);
      sinon.assert.calledWith(postStub, '/services/apexrest/anonymizeInSalesforce');
    });

    it('publishes the SENT_TO_SALESFORCE request', async () => {
      postStub = sinon.stub().yields(null, 'done');
      loginStub = sinon.stub().yields(undefined, {
        conn: {
          apex: {
            post: postStub,
          },
        },
        userInfo: {},
      });
      jsforceStub = sinon.stub(jsforce, 'Connection').returns({
        apex: {
          post: postStub,
        },
        login: loginStub,
      });

      const data = {
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R100SALESFORCE',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.SENT_TO_SALESFORCE,
      };

      const result = await salesforce.execute(data);

      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.IN_PROGRESS,
        remainingDays: 3,
        salesForceRequestId: 'R100SALESFORCE',
        sequenceId: 1,
        system: SYSTEMS.SALESFORCE,
        workflowStatus: WORKFLOW_STATUSES.SENT_TO_SALESFORCE,
      });
    });

    it('publishes the FAILED_IN_SALESFORCE request', async () => {
      postStub = sinon.stub().yields('an error');
      loginStub = sinon.stub().yields(undefined, {
        conn: {
          apex: {
            post: postStub,
          },
        },
        userInfo: {},
      });
      jsforceStub = sinon.stub(jsforce, 'Connection').returns({
        apex: {
          post: postStub,
        },
        login: loginStub,
      });

      const data = {
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R100SALESFORCE',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.SENT_TO_SALESFORCE,
      };

      const result = await salesforce.execute(data);
      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.FAILED,
        remainingDays: 3,
        salesForceRequestId: 'R100SALESFORCE',
        sequenceId: 1,
        system: SYSTEMS.SALESFORCE,
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_SALESFORCE,
      });
    });

    it('publishes NOTIFY_SALESFORCE_FAILURE when salesforce fails to respond', async () => {
      postStub = sinon.stub().yields('an error');
      loginStub = sinon.stub().yields(undefined, {
        conn: {
          apex: {
            post: postStub,
          },
        },
        userInfo: {},
      });
      jsforceStub = sinon.stub(jsforce, 'Connection').returns({
        apex: {
          post: postStub,
        },
        login: loginStub,
      });

      const data = {
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R100SALESFORCE',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.SENT_TO_SALESFORCE,
      };

      const result = await salesforce.execute(data);
      sinon.assert.calledOnce(sendErrorNotificationStub);

      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.FAILED,
        remainingDays: 3,
        salesForceRequestId: 'R100SALESFORCE',
        sequenceId: 1,
        system: SYSTEMS.SALESFORCE,
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_SALESFORCE,
      });
    });
  });
});
