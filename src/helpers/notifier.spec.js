import sinon from 'sinon';
import nodemailer from 'nodemailer';
import proxyquire from 'proxyquire';

describe('notifier', () => {
  let createTransportStub;
  let sendMailStub;

  beforeEach((done) => {
    sendMailStub = sinon.stub();
    createTransportStub = sinon.stub(nodemailer, 'createTransport').returns({
      sendMail: sendMailStub,
    });

    done();
  });

  afterEach((done) => {
    createTransportStub.restore();
    done();
  });

  it('creates a nodemailer transport', (done) => {
    // load file via proxyquire which will automatically call createTransport
    proxyquire('../helpers/notifier', {});
    sinon.assert.calledOnce(createTransportStub);
    done();
  });

  it('sends a notification email to the smtp server', (done) => {
    const notifierProxy = proxyquire('../helpers/notifier', {}).default;

    const response = {
      system: 'Hybris',
      errorCode: '500',
      errorDescription: 'some error',
      salesForceRequestId: '1234',
    };

    const expectedHtml = `<b>Hybris failed to respond or responded with and error</b>
    <br/><b>Anonymization request information:</b> 
    <br/><b>Error Status Code: 500</b> 
    <br/>Error Description: some error</b> 
    <br/>SalesForceRequestId: 1234</b> 
    <br/><br/>system</br>errorCode</br>errorDescription</br>salesForceRequestId`;

    notifierProxy.sendNotification(response);
    sinon.assert.calledOnce(sendMailStub);
    sinon.assert.calledWith(sendMailStub, sinon.match({
      from: 'gdprunittester@somecompany.com',
      html: expectedHtml,
      subject: 'GDPR coordinator - notification',
      to: 'gdprunittester@somecompany.com',
    }));
    done();
  });

  it('prevents customerEmailAddress being added to email content', (done) => {
    const notifierProxy = proxyquire('../helpers/notifier', {}).default;

    const response = {
      system: 'Hybris',
      errorCode: '500',
      errorDescription: 'some error',
      salesForceRequestId: '1234',
      customerEmailAddress: 'john.doe@someemail.com',
    };

    const expectedHtml = `<b>Hybris failed to respond or responded with and error</b>
    <br/><b>Anonymization request information:</b> 
    <br/><b>Error Status Code: 500</b> 
    <br/>Error Description: some error</b> 
    <br/>SalesForceRequestId: 1234</b> 
    <br/><br/>system</br>errorCode</br>errorDescription</br>salesForceRequestId`;

    notifierProxy.sendNotification(response);
    sinon.assert.calledOnce(sendMailStub);
    sinon.assert.calledWith(sendMailStub, sinon.match({
      from: 'gdprunittester@somecompany.com',
      html: expectedHtml,
      subject: 'GDPR coordinator - notification',
      to: 'gdprunittester@somecompany.com',
    }));
    done();
  });

  it('sends an error notification email to the smtp server', (done) => {
    const notifierProxy = proxyquire('../helpers/notifier', {}).default;

    const response = {
      system: 'Hybris',
      errorCode: '500',
      errorDescription: 'some error',
      salesForceRequestId: '1234',
    };

    const expectedHtml = {
      errorCode: '500',
      errorDescription: 'some error',
      salesForceRequestId: '1234',
      system: 'Hybris',
    };

    notifierProxy.sendErrorNotification(response);
    sinon.assert.calledOnce(sendMailStub);
    sinon.assert.calledWith(sendMailStub, sinon.match({
      from: 'gdprunittester@somecompany.com',
      html: expectedHtml,
      subject: 'GDPR coordinator - Error notification',
      to: 'gdprunittester@somecompany.com',
    }));
    done();
  });

  it('sends an string error notification email to the smtp server', (done) => {
    const notifierProxy = proxyquire('../helpers/notifier', {}).default;
    const response = 'some string value';

    notifierProxy.sendErrorNotification(response);
    sinon.assert.calledOnce(sendMailStub);
    sinon.assert.calledWith(sendMailStub, sinon.match({
      from: 'gdprunittester@somecompany.com',
      html: 'some string value',
      subject: 'GDPR coordinator - Error notification',
      to: 'gdprunittester@somecompany.com',
    }));
    done();
  });

  it('sends an Error notification email to the smtp server', (done) => {
    const notifierProxy = proxyquire('../helpers/notifier', {}).default;
    const response = new Error('real error');

    // custom sinon matcher needed to check result.html without the stack
    const checkValidBody = (result) => {
      if (result.from === 'gdprunittester@somecompany.com'
        && result.html.includes('real error')
        && result.subject === 'GDPR coordinator - Error notification') {
        return true;
      }

      return false;
    };

    notifierProxy.sendErrorNotification(response);
    sinon.assert.calledWith(sendMailStub, sinon.match(checkValidBody));
    sinon.assert.calledOnce(sendMailStub);

    done();
  });
});
