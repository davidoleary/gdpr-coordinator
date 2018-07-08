import { ERRORS, WORKFLOW_STATUSES_ARRAY } from '../helpers/constants';

export const getValidationErrors = (body) => {
  const {
    customerEmail,
    salesForceRequestId,
    expectedCompletionDate,
    workflowStatus,
  } = body;

  const validationErrors = [];

  if (!customerEmail) {
    validationErrors.push(ERRORS.EMAIL_REQUIRED);
  }

  if (!salesForceRequestId) {
    validationErrors.push(ERRORS.SALESFORCE_REQUESTID_REQUIRED);
  }

  if (!expectedCompletionDate) {
    validationErrors.push(ERRORS.EXPECTED_COMPLETION_DATE_REQUIRED);
  }

  if (!workflowStatus) {
    validationErrors.push(ERRORS.WORKFLOW_STATUS_REQUIRED);
  }

  if (!WORKFLOW_STATUSES_ARRAY.includes(body.workflowStatus)) {
    validationErrors.push(`${ERRORS.WORKFLOW_STATUS_INVALID}: ${body.workflowStatus}`);
  }

  return validationErrors;
};
