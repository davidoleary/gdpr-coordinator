import 'isomorphic-fetch';
import fetchMock from 'fetch-mock';
import { expect } from 'chai';
import config from 'config';
import sinon from 'sinon';
import mongoose from 'mongoose';
import { Mockgoose } from 'mockgoose';
import proxyquire from 'proxyquire';
import AuditLog from '../models/audit-log';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';
import notifier from '../helpers/notifier';
import { open } from '../lib/mongodb-connect';

const mockgoose = new Mockgoose(mongoose);
const hybrisEndpoint = config.systemEndPoints.esb.endpoint;
const navEndPoint = config.systemEndPoints.nav.endpoint;

describe('BI execute', () => {
  let sendNotificationStub;
  let bi;
  let executeSQLMock;

  before((done) => {
    open().then(() => {
      fetchMock.post(hybrisEndpoint, 200);
      fetchMock.post(navEndPoint, 200);
      done();
    }).catch(done);
  });


  beforeEach((done) => {
    sendNotificationStub = sinon.stub(notifier, 'sendNotification');
    // comment out for integration testing
    executeSQLMock = sinon.stub().yields(null, { test: 'the stub is working' });
    bi = proxyquire('./BI', {
      mssql: {
        connect: sinon.stub().yields(null, { test: 'the stub' }),
        Request: () => {
          return {
            input: () => {},
            execute: executeSQLMock,
          };
        },
      },
    }).default;

    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R100BI',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.BI,
      workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const auditInstance = new AuditLog(details);
    auditInstance.save().then(() => {
      done();
    }).catch((err2) => {
      done(err2);
    });
  });

  afterEach((done) => {
    fetchMock.restore();
    sendNotificationStub.restore();
    mockgoose.helper.reset();
    done();
  });

  it('isMocked', (done) => {
    expect(mockgoose.helper.isMocked()).to.equal(true);
    done();
  });

  it('publishes the SENT_TO_BI request', (done) => {
    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R100BI',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_BI,
    };

    bi.execute(data).then((result) => {
      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.IN_PROGRESS,
        remainingDays: 3,
        salesForceRequestId: 'R100BI',
        sequenceId: 1,
        system: SYSTEMS.BI,
        workflowStatus: WORKFLOW_STATUSES.SENT_TO_BI,
      });

      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('publishes FAILED_IN_BI when hybris fails to respond', (done) => {
    executeSQLMock = sinon.stub().yields('An error has occured');

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R100BI',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: helpers.FAILED_IN_BI,
    };

    bi.execute(data).then((result) => {
      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.FAILED,
        remainingDays: 3,
        salesForceRequestId: 'R100BI',
        sequenceId: 1,
        system: SYSTEMS.BI,
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_BI,
      });

      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('publishes NOTIFY_BI_FAILURE when nav fails to respond', (done) => {
    executeSQLMock = sinon.stub().yields('An error has occured');

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R100BI',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_BI,
    };

    bi.execute(data).then(() => {
      sinon.assert.calledOnce(sendNotificationStub);
      sinon.assert.calledWith(sendNotificationStub, sinon.match({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.FAILED,
        remainingDays: 3,
        salesForceRequestId: 'R100BI',
        sequenceId: 1,
        system: SYSTEMS.BI,
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_BI,
      }));
      done();
    }).catch((err) => {
      done(err);
    });
  });
});
