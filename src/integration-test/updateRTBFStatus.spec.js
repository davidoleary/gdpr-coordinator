import request from 'supertest';
import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import config from 'config';
import fetchMock from 'fetch-mock';
import mongoose from 'mongoose';
import { Mockgoose } from 'mockgoose';
import xml2json from 'xml2json';
import AuditLog from '../models/audit-log';
import RequestCount from '../models/request-count';
import app from '../app'; // starts the real server
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';
import { open } from '../lib/mongodb-connect';

const mockgoose = new Mockgoose(mongoose);
chai.use(chaiSubset);

let runningApp;

describe('POST /v1/updateRTBFStatus', () => {
  before((done) => {
    open().then(() => {
      runningApp = request(app);
      fetchMock.post(config.systemEndPoints.hybris.endpoint, 200);
      done();
    }).catch(done);
  });

  afterEach((done) => {
    fetchMock.restore();
    mockgoose.helper.reset();
    done();
  });

  it('isMocked', (done) => {
    expect(mockgoose.helper.isMocked()).to.equal(true);
    done();
  });

  it('requires email', () => runningApp
    .post('/gdpr/api/v1/updateRTBFStatus')
    .send({})
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(400)
    .then((response) => {
      expect(response.body).to.containSubset({
        content: {
          error: {
            code: 'server error',
            message: 'validation errors',
            errors: [
              'customerEmail is required',
              'salesForceRequestId is required',
              'expectedCompletionDate is required',
              'workflowStatus is required',
              'workflowStatus is invalid: undefined',
            ],
          },
        },
      });
    }));

  it('requires salesForceRequestId', () => runningApp
    .post('/gdpr/api/v1/updateRTBFStatus')
    .send({
      customerEmail: 'd@d.com',
    })
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(400)
    .then((response) => {
      expect(response.body).to.containSubset({
        content: {
          error: {
            code: 'server error',
            message: 'validation errors',
            errors: [
              'salesForceRequestId is required',
              'expectedCompletionDate is required',
              'workflowStatus is required',
              'workflowStatus is invalid: undefined',
            ],
          },
        },
      });
    }));

  it('requires expectedCompletionDate', () => runningApp
    .post('/gdpr/api/v1/updateRTBFStatus')
    .send({
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R1001',
    })
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(400)
    .then((response) => {
      expect(response.body).to.containSubset({
        content: {
          error: {
            code: 'server error',
            message: 'validation errors',
            errors: [
              'expectedCompletionDate is required',
              'workflowStatus is required',
              'workflowStatus is invalid: undefined',
            ],
          },
        },
      });
    }));

  it('requires workflowStatus', () => runningApp
    .post('/gdpr/api/v1/updateRTBFStatus')
    .send({
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R1001',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    })
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(400)
    .then((response) => {
      expect(response.body).to.containSubset({
        content: {
          error: {
            code: 'server error',
            message: 'validation errors',
            errors: [
              'workflowStatus is required',
              'workflowStatus is invalid: undefined',
            ],
          },
        },
      });
    }));

  it('requires valid workflowStatus', () => runningApp
    .post('/gdpr/api/v1/updateRTBFStatus')
    .send({
      customerEmail: 'd@d.com',
      salesForceRequestId: 'R1001',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
      workflowStatus: 'NOT_VALID',
    })
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(400)
    .then((response) => {
      expect(response.body).to.containSubset({
        content: {
          error: {
            code: 'server error',
            message: 'validation errors',
            errors: [
              'workflowStatus is invalid: NOT_VALID',
            ],
          },
        },
      });
    }));

  it('Validates data sent via XML', () => {
    const navupdateXML = `<?xml version="1.0" encoding="utf-8"?>
        <updateRTBFStatus>
          <sourceSystem>NAV</sourceSystem>
          <customerEmail>noellebyrnes@gmail.com</customerEmail>
        </updateRTBFStatus>`;

    return runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .set('Content-Type', 'application/xml')
      .set('Accept', 'application/xml')
      .send(navupdateXML)
      .expect('Content-Type', /xml/)
      .expect(400)
      .then((response) => {
        const xmlData = JSON.parse(xml2json.toJson(response.text));
        expect(xmlData).to.containSubset({
          data: {
            head: {},
            content: {
              error: {
                code: 'server error',
                errors: 'salesForceRequestId is requiredexpectedCompletionDate is requiredworkflowStatus is requiredworkflowStatus is invalid: undefined',
                message: 'validation errors',
              },
            },
          },
        });
      });
  });
});

describe('updateRTBFStatus initialisation', () => {
  before((done) => {
    open().then(() => {
      runningApp = request(app);
      fetchMock.post(config.systemEndPoints.hybris.endpoint, 200);
      done();
    }).catch(done);
  });

  it('Prevents updates before INITIATED status', (done) => {
    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R10002',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_BI,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, response) => {
        expect(response.body.content).to.containSubset({
          error: {
            code: 'work flow change invalid',
            message: 'Unknown salesForceRequestId make sure it has been INITIATED',
          },
        });
        done();
      });
  });

  it('starts workflow with INITIATED status', (done) => {
    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R10005',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.INITIATED,
        loggedBy: 'dave',
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, response) => {
        expect(response.body.content).to.include({
          actionDescription: '',
          customerEmailAddress: 'd@d.com',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          loggedBy: 'dave',
          nodeAppStatus: helpers.IN_PROGRESS,
          remainingDays: 30,
          salesForceRequestId: 'R10005',
          system: SYSTEMS.SALESFORCE,
          workflowStatus: WORKFLOW_STATUSES.INITIATED,
        });
        done();
      });
  });
});

