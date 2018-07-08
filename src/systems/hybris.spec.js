import 'isomorphic-fetch';
import fetchMock from 'fetch-mock';
import { expect } from 'chai';
import config from 'config';
import sinon from 'sinon';
import mongoose from 'mongoose';
import proxyquire from 'proxyquire';
import { Mockgoose } from 'mockgoose';
import AuditLog from '../models/audit-log';
import hybris from './hybris';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';
import notifier from '../helpers/notifier';
import { open } from '../lib/mongodb-connect';

const mockgoose = new Mockgoose(mongoose);

describe('hybris execute', () => {
  let sendNotificationStub;
  let sendErrorNotificationStub;
  before(async () => {
    await open();
  });

  beforeEach(async () => {
    sendNotificationStub = sinon.stub(notifier, 'sendNotification');
    sendErrorNotificationStub = sinon.stub(notifier, 'sendErrorNotification');
    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R10008',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.SALESFORCE,
      workflowStatus: WORKFLOW_STATUSES.INITIATED,
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
    fetchMock.restore();
    sendNotificationStub.restore();
    sendErrorNotificationStub.restore();
    mockgoose.helper.reset();
    done();
  });

  it('isMocked', async (done) => {
    expect(mockgoose.helper.isMocked()).to.equal(true);
    done();
  });

  it('publishes the SENT_TO_HYBRIS request', async () => {
    fetchMock.post(config.systemEndPoints.hybris.endpoint, { body: { status: 'success' } });

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R10008',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_HYBRIS,
    };

    const result = await hybris.execute(data);
    expect(result).to.include({
      actionDescription: 'Something happening',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      nodeAppStatus: helpers.IN_PROGRESS,
      remainingDays: 3,
      salesForceRequestId: 'R10008',
      sequenceId: 1,
      system: SYSTEMS.HYBRIS,
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_HYBRIS,
    });
  });

  it('publishes FAILED_IN_HYBRIS when hybris fails to respond', async () => {
    fetchMock.post(config.systemEndPoints.hybris.endpoint, 400);

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R10008',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
    };

    const result = await hybris.execute(data);
    expect(result).to.include({
      actionDescription: 'Something happening',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      nodeAppStatus: helpers.FAILED,
      remainingDays: 3,
      salesForceRequestId: 'R10008',
      sequenceId: 1,
      system: SYSTEMS.HYBRIS,
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
    });
  });

  it('publishes NOTIFY_HYBRIS_FAILURE when hybris fails to respond', async () => {
    fetchMock.post(config.systemEndPoints.hybris.endpoint, 400);

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R10008',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
    };

    await hybris.execute(data);
    sinon.assert.calledOnce(sendNotificationStub);
    sinon.assert.calledWith(sendNotificationStub, sinon.match({
      actionDescription: 'Something happening',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      nodeAppStatus: helpers.FAILED,
      remainingDays: 3,
      salesForceRequestId: 'R10008',
      sequenceId: 1,
      system: SYSTEMS.HYBRIS,
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
    }));
  });

  it('publishes error notification when hybris throws an error', async () => {
    const error = new Error('some fake error');
    const retryStub = sinon.stub().throws(error);
    const hybrisProxy = proxyquire('./hybris', {
      '../lib/fetch-retry': retryStub,
    }).default;

    const data = {};

    await hybrisProxy.execute(data);
    sinon.assert.calledOnce(sendErrorNotificationStub);
    sinon.assert.calledWith(sendErrorNotificationStub, error);
  });

  it('is configured to retry publishing SENT_TO_HYBRIS 3 times request it if errors', async () => {
    const retryStub = sinon.stub().returns(500, {});
    const hybrisProxy = proxyquire('./hybris', {
      '../lib/fetch-retry': retryStub,
    }).default;

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R10011HYBRIS',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_HYBRIS,
    };

    await hybrisProxy.execute(data);
    sinon.assert.calledWith(retryStub, config.systemEndPoints.hybris.endpoint, sinon.match({
      retries: 3,
      retryDelay: 1000,
    }));
  });
});

