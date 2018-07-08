import 'isomorphic-fetch';
import fetchMock from 'fetch-mock';
import { expect } from 'chai';
import config from 'config';
import sinon from 'sinon';
import mongoose from 'mongoose';
import proxyquire from 'proxyquire';
import { Mockgoose } from 'mockgoose';
import AuditLog from '../models/audit-log';
import esb from './ESB';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';
import notifier from '../helpers/notifier';
import { open } from '../lib/mongodb-connect';
import * as state from '../helpers/state';

const mockgoose = new Mockgoose(mongoose);
const esbEndpoint = config.systemEndPoints.esb.endpoint;

describe('ESB execute', () => {
  let sendNotificationStub;
  let sendErrorNotificationStub;
  let getNextAllowedStepStub;
  before((done) => {
    open().then(() => {
      done();
    }).catch(done);
  });

  beforeEach((done) => {
    mockgoose.helper.reset();
    sendNotificationStub = sinon.stub(notifier, 'sendNotification');
    sendErrorNotificationStub = sinon.stub(notifier, 'sendErrorNotification');
    getNextAllowedStepStub = sinon.stub(state, 'getNextAllowedStep').returns([{
      name: 'SENT_TO_BI',
      system: 'BI',
      execute: () => {},
    }, {
      name: 'FAILED_IN_BI',
    }]);

    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R100ESB',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.ESB,
      workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_BI,
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
    sendErrorNotificationStub.restore();
    getNextAllowedStepStub.restore();
    mockgoose.helper.reset();
    done();
  });

  it('isMocked', (done) => {
    expect(mockgoose.helper.isMocked()).to.equal(true);
    done();
  });

  it('publishes the SENT_TO_ESB request', (done) => {
    fetchMock.post(esbEndpoint, { body: { status: 'success' } });

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R100ESB',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_ESB,
    };

    esb.execute(data).then((result) => {
      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.IN_PROGRESS,
        remainingDays: 3,
        salesForceRequestId: 'R100ESB',
        sequenceId: 1,
        system: SYSTEMS.ESB,
        workflowStatus: WORKFLOW_STATUSES.SENT_TO_ESB,
      });

      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('publishes FAILED_IN_ESB when ESB fails to respond', (done) => {
    fetchMock.post(esbEndpoint, 400);

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R100ESB',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_ESB,
    };

    esb.execute(data).then((result) => {
      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.FAILED,
        remainingDays: 3,
        salesForceRequestId: 'R100ESB',
        sequenceId: 1,
        system: SYSTEMS.ESB,
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_ESB,
      });

      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('publishes NOTIFY_ESB_FAILURE when ESB fails to respond', (done) => {
    fetchMock.post(esbEndpoint, 400);

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R100ESB',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_ESB,
    };

    esb.execute(data).then(() => {
      sinon.assert.calledOnce(sendNotificationStub);
      sinon.assert.calledWith(sendNotificationStub, sinon.match({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.FAILED,
        remainingDays: 3,
        salesForceRequestId: 'R100ESB',
        sequenceId: 1,
        system: SYSTEMS.ESB,
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_ESB,
      }));
      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('publishes error notification when esb fails to respond', (done) => {
    const error = new Error('some fake error');
    const retryStub = sinon.stub().throws(error);
    const navProxy = proxyquire('./ESB', {
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

  it('is configured to retry publishing SENT_TO_ESB 3 times request it if errors', (done) => {
    const retryStub = sinon.stub().returns(500, {});
    const esbProxy = proxyquire('./ESB', {
      '../lib/fetch-retry': retryStub,
    }).default;

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R100ESB',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_ESB,
    };

    esbProxy.execute(data).then(() => {
      sinon.assert.calledWith(retryStub, esbEndpoint, sinon.match({
        retries: 3,
        retryDelay: 1000,
      }));

      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('it triggers next action as ESB can not make the request itself', (done) => {
    const retryStub = sinon.stub().returns({
      ok: true,
      body: {
        status: 'SUCCESS',
        message: 'Customer email test_39@test.com: 0 lines were updated in ESB EXTEMAILQUEUE.',
      },
    });

    const stateStub = {
      getNextAllowedStep: sinon.stub().returns([{
        name: 'SENT_TO_BI',
        system: 'BI',
        execute: () => {},
      }, {
        name: 'FAILED_IN_BI',
      }]),
      triggerNextAction: sinon.stub(),
    };

    const esbProxy = proxyquire('./ESB', {
      '../lib/fetch-retry': retryStub,
      '../helpers/state': stateStub,
    }).default;

    const data = {
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R100ESB',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_ESB,
    };

    esbProxy.execute(data).then((result) => {
      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: 'd@d.com',
        loggedBy: 'dave',
        nodeAppStatus: helpers.IN_PROGRESS,
        remainingDays: 3,
        salesForceRequestId: 'R100ESB',
        sequenceId: 1,
        system: SYSTEMS.ESB,
        workflowStatus: WORKFLOW_STATUSES.SENT_TO_ESB,
      });

      sinon.assert.calledWith(stateStub.triggerNextAction, WORKFLOW_STATUSES.PROCESSED_IN_ESB);
      done();
    }).catch((err) => {
      done(err);
    });
  });
});