describe('Initiated control', () => {
  before((done) => {
    open().then(() => {
      runningApp = request(app);
      fetchMock.post(config.systemEndPoints.hybris.endpoint, 200);
      fetchMock.post(config.systemEndPoints.nav.endpoint, 200);
      done();
    }).catch(done);
  });

  beforeEach((done) => {
    const details = {
      sequenceId: 1,
      salesForceRequestId: 'ALREADYINIT',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.SALESFORCE,
      workflowStatus: WORKFLOW_STATUSES.INITIATED,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      errorCode: '1234',
      errorDescription: 'some error',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const auditInstance = new AuditLog(details);
    auditInstance.save().then(() => {
      done();
    });
  });

  it('Prevents request being initialised multiple times', (done) => {
    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'ALREADYINIT',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.INITIATED,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end((err, response) => {
        expect(response.body).to.containSubset({
          content: {
            error: {
              code: 'work flow change invalid',
              message: 'The request ALREADYINIT has already been Initiated',
            },
          },
        });
        done();
      });
  });
});

describe('updateRTBFStatus order enforcement', () => {
  before((done) => {
    open().then(() => {
      runningApp = request(app);
      fetchMock.post(config.systemEndPoints.hybris.endpoint, 200);
      fetchMock.post(config.systemEndPoints.nav.endpoint, 200);
      done();
    }).catch(done);
  });

  beforeEach((done) => {
    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R10002',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.HYBRIS,
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_HYBRIS,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      errorCode: '1234',
      errorDescription: 'some error',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const auditInstance = new AuditLog(details);
    auditInstance.save().then(() => {
      done();
    });
  });

  it('isMocked', (done) => {
    expect(mockgoose.helper.isMocked()).to.equal(true);
    done();
  });

  it('Prevents status being jumped', (done) => {
    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R10002',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_ESB,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end((err, response) => {
        expect(response.body).to.containSubset({
          content: {
            error: {
              code: 'work flow change invalid',
              message: 'Cannot jump from SENT_TO_HYBRIS to PROCESSED_IN_ESB',
            },
          },
        });
        done();
      });
  });

  it('Records failures', (done) => {
    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R10002',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end((err, response) => {
        expect(response.body.content).to.include({
          actionDescription: 'Something happening',
          customerEmailAddress: 'd@d.com',
          errorCode: '1234',
          errorDescription: 'some error',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          loggedBy: 'dave',
          nodeAppStatus: helpers.IN_PROGRESS,
          remainingDays: 3,
          salesForceRequestId: 'R10002',
          sequenceId: 1,
          system: SYSTEMS.HYBRIS,
          workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
        });
        done();
      });
  });

  it('Allows status change to a correct value', (done) => {
    // TODO: duplication
    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R10002',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.HYBRIS,
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_HYBRIS,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      errorCode: '1234',
      errorDescription: 'some error',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const auditInstance = new AuditLog(details);
    auditInstance.save().then(() => {
      runningApp
        .post('/gdpr/api/v1/updateRTBFStatus')
        .send({
          customerEmail: 'd@d.com',
          salesForceRequestId: 'R10002',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS,
        })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, response) => {
          expect(response.body.content).to.include({
            actionDescription: 'Something happening',
            customerEmailAddress: 'd@d.com',
            expectedCompletionDate: '2018-02-20T11:02:13.924Z',
            loggedBy: 'dave',
            nodeAppStatus: helpers.IN_PROGRESS,
            remainingDays: 3,
            salesForceRequestId: 'R10002',
            sequenceId: 1,
            system: SYSTEMS.HYBRIS,
            workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS,
          });
          done();
        });
    });
  });

  it('Prevents status being jumped via XML', (done) => {
    const navupdateXML = `<?xml version="1.0" encoding="utf-8"?>
        <updateRTBFStatus>
          <customerEmail>noellebyrnes@gmail.com</customerEmail>
          <salesForceRequestId>R10002</salesForceRequestId>
          <sourceSystem>NAV</sourceSystem>
          <expectedCompletionDate>2018-02-20T11:02:13.924Z</expectedCompletionDate>
          <workflowStatus>PROCESSED_IN_NAV</workflowStatus>
        </updateRTBFStatus>`;

    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .set('Content-Type', 'application/xml')
      .set('Accept', 'application/xml')
      .send(navupdateXML)
      .expect('Content-Type', /xml/)
      .expect(200)
      .end((err, response) => {
        const xmlData = JSON.parse(xml2json.toJson(response.text));
        expect(xmlData).to.containSubset({
          data: {
            head: {},
            content: {
              error: {
                message: 'Cannot jump from SENT_TO_HYBRIS to PROCESSED_IN_NAV',
                code: 'work flow change invalid',
              } },
          },
        });
        done();
      });
  });

  it('allow valid status changes via XML', (done) => {
    // normally NAV will not publish PROCESSED_IN_HYBRIS
    // this is just to re-use test data
    const navupdateXML = `<?xml version="1.0" encoding="utf-8"?>
        <updateRTBFStatus>
          <customerEmail>noellebyrnes@gmail.com</customerEmail>
          <salesForceRequestId>R10002</salesForceRequestId>
          <sourceSystem>NAV</sourceSystem>
          <expectedCompletionDate>2018-02-20T11:02:13.924Z</expectedCompletionDate>
          <workflowStatus>PROCESSED_IN_HYBRIS</workflowStatus>
        </updateRTBFStatus>`;

    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .set('Content-Type', 'application/xml')
      .set('Accept', 'application/xml')
      .send(navupdateXML)
      .expect('Content-Type', /xml/)
      .expect(200)
      .end((err, response) => {
        const xmlData = JSON.parse(xml2json.toJson(response.text));
        expect(xmlData.data.content).to.include({
          actionDescription: 'Something happening',
          customerEmailAddress: 'd@d.com',
          errorCode: '1234',
          errorDescription: 'some error',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          loggedBy: 'dave',
          nodeAppStatus: helpers.IN_PROGRESS,
          remainingDays: '3',
          salesForceRequestId: 'R10002',
          sequenceId: '1',
          system: SYSTEMS.HYBRIS,
          workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS,
        });
        done();
      });
  });

  it('Prevents jumping back from COMPLETED', (done) => {
    const encryptedEmail = 'e9e93c39b8b61b4cef15';
    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R100COMPLETED',
      customerEmailAddress: encryptedEmail,
      loggedBy: 'dave',
      system: SYSTEMS.NODE,
      workflowStatus: WORKFLOW_STATUSES.COMPLETED,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const auditInstance = new AuditLog(details);
    auditInstance.save().then(() => {
      runningApp
        .post('/gdpr/api/v1/updateRTBFStatus')
        .send({
          customerEmail: 'd@d.com',
          salesForceRequestId: 'R100COMPLETED',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS,
        })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, response) => {
          expect(response.body.content).to.containSubset({
            error: {
              code: 'work flow change invalid',
              message: 'Cannot jump from COMPLETED to PROCESSED_IN_HYBRIS',
            },
          });
          done();
        });
    });
  });

  it('allows status to go from FAILED_IN_NAV to PROCESSED_IN_NAV', (done) => {
    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R100FailedToPassed',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.NAV,
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_NAV,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const auditInstance = new AuditLog(details);
    auditInstance.save().then(() => {
      runningApp
        .post('/gdpr/api/v1/updateRTBFStatus')
        .send({
          customerEmail: 'd@d.com',
          salesForceRequestId: 'R100FailedToPassed',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
        })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .end((err, response) => {
          expect(response.body.content).to.include({
            actionDescription: 'Something happening',
            customerEmailAddress: 'd@d.com',
            expectedCompletionDate: '2018-02-20T11:02:13.924Z',
            loggedBy: 'dave',
            nodeAppStatus: helpers.IN_PROGRESS,
            remainingDays: 3,
            salesForceRequestId: 'R100FailedToPassed',
            sequenceId: 1,
            system: SYSTEMS.NAV,
            workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_NAV,
          });
          done();
        });
    });
  });

  it('allows status to go from FAILED_IN_HYBRIS to PROCESSED_IN_HYBRIS', (done) => {
    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R100FailedToPassedHybris',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.NAV,
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const auditInstance = new AuditLog(details);
    auditInstance.save().then(() => {
      runningApp
        .post('/gdpr/api/v1/updateRTBFStatus')
        .send({
          customerEmail: 'd@d.com',
          salesForceRequestId: 'R100FailedToPassedHybris',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS,
        })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(400)
        .end((err, response) => {
          expect(response.body.content).to.include({
            actionDescription: 'Something happening',
            customerEmailAddress: 'd@d.com',
            expectedCompletionDate: '2018-02-20T11:02:13.924Z',
            loggedBy: 'dave',
            nodeAppStatus: helpers.IN_PROGRESS,
            remainingDays: 3,
            salesForceRequestId: 'R100FailedToPassedHybris',
            sequenceId: 1,
            system: SYSTEMS.NAV,
            workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS,
          });
          done();
        });
    });
  });
});

