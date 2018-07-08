import 'isomorphic-fetch';
import fetchMock from 'fetch-mock';
import { expect } from 'chai';
import config from 'config';
import sinon from 'sinon';
import { Mockgoose } from 'mockgoose';
import mongoose from 'mongoose';
import proxyquire from 'proxyquire';
import AuditLog from '../models/audit-log';
import nav from './NAV';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';
import notifier from '../helpers/notifier';
import { open } from '../lib/mongodb-connect';

const mockgoose = new Mockgoose(mongoose);

describe('system nav execute', () => {
  let sendNotificationStub;
  let sendErrorNotificationStub;

  before((done) => {
    open().then(() => {
      done();
    }).catch(done);
  });

  beforeEach((done) => {
    sendNotificationStub = sinon.stub(notifier, 'sendNotification');
    sendErrorNotificationStub = sinon.stub(notifier, 'sendErrorNotification');

    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R10011NAV',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.HYBRIS,
      workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    try {
      const auditInstance = new AuditLog(details);
      auditInstance.save().then(() => {
        done();
      }).catch((err2) => {
        done(err2);
      });
    } catch (err3) {
      console.log(err3);
    }
  });

  afterEach((done) => {
    fetchMock.restore();
    sendNotificationStub.restore();
    sendErrorNotificationStub.restore();
    mockgoose.helper.reset();
    done();
  });

  it('isMocked', (done) => {
    expect(mockgoose.helper.isMocked()).to.equal(true);
    done();
  });

  it('publishes the SENT_TO_NAV request', (done) => {
    fetchMock.post(config.systemEndPoints.nav.endpoint, { body: { status: 'success' } });
    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R10011NAV',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_NAV,
    };

    nav.execute(data).then((result) => {
      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.IN_PROGRESS,
        remainingDays: 3,
        salesForceRequestId: 'R10011NAV',
        sequenceId: 1,
        system: SYSTEMS.NAV,
        workflowStatus: WORKFLOW_STATUSES.SENT_TO_NAV,
      });

      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('publishes FAILED_IN_NAV when hybris fails to respond', (done) => {
    fetchMock.post(config.systemEndPoints.nav.endpoint, 400);

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R10011NAV',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_NAV,
    };

    nav.execute(data).then((result) => {
      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.FAILED,
        remainingDays: 3,
        salesForceRequestId: 'R10011NAV',
        sequenceId: 1,
        system: SYSTEMS.NAV,
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_NAV,
      });

      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('publishes NOTIFY_NAV_FAILURE when nav fails to respond', (done) => {
    fetchMock.post(config.systemEndPoints.nav.endpoint, 400);

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R10011NAV',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_NAV,
    };

    nav.execute(data).then(() => {
      sinon.assert.calledOnce(sendNotificationStub);
      sinon.assert.calledWith(sendNotificationStub, sinon.match({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.FAILED,
        remainingDays: 3,
        salesForceRequestId: 'R10011NAV',
        sequenceId: 1,
        system: SYSTEMS.NAV,
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_NAV,
      }));

      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('publishes error notification when nav fails to respond', (done) => {
    const error = new Error('some fake error');
    const retryStub = sinon.stub().throws(error);
    const navProxy = proxyquire('./NAV', {
      '../lib/fetch-retry': retryStub,
    }).default;

    const data = {};

    navProxy.execute(data).then(() => {
      sinon.assert.calledOnce(sendErrorNotificationStub);
      sinon.assert.calledWith(sendErrorNotificationStub, error);
      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('is configured to retry publishing SENT_TO_NAV 3 times request it if errors', (done) => {
    const retryStub = sinon.stub().returns(500, {});
    const navProxy = proxyquire('./NAV', {
      '../lib/fetch-retry': retryStub,
    }).default;

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R10011NAV',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_NAV,
    };

    navProxy.execute(data).then(() => {
      sinon.assert.calledWith(retryStub, config.systemEndPoints.nav.endpoint, sinon.match({
        retries: 3,
        retryDelay: 1000,
      }));

      done();
    }).catch((err) => {
      done(err);
    });
  });
});

