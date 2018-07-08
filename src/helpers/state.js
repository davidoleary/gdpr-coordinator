import mfLogger from 'mf-logger';
import { hybris, nav, bi, esb, salesforce, node } from '../systems';

const workflowMap = {
  INITIATED: [{
    name: 'SENT_TO_HYBRIS',
    system: 'HYBRIS',
    execute: hybris.execute,
  }, {
    name: 'FAILED_IN_HYBRIS',
  }],
  FAILED_IN_HYBRIS: [{
    name: 'NOTIFY_HYBRIS_FAILURE',
    system: 'HYBRIS',
  }, {
    name: 'SENT_TO_HYBRIS',
  }, {
    name: 'PROCESSED_IN_HYBRIS',
  }],
  SENT_TO_HYBRIS: [{
    name: 'PROCESSED_IN_HYBRIS',
    system: 'HYBRIS',
  }, {
    name: 'FAILED_IN_HYBRIS',
  }],
  PROCESSED_IN_HYBRIS: [{
    name: 'SENT_TO_NAV',
    system: 'NAV',
    execute: nav.execute,
  }, {
    name: 'FAILED_IN_NAV',
  }],
  FAILED_IN_NAV: [{
    name: 'NOTIFY_NAV_FAILURE',
    system: 'NAV',
  }, {
    name: 'SENT_TO_NAV',
  }, {
    name: 'PROCESSED_IN_NAV',
  }],
  SENT_TO_NAV: [{
    name: 'PROCESSED_IN_NAV',
    system: 'NAV',
  }, {
    name: 'FAILED_IN_NAV',
  }],
  PROCESSED_IN_NAV: [{
    name: 'SENT_TO_ESB',
    system: 'NAV',
    execute: esb.execute,
  }, {
    name: 'FAILED_IN_ESB',
  }],

  FAILED_IN_ESB: [{
    name: 'NOTIFY_ESB_FAILURE',
    system: 'ESB',
  }, {
    name: 'SENT_TO_ESB',
  }],
  SENT_TO_ESB: [{
    name: 'PROCESSED_IN_ESB',
    system: 'ESB',
  }, {
    name: 'FAILED_IN_ESB',
  }],
  PROCESSED_IN_ESB: [{
    name: 'SENT_TO_BI',
    system: 'BI',
    execute: bi.execute,
  }, {
    name: 'FAILED_IN_BI',
  }],

  FAILED_IN_BI: [{
    name: 'NOTIFY_BI_FAILURE',
    system: 'BI',
  }, {
    name: 'SENT_TO_BI',
  }, {
    name: 'PROCESSED_IN_BI',
  }],
  SENT_TO_BI: [{
    name: 'PROCESSED_IN_BI',
    system: 'BI',
  }, {
    name: 'FAILED_IN_BI',
  }],
  PROCESSED_IN_BI: [{
    name: 'SENT_TO_SALESFORCE',
    system: 'SALESFORCE',
    execute: salesforce.execute,
  }, {
    name: 'FAILED_IN_SALESFORCE',
  }],

  FAILED_IN_SALESFORCE: [{
    name: 'NOTIFY_SALESFORCE_FAILURE',
    system: 'SALESFORCE',
  }, {
    name: 'SENT_TO_SALESFORCE',
  }],
  SENT_TO_SALESFORCE: [{
    name: 'PROCESSED_IN_SALESFORCE',
    system: 'SALESFORCE',
  }, {
    name: 'FAILED_IN_SALESFORCE',
  }],
  PROCESSED_IN_SALESFORCE: [{
    name: 'COMPLETED',
    system: 'SALESFORCE',
    execute: node.execute,
  }],
};

export const getNextAllowedStep = (currentStep) => {
  if (workflowMap[currentStep]) {
    return workflowMap[currentStep];
  }
};

export const isWorkflowUpdateAllowed = (currentStep, newState) => {
  const nextStepsAllowed = getNextAllowedStep(currentStep);

  if (nextStepsAllowed) {
    const names = nextStepsAllowed.map(step => step.name);
    return names.includes(newState);
  }
};

export const triggerNextAction = (nameOfCompletedStep, document) => {
  const nextStep = getNextAllowedStep(nameOfCompletedStep);
  mfLogger.info(`${document.salesForceRequestId}: ${nameOfCompletedStep} completed, sending: ${nextStep[0].name} to ${nextStep[0].system}`);

  if (nextStep && nextStep[0].execute) {
    nextStep[0].execute(document);
  }
};