describe('updateRTBFStatus count threshold', () => {
  before((done) => {
    open().then(() => {
      done();
    }).catch(done);
  });

  beforeEach((done) => {
    runningApp = request(app);
    fetchMock.post(config.systemEndPoints.hybris.endpoint, 200);
    fetchMock.post(config.systemEndPoints.nav.endpoint, 200);
    mockgoose.helper.reset();
    done();
  });

  afterEach((done) => {
    fetchMock.restore();
    mockgoose.helper.reset();
    done();
  });

  it('Prevents requests when daily threshold has been passed', async () => {
    const countDetails = {
      count: 3,
    };

    const countInstance = new RequestCount(countDetails);
    await countInstance.save();

    return runningApp.post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R10002',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.INITIATED,
        loggedBy: 'test@unit.com',
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then((response) => {
        expect(response.body).to.containSubset({
          content: {
            error: {
              code: 'server error',
              message: 'validation errors',
              errors: [
                'maximum number of requests reached',
              ],
            },
          },
        });
      });
  });

  it('Allows requests when daily threshold has not been passed', async () => {
    const countDetails = {
      count: 1,
    };

    const countInstance = new RequestCount(countDetails);
    await countInstance.save();

    return runningApp.post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .then((response) => {
        expect(response.body).to.containSubset({
          content: {
            error: {
              code: 'server error',
              message: 'validation errors',
              errors: [
                'salesForceRequestId is required',
                'expectedCompletionDate is required',
                'workflowStatus is required',
                'workflowStatus is invalid: undefined',
              ],
            },
          },
        });
      });
  });

  it('Adds count if it doesnt exist', (done) => {
    runningApp.post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        loggedBy: 'unittest',
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R10Count',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.INITIATED,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .then(() => {
        setTimeout(() => {
          RequestCount.findOne({})
          .then((doc) => {
            expect(doc.count).to.equal(1);
            done();
          })
          .catch((finalStateErr) => {
            done(finalStateErr);
          });
        }, 300);
      });
  }).timeout(2000);
});

