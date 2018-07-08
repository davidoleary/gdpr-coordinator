import 'isomorphic-fetch';
import fetchMock from 'fetch-mock';
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import { Mockgoose } from 'mockgoose';
import AuditLog from '../models/audit-log';
import node from './node';
import notifier from '../helpers/notifier';
import { open } from '../lib/mongodb-connect';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';

const mockgoose = new Mockgoose(mongoose);

describe('node execute', () => {
  let sendErrorNotificationStub;
  before(async () => {
    await open();
  });

  beforeEach((done) => {
    sendErrorNotificationStub = sinon.stub(notifier, 'sendErrorNotification');
    mockgoose.helper.reset();

    const first = {
      sequenceId: 1,
      salesForceRequestId: 'R100NODE',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.NAV,
      workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: '2018-03-13T11:02:13.924Z',
      remainingDays: 3,
      actionDescription: 'newest',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const second = {
      sequenceId: 1,
      salesForceRequestId: 'R100NODE',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.ESB,
      workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_BI,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: '2018-02-14T11:02:13.924Z',
      remainingDays: 3,
      actionDescription: 'oldest',
      expectedCompletionDate: '2017-02-20T11:02:13.924Z',
    };

    const current = {
      sequenceId: 1,
      salesForceRequestId: 'R100NODE',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.HYBRIS,
      workflowStatus: 'PROCESSED_IN_SALESFORCE',
      nodeAppStatus: 'IN_PROGRESS',
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      expectedCompletionDate: '2018-03-15T11:02:13.924Z',
    };

    AuditLog.insertMany([first, second, current]).then(() => {
      done();
    }).catch((err2) => {
      done(err2);
    });
  });

  afterEach((done) => {
    fetchMock.restore();
    mockgoose.helper.reset();
    sendErrorNotificationStub.restore();

    done();
  });

  it('isMocked', (done) => {
    expect(mockgoose.helper.isMocked()).to.equal(true);
    done();
  });

  it('publishes the COMPLETED request', async () => {
    const expectedHash = 'b3175129352e8001c98f4648588fffea49d2c7deea8b36b2f51321a7ad8ea5dc4d877e77f48f791b46be2a6d11390a4903fb9e3c80f6d8bc32f5518ee9546258';

    const data = {
      customerEmailAddress: 'd@d.com',
      salesForceRequestId: 'R100NODE',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: 'COMPLETED',
    };

    const result = await node.execute(data);
    expect(result).to.include({
      actionDescription: 'Something happening',
      customerEmailAddress: expectedHash,
      loggedBy: 'dave',
      nodeAppStatus: 'IN_PROGRESS',
      remainingDays: 3,
      salesForceRequestId: 'R100NODE',
      sequenceId: 1,
      system: 'NODE',
      workflowStatus: 'COMPLETED',
    });
  });

  it('publishes error notification when nav fails to respond', async () => {
    const error = new Error('fake error throw');
    const findOneStub = sinon.stub(AuditLog, 'findOne').throws(error);

    const data = {};

    await node.execute(data);
    sinon.assert.calledOnce(sendErrorNotificationStub);
    sinon.assert.calledWith(sendErrorNotificationStub, error);
    findOneStub.restore();
  });

  it('hashes the email of the anonymised user in the last log entries', async () => {
    const data = {
      customerEmailAddress: 'd@d.com',
      salesForceRequestId: 'R100NODE',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: 'COMPLETED',
    };

    const result = await node.execute(data);
    expect(result).to.include({
      actionDescription: 'Something happening',
      customerEmailAddress: 'b3175129352e8001c98f4648588fffea49d2c7deea8b36b2f51321a7ad8ea5dc4d877e77f48f791b46be2a6d11390a4903fb9e3c80f6d8bc32f5518ee9546258',
      loggedBy: 'dave',
      nodeAppStatus: 'IN_PROGRESS',
      remainingDays: 3,
      salesForceRequestId: 'R100NODE',
      sequenceId: 1,
      system: 'NODE',
      workflowStatus: 'COMPLETED',
    });
  });

  it('hashes the email of the anonymised user in ALL related log entries', (done) => {
    const data = {
      customerEmailAddress: 'd@d.com',
      salesForceRequestId: 'R100NODE',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: 'COMPLETED',
    };

    node.execute(data).then((result) => {
      const expectedHash = 'b3175129352e8001c98f4648588fffea49d2c7deea8b36b2f51321a7ad8ea5dc4d877e77f48f791b46be2a6d11390a4903fb9e3c80f6d8bc32f5518ee9546258';
      expect(result).to.include({
        actionDescription: 'Something happening',
        customerEmailAddress: expectedHash,
        loggedBy: 'dave',
        nodeAppStatus: 'IN_PROGRESS',
        remainingDays: 3,
        salesForceRequestId: 'R100NODE',
        sequenceId: 1,
        system: 'NODE',
        workflowStatus: 'COMPLETED',
      });

      setTimeout(() => {
        // read the status in the database and check that it is not set to "SENT_TO_ESB"
        AuditLog.find({ salesForceRequestId: data.salesForceRequestId })
          .limit(3)
          .then((docs) => {
            expect(docs[0].customerEmailAddress).to.equal(expectedHash);
            expect(docs[1].customerEmailAddress).to.equal(expectedHash);
            expect(docs[2].customerEmailAddress).to.equal(expectedHash);
            done();
          })
          .catch((finalStateErr) => {
            done(finalStateErr);
          });
      }, 1000);
    }).catch((err) => {
      done(err);
    });
  }).timeout(1500);
});
