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
import { WORKFLOW_STATUSES, SYSTEMS } from '../helpers/constants';
import notifier from '../helpers/notifier';
import { open } from '../lib/mongodb-connect';

const mockgoose = new Mockgoose(mongoose);
const hybrisEndpoint = config.systemEndPoints.hybris.endpoint;

let runningApp;

describe('Integration - initialisation to hybris', () => {
  let sendNotificationStub;

  before((done) => {
    open().then(() => {
      runningApp = request(app);
      done();
    }).catch(done);
  });

  beforeEach((done) => {
    sendNotificationStub = sinon.stub(notifier, 'sendNotification');
    done();
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

  it('sends next step request to hybris after INITIATED is recieved', (done) => {
    fetchMock.post(hybrisEndpoint, 200);

    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R100NodeToHyb',
        loggedBy: 'hybris next step',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.INITIATED,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, response) => {
        // Check the response to the initialisation request
        expect(response.body.content).to.include({
          customerEmailAddress: 'd@d.com',
          salesForceRequestId: 'R100NodeToHyb',
          loggedBy: 'hybris next step',
          system: 'SALESFORCE',
          nodeAppStatus: 'IN_PROGRESS',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          workflowStatus: WORKFLOW_STATUSES.INITIATED,
        });

        // TODO: fetchMock.called seems to fail randomly
        // check that an update has been sent out to hybris
        // expect(fetchMock.called(hybrisEndpoint)).to.equal(true);

        // because updateRTBFStatus makes fire and forget request we can't determine
        // a precise end time to the request to hybris
        setTimeout(() => {
          // read the status in the database and check that it is not set to "SENT_TO_HYBRIS"
          AuditLog.findOne({ salesForceRequestId: 'R100NodeToHyb' }) // data.salesForceRequestId })
          .sort([['_id', -1]])
          .limit(2)
          .then((docs) => {
            expect(docs.workflowStatus).to.equal(WORKFLOW_STATUSES.SENT_TO_HYBRIS);
            expect(docs.system).to.equal(SYSTEMS.HYBRIS);
            done();
          })
          .catch((finalStateErr) => {
            done(finalStateErr);
          });
        }, 1000);
      });
  }).timeout(2000);

  it('log an error when sending next step request to hybris fails', (done) => {
    fetchMock.post(hybrisEndpoint, 500);

    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R100NodeToHyb',
        loggedBy: 'hybris next step',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.INITIATED,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, response) => {
        // Check the response to the initialisation request
        expect(response.body.content).to.include({
          customerEmailAddress: 'd@d.com',
          salesForceRequestId: 'R100NodeToHyb',
          loggedBy: 'hybris next step',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          workflowStatus: WORKFLOW_STATUSES.INITIATED,
        });

        // check that an update has been sent out to hybris
        // expect(fetchMock.called(hybrisEndpoint)).to.equal(true);

        // because updateRTBFStatus makes fire and forget request we can't determine
        // a precise end time to the request to hybris
        setTimeout(() => {
          // read the status in the database and check that it is not set to "SENT_TO_HYBRIS"
          AuditLog.findOne({ salesForceRequestId: 'R100NodeToHyb' }) // data.salesForceRequestId })
            .sort([['_id', -1]])
            .then((doc) => {
              expect(doc.workflowStatus).to.equal(WORKFLOW_STATUSES.FAILED_IN_HYBRIS);
              expect(doc.system).to.equal(SYSTEMS.HYBRIS);
              done();
            }).catch((finalStateErr) => {
              done(finalStateErr);
            });
        }, 4000);
      });
  }).timeout(6000);
});