describe('updateRTBFStatus errorDetails', () => {
  before((done) => {
    open().then(() => {
      runningApp = request(app);
      fetchMock.post(config.systemEndPoints.hybris.endpoint, 200);
      fetchMock.post(config.systemEndPoints.nav.endpoint, 200);
      done();
    }).catch(done);
  });

  beforeEach((done) => {
    const details = {
      sequenceId: 1,
      salesForceRequestId: 'R1AboutToFail',
      customerEmailAddress: 'd@d.com',
      loggedBy: 'dave',
      system: SYSTEMS.HYBRIS,
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_HYBRIS,
      nodeAppStatus: helpers.IN_PROGRESS,
      logTime: Date.now(),
      remainingDays: 3,
      actionDescription: 'Something happening',
      expectedCompletionDate: '2018-02-20T11:02:13.924Z',
    };

    const auditInstance = new AuditLog(details);
    auditInstance.save().then(() => {
      done();
    });
  });

  afterEach((done) => {
    fetchMock.restore();
    mockgoose.helper.reset();
    done();
  });

  it('Populates errorDetails if a value is provided in a FAILED_IN_X request', (done) => {
    runningApp
      .post('/gdpr/api/v1/updateRTBFStatus')
      .send({
        customerEmail: 'd@d.com',
        salesForceRequestId: 'R1AboutToFail',
        expectedCompletionDate: '2018-02-20T11:02:13.924Z',
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
        errorDescription: 'A error happed in HYBRIS',
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400)
      .end((err, response) => {
        expect(response.body.content).to.include({
          actionDescription: 'Something happening',
          customerEmailAddress: 'd@d.com',
          expectedCompletionDate: '2018-02-20T11:02:13.924Z',
          loggedBy: 'dave',
          nodeAppStatus: helpers.IN_PROGRESS,
          remainingDays: 3,
          salesForceRequestId: 'R1AboutToFail',
          sequenceId: 1,
          system: SYSTEMS.HYBRIS,
          workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
          errorDescription: 'A error happed in HYBRIS',
        });
        done();
      });
  });
});

