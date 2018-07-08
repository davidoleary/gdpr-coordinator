import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import sinon from 'sinon';
import proxyquire from 'proxyquire';
import { getNextAllowedStep, isWorkflowUpdateAllowed } from './state';
import { SYSTEMS, WORKFLOW_STATUSES } from '../helpers/constants';

chai.use(chaiSubset);

describe('getNextAllowedStep', () => {
  it('INITIATED can go to SENT_TO_HYBRIS', (done) => {
    expect(getNextAllowedStep(WORKFLOW_STATUSES.INITIATED)).to.containSubset([{
      name: WORKFLOW_STATUSES.SENT_TO_HYBRIS,
      system: SYSTEMS.HYBRIS,
    }, {
      name: WORKFLOW_STATUSES.SENT_TO_HYBRIS,
    }]);
    done();
  });

  it('SENT_TO_HYBRIS can go to PROCESSED_IN_HYBRIS | FAILED_IN_HYBRIS', (done) => {
    expect(getNextAllowedStep(WORKFLOW_STATUSES.SENT_TO_HYBRIS)).to.deep.equal([{
      name: WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS,
      system: SYSTEMS.HYBRIS,
    }, {
      name: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
    }]);
    done();
  });

  it('FAILED_IN_ESB can`t go to NOTIFY_ESB_FAILURE | SENT_TO_ESB', (done) => {
    expect(getNextAllowedStep('FAILED_IN_ESB')).to.deep.equal([{
      name: WORKFLOW_STATUSES.NOTIFY_ESB_FAILURE,
      system: SYSTEMS.ESB,
    }, {
      name: WORKFLOW_STATUSES.SENT_TO_ESB,
    }]);
    done();
  });

  it('PROCESSED_IN_SALESFORCE can only go to COMPLETED', (done) => {
    expect(getNextAllowedStep('PROCESSED_IN_SALESFORCE')).to.containSubset([{
      name: WORKFLOW_STATUSES.COMPLETED,
      system: SYSTEMS.SALESFORCE,
    }]);
    done();
  });

  it('returns the system that will preform the next step', (done) => {
    // NAV needs to be send XML so we need to differenciate the system
    expect(getNextAllowedStep('PROCESSED_IN_HYBRIS')).to.containSubset([{
      name: WORKFLOW_STATUSES.SENT_TO_NAV,
      system: SYSTEMS.NAV,
    }, {
      name: WORKFLOW_STATUSES.FAILED_IN_NAV,
    }]);
    done();
  });
});

describe('isWorkflowUpdateAllowed', () => {
  it('INITIATED can go to SENT_TO_HYBRIS', (done) => {
    expect(isWorkflowUpdateAllowed(
      WORKFLOW_STATUSES.INITIATED,
      WORKFLOW_STATUSES.SENT_TO_HYBRIS)).to.deep.equal(true);
    done();
  });

  it('INITIATED can`t go to SENT_TO_SALESFORCE', (done) => {
    expect(isWorkflowUpdateAllowed(
      WORKFLOW_STATUSES.INITIATED,
      WORKFLOW_STATUSES.SENT_TO_SALESFORCE)).to.deep.equal(false);
    done();
  });

  it('FAILED_IN_NAV can go to SENT_TO_NAV', (done) => {
    expect(isWorkflowUpdateAllowed(
      WORKFLOW_STATUSES.FAILED_IN_NAV,
      WORKFLOW_STATUSES.SENT_TO_NAV)).to.deep.equal(true);
    done();
  });

  it('SENT_TO_SALESFORCE can go to PROCESSED_IN_SALESFORCE', (done) => {
    const result = isWorkflowUpdateAllowed(
      WORKFLOW_STATUSES.SENT_TO_SALESFORCE,
      WORKFLOW_STATUSES.PROCESSED_IN_SALESFORCE);
    expect(result).to.deep.equal(true);
    done();
  });

  it('PROCESSED_IN_SALESFORCE can`t go to NOTIFY_BI_FAILURE', (done) => {
    const result = isWorkflowUpdateAllowed(
      WORKFLOW_STATUSES.PROCESSED_IN_SALESFORCE,
      WORKFLOW_STATUSES.NOTIFY_BI_FAILURE);
    expect(result).to.deep.equal(false);
    done();
  });
});

describe('execute next step', () => {
  let hybrisStub;
  let navStub;
  let esbStub;
  let biStub;
  let salesforceStub;
  let nodeStub;
  let state;
  beforeEach(() => {
    hybrisStub = sinon.stub();
    navStub = sinon.stub();
    esbStub = sinon.stub();
    biStub = sinon.stub();
    salesforceStub = sinon.stub();
    nodeStub = sinon.stub();

    state = proxyquire('./state', {
      '../systems': {
        nav: {
          execute: navStub,
        },
        hybris: {
          execute: hybrisStub,
        },
        esb: {
          execute: esbStub,
        },
        bi: {
          execute: biStub,
        },
        salesforce: {
          execute: salesforceStub,
        },
        node: {
          execute: nodeStub,
        },
      },
    });
  });

  it('INITIATED update triggers HYBRIS notification', (done) => {
    const nextStep = state.getNextAllowedStep(WORKFLOW_STATUSES.INITIATED);
    nextStep[0].execute();
    sinon.assert.calledOnce(hybrisStub);
    done();
  });

  it('PROCESSED_IN_HYBRIS update triggers NAV notification', (done) => {
    const nextStep = state.getNextAllowedStep(WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS);
    nextStep[0].execute();
    sinon.assert.calledOnce(navStub);
    done();
  });

  it('PROCESSED_IN_HYBRIS update triggers NAV notification', (done) => {
    const nextStep = state.getNextAllowedStep(WORKFLOW_STATUSES.PROCESSED_IN_HYBRIS);
    nextStep[0].execute();
    sinon.assert.calledOnce(navStub);
    done();
  });

  it('PROCESSED_IN_NAV update triggers ESB notification', (done) => {
    const nextStep = state.getNextAllowedStep(WORKFLOW_STATUSES.PROCESSED_IN_NAV);
    nextStep[0].execute();
    sinon.assert.calledOnce(esbStub);
    done();
  });

  it('PROCESSED_IN_BI update triggers Salesforce notification', (done) => {
    const nextStep = state.getNextAllowedStep(WORKFLOW_STATUSES.PROCESSED_IN_BI);
    nextStep[0].execute();
    sinon.assert.calledOnce(salesforceStub);
    done();
  });

  it('PROCESSED_IN_SALESFORCE update triggers completed notification', (done) => {
    const nextStep = state.getNextAllowedStep(WORKFLOW_STATUSES.PROCESSED_IN_SALESFORCE);
    nextStep[0].execute();
    sinon.assert.calledOnce(nodeStub);
    done();
  });
});

