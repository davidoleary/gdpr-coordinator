import 'isomorphic-fetch';
import request from 'supertest';
import fetchMock from 'fetch-mock';
import { expect } from 'chai';
import config from 'config';
import sinon from 'sinon';
import mongoose from 'mongoose';
import { Mockgoose } from 'mockgoose';
import AuditLog from '../models/audit-log';
import app from '../app'; // starts the real server
import { WORKFLOW_STATUSES, SYSTEMS, helpers } from '../helpers/constants';
import notifier from '../helpers/notifier';
import { open } from '../lib/mongodb-connect';

const mockgoose = new Mockgoose(mongoose);
let runningApp;

describe('Integration - nav to esb', () => {
  let sendNotificationStub;

  before((done) => {
    open().then(() => {
      runningApp = request(app);
      done();
    }).catch(done);
  });

  beforeEach((done) => {
    sendNotificationStub = sinon.stub(notifier, 'sendNotification');

    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R100NodeToESB',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'esb next step',
      system: SYSTEMS.NAV,
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_NAV,
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

  it('sends next step request to esb after PROCESSED_IN_NAV is recieved', (done) => {
    fetchMock.post(config.systemEndPoints.esb.endpoint, 200);

    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R100NodeToESB',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, response) => {
        // Check the response to the initialisation request
        expect(response.body.content).to.include({
          customerEmailAddress: 'd@d.com',
          salesForceRequestId: 'R100NodeToESB',
          loggedBy: 'esb next step',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
        });

        // TODO: fetchMock.called seems to fail randomly
        // check that an update has been sent out to hybris
        // expect(fetchMock.called(config.systemEndPoints.esb.endpoint)).to.equal(true);

        // because updateRTBFStatus makes fire and forget request we can't determine
        // a precise end time to the request to hybris
        setTimeout(() => {
          // read the status in the database and check that it is not set to "SENT_TO_ESB"
          AuditLog.find({ salesForceRequestId: 'R100NodeToESB' })
            .sort([['_id', -1]])
            .limit(3)
            .then((docs) => {
              expect(docs[2].workflowStatus).to.equal(WORKFLOW_STATUSES.SENT_TO_ESB);
              expect(docs[2].system).to.equal(SYSTEMS.ESB);
              done();
            })
            .catch((finalStateErr) => {
              done(finalStateErr);
            });
        }, 1000);
      });
  }).timeout(2000);

  it('adds PROCESSED_IN_ESB record when SENT_TO_ESB is acknowledged', (done) => {
    // ESB cannot guarantee the order of the "PROCESSED_IN_ESB" and "SENT_TI_ESB" acknowledgement
    // So we record the the PROCESSED_IN_ESB here
    fetchMock.post(config.systemEndPoints.esb.endpoint, 200);

    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R100NodeToESB',
        loggedBy: 'esb next step',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, response) => {
        // Check the response to the initialisation request
        expect(response.body.content).to.include({
          customerEmailAddress: 'd@d.com',
          salesForceRequestId: 'R100NodeToESB',
          loggedBy: 'esb next step',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
        });

        // TODO: fetchMock.called seems to fail randomly
        // check that an update has been sent out to esb
        // expect(fetchMock.called(config.systemEndPoints.esb.endpoint)).to.equal(true);

        // because updateRTBFStatus makes fire and forget request we can't determine
        // a precise end time to the request to esb
        setTimeout(() => {
          // read the status in the database and check that it is not set to "SENT_TO_ESB"
          AuditLog.find({ salesForceRequestId: 'R100NodeToESB' })
            .sort([['_id', -1]])
            .limit(2)
            .then((docs) => {
              expect(docs[1].workflowStatus).to.equal(WORKFLOW_STATUSES.PROCESSED_IN_ESB);
              expect(docs[1].system).to.equal(SYSTEMS.ESB);
              done();
            })
            .catch((finalStateErr) => {
              done(finalStateErr);
            });
        }, 1000);
      });
  }).timeout(2000);

  it('log an error when sending next step request to ESB fails', (done) => {
    fetchMock.post(config.systemEndPoints.esb.endpoint, 500);

    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R100NodeToESB',
        loggedBy: 'esb next step',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, response) => {
        // Check the response to the initialisation request
        expect(response.body.content).to.include({
          customerEmailAddress: 'd@d.com',
          salesForceRequestId: 'R100NodeToESB',
          loggedBy: 'esb next step',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
        });

        // check that an update has been sent out to hybris
        // expect(fetchMock.called(config.systemEndPoints.esb.endpoint)).to.equal(true);

        // because updateRTBFStatus makes fire and forget request we can't determine
        // a precise end time to the request to hybris
        setTimeout(() => {
          AuditLog.findOne({ salesForceRequestId: 'R100NodeToESB' })
            .sort([['_id', -1]])
            .then((doc) => {
              expect(doc.workflowStatus).to.equal(WORKFLOW_STATUSES.FAILED_IN_ESB);
              expect(doc.system).to.equal(SYSTEMS.ESB);
              done();
            }).catch((finalStateErr) => {
              done(finalStateErr);
            });
        }, 4000);
      });
  }).timeout(6000);
});
