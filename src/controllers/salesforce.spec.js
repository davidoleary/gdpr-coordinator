import sinon from 'sinon';
import salesforce from './salesforce';
import salesforceSystem from '../systems/salesforce';

describe('salesforce controller POST', () => {
  let acknowledgeInitialisationFromSalesforceStub;

  beforeEach((done) => {
    acknowledgeInitialisationFromSalesforceStub = sinon.stub(salesforceSystem, 'acknowledgeInitialisationFromSalesforce');
    done();
  });

  afterEach((done) => {
    acknowledgeInitialisationFromSalesforceStub.restore();
    done();
  });

  it('tells salesforce the state of a job', (done) => {
    const runMiddleware = sinon.stub().yields(200, JSON.stringify({ content: 'fakecontent' }));
    const req = {
      body: [{
        test: 'testbody',
      }, {
        test: 'testbody2',
      }],
      runMiddleware,
    };
    const res = {};
    salesforce.POST(req, res);
    sinon.assert.calledTwice(runMiddleware);
    sinon.assert.calledTwice(acknowledgeInitialisationFromSalesforceStub);
    done();
  });

  it('tells salesforce when there is an error', (done) => {
    const runMiddleware = sinon.stub().yields(500, JSON.stringify({
      content: {
        message: 'an error',
      },
    }));

    const req = {
      body: [{
        salesForceRequestId: 'complete1234',
        test: 'testbody',
      }],
      runMiddleware,
    };
    const res = {};
    salesforce.POST(req, res);
    sinon.assert.calledOnce(runMiddleware);
    sinon.assert.calledWith(acknowledgeInitialisationFromSalesforceStub, {
      message: 'an error',
      salesForceRequestId: 'complete1234',
    });
    done();
  });
});

describe('salesforce controller POSTComplete', () => {
  let acknowledgeCompletionWithSalesforceStub;

  beforeEach((done) => {
    acknowledgeCompletionWithSalesforceStub = sinon.stub(salesforceSystem, 'acknowledgeCompletionWithSalesforce');
    done();
  });

  afterEach((done) => {
    acknowledgeCompletionWithSalesforceStub.restore();
    done();
  });

  it('tells salesforce the state of a job', (done) => {
    const runMiddleware = sinon.stub().yields(200, JSON.stringify({ content: 'fakecontent' }));
    const req = {
      body: [{
        test: 'testbody',
      }, {
        test: 'testbody2',
      }],
      runMiddleware,
    };
    const res = {};
    salesforce.POSTComplete(req, res);
    sinon.assert.calledTwice(runMiddleware);
    sinon.assert.calledTwice(acknowledgeCompletionWithSalesforceStub);
    done();
  });

  it('tells salesforce when there is an error', (done) => {
    const runMiddleware = sinon.stub().yields(500, JSON.stringify({ content: {
      message: 'an error',
    } }));

    const req = {
      body: [{
        salesForceRequestId: 'complete1234',
        test: 'testbody',
      }],
      runMiddleware,
    };
    const res = {};
    salesforce.POSTComplete(req, res);
    sinon.assert.calledOnce(runMiddleware);
    sinon.assert.calledWith(acknowledgeCompletionWithSalesforceStub, {
      message: 'an error',
      salesForceRequestId: 'complete1234',
    });
    done();
  });
});
