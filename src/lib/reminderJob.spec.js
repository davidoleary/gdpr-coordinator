import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import { Mockgoose } from 'mockgoose';
import nodemailer from 'nodemailer';
import AuditLog from '../models/audit-log';
import reminder from '../lib/reminderJob';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';
import notifier from '../helpers/notifier';
import { open } from '../lib/mongodb-connect';

const mockgoose = new Mockgoose(mongoose);

describe('Reminder job', () => {
  let sendReminderNotificationStub;
  before((done) => {
    open().then(() => {
      done();
    }).catch(done);
  });

  beforeEach(async () => {
    mockgoose.helper.reset();
    sendReminderNotificationStub = sinon.stub(notifier, 'sendReminderNotification');

    const notOldNotNew = {
      sequenceId: 1,
      salesForceRequestId: 'R100ESB',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.ESB,
      workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_BI,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: '2017-12-13T11:02:13.924Z',
      remainingDays: 3,
      actionDescription: 'not oldest or newest',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const newest = {
      sequenceId: 1,
      salesForceRequestId: 'R100ESB',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.ESB,
      workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_BI,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: '2018-03-13T11:02:13.924Z',
      remainingDays: 3,
      actionDescription: 'newest',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const oldest = {
      sequenceId: 1,
      salesForceRequestId: 'R100ESB',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.ESB,
      workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_BI,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: '2017-02-20T11:02:13.924Z',
      remainingDays: 3,
      actionDescription: 'oldest',
      expectedCompletionDate: '2017-02-20T11:02:13.924Z',
    };

    const details3 = {
      sequenceId: 1,
      salesForceRequestId: 'R100ESBOther',
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

    await AuditLog.insertMany([notOldNotNew, newest, oldest, details3]);
  });

  afterEach((done) => {
    sendReminderNotificationStub.restore();
    mockgoose.helper.reset();
    done();
  });

  it('isMocked', async () => {
    expect(mockgoose.helper.isMocked()).to.equal(true);
  });

  it('send notification if job as not been updated in x days', async () => {
    await reminder({ numberOfDaysWithoutChangeAllowed: 3 });
    sinon.assert.calledWith(sendReminderNotificationStub, 'SalesForceRequestId: R100ESB -- Last update: 2018-03-13T11:02:13.924Z');
  });
});

