import { NOMEM } from "dns";

const NODE_STATUSES = [
  'IN_PROGRESS',
  'FAILED',
  'COMPLETED',
];

const SYSTEMS = {
  NODE: 'NODE',
  HYBRIS: 'HYBRIS',
  BI: 'BI',
  ESB: 'ESB',
  NAV: 'NAV',
  SALESFORCE: 'SALESFORCE',
};

const ERRORS = {
  EMAIL_REQUIRED: 'customerEmail is required',
  SALESFORCE_REQUESTID_REQUIRED: 'salesForceRequestId is required',
  EXPECTED_COMPLETION_DATE_REQUIRED: 'expectedCompletionDate is required',
  WORKFLOW_STATUS_REQUIRED: 'workflowStatus is required',
  WORKFLOW_STATUS_INVALID: 'workflowStatus is invalid',
  SERVER_ERROR: 'server error',
  WORKFLOW_CHANGE_INVALID: 'work flow change invalid',
  VALIDATION_ERRRORS: 'validation errors',
  MAX_REQUESTS: 'maximum number of requests reached',
};

const helpers = {
  DEFAULT_REMAINING_DAYS: 30,
  IN_PROGRESS: NODE_STATUSES[0],
  FAILED: NODE_STATUSES[1],
};

const WORKFLOW_STATUSES = {
  INITIATED: 'INITIATED',
  SENT_TO_HYBRIS: 'SENT_TO_HYBRIS',
  FAILED_IN_HYBRIS: 'FAILED_IN_HYBRIS',
  NOTIFY_HYBRIS_FAILURE: 'NOTIFY_HYBRIS_FAILURE',
  PROCESSED_IN_HYBRIS: 'PROCESSED_IN_HYBRIS',
  SENT_TO_NAV: 'SENT_TO_NAV',
  FAILED_IN_NAV: 'FAILED_IN_NAV',
  NOTIFY_NAV_FAILURE: 'NOTIFY_NAV_FAILURE',
  PROCESSED_IN_NAV: 'PROCESSED_IN_NAV',
  SENT_TO_ESB: 'SENT_TO_ESB',
  FAILED_IN_ESB: 'FAILED_IN_ESB',
  NOTIFY_ESB_FAILURE: 'NOTIFY_ESB_FAILURE',
  PROCESSED_IN_ESB: 'PROCESSED_IN_ESB',
  SENT_TO_BI: 'SENT_TO_BI',
  FAILED_IN_BI: 'FAILED_IN_BI',
  NOTIFY_BI_FAILURE: 'NOTIFY_BI_FAILURE',
  PROCESSED_IN_BI: 'PROCESSED_IN_BI',
  SENT_TO_SALESFORCE: 'SENT_TO_SALESFORCE',
  FAILED_IN_SALESFORCE: 'FAILED_IN_SALESFORCE',
  NOTIFY_SALESFORCE_FAILURE: 'NOTIFY_SALESFORCE_FAILURE',
  PROCESSED_IN_SALESFORCE: 'PROCESSED_IN_SALESFORCE',
  COMPLETED: 'COMPLETED',
};

const WORKFLOW_ERRORS = [
  'FAILED_IN_HYBRIS',
  'FAILED_IN_NAV',
  'FAILED_IN_ESB',
  'FAILED_IN_BI',
  'FAILED_IN_SALESFORCE',
];

const WORKFLOW_STATUSES_ARRAY = Object.values(WORKFLOW_STATUSES);

export {
  WORKFLOW_ERRORS,
  WORKFLOW_STATUSES_ARRAY,
  WORKFLOW_STATUSES,
  NODE_STATUSES,
  SYSTEMS,
  ERRORS,
  helpers,
};
