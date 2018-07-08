import mfLogger from 'mf-logger';
import { ERRORS, WORKFLOW_STATUSES, SYSTEMS, helpers, WORKFLOW_ERRORS } from '../helpers/constants';
import { ErrorResponse, Response } from '../helpers/response';
import { isWorkflowUpdateAllowed, triggerNextAction } from '../helpers/state';
import AuditLog from '../models/audit-log';
import { nav } from '../systems';
import notifier from '../helpers/notifier';
import { getValidationErrors } from '../lib/validation';
import { hasReachedMaxRequestThreshold, updateRequestCount } from '../lib/request-count';

const isUnknownRecord = (newStatus, document) => newStatus !== WORKFLOW_STATUSES.INITIATED && !document;

const plugins = {
  nav: {
    sendResponse: (res, data, httpCode) => {
      const xml = nav.XMLResponse({ data });
      res.set('Content-Type', 'application/xml');
      res.status(httpCode);
      res.send(xml);
    },
  },
  defaultJson: {
    sendResponse: (res, data, httpCode) => {
      res.status(httpCode);
      res.json(data);
    },
  },
};

const POST = async (req, res) => {
  mfLogger.info('In updateRTBFStatus handler');

  let data = req.body;
  let plugin = plugins.defaultJson;
  if (req._isNAVRequest) {
    // rawBody is xml from NAV
    data = req.body.updateRTBFStatus;
    plugin = plugins.nav;
  }

  const errors = getValidationErrors(data);
  if (errors.length > 0) {
    if (data.salesForceRequestId) {
      mfLogger.info(`${data.salesForceRequestId}: errors ${errors}`);
    } else {
      mfLogger.info(`Errors ${errors}`);
    }

    const errorResponse = new ErrorResponse()
    .setError(ERRORS.VALIDATION_ERRRORS, ERRORS.SERVER_ERROR, 400)
    .setErrors(errors)
    .getResponse();

    plugin.sendResponse(res, errorResponse, 400);
    return;
  }

  const newStatus = data.workflowStatus;
  const document = await AuditLog.findOne({ salesForceRequestId: data.salesForceRequestId }).sort([['_id', -1]]);

  if (isUnknownRecord(newStatus, document)) {
    const errorMessage = 'Unknown salesForceRequestId make sure it has been INITIATED';
    mfLogger.info(`${data.salesForceRequestId}: ${errorMessage}`);

    const jsonBody = new ErrorResponse()
    .setError(errorMessage, ERRORS.WORKFLOW_CHANGE_INVALID, 400)
    .getResponse();

    plugin.sendResponse(res, jsonBody, 400);
    return;
  }

  if (!document) {
    try {
      const isAtMax = await hasReachedMaxRequestThreshold();
      if (isAtMax) {
        const errorResponse = new ErrorResponse()
          .setError(ERRORS.VALIDATION_ERRRORS, ERRORS.SERVER_ERROR, 400)
          .setErrors(ERRORS.MAX_REQUESTS)
          .getResponse();

        mfLogger.info(ERRORS.MAX_REQUESTS);
        plugin.sendResponse(res, errorResponse, 400);
        return;
      }

      const newLogEntry = new AuditLog({
        // sequenceId: 1, // TODO: determine if this is needed anymore, mongo ObjectId might be good enough
        salesForceRequestId: data.salesForceRequestId,
        customerEmailAddress: data.customerEmail,
        loggedBy: data.loggedBy,
        system: SYSTEMS.SALESFORCE,
        workflowStatus: WORKFLOW_STATUSES.INITIATED,
        nodeAppStatus: helpers.IN_PROGRESS,
        logTime: Date.now(),
        remainingDays: helpers.DEFAULT_REMAINING_DAYS,
        actionDescription: '',
        expectedCompletionDate: data.expectedCompletionDate,
      });

      await updateRequestCount();

      const response = await newLogEntry.save();
      const responseData = response.toObject();
      const validResponse = new Response()
        .setContent(responseData)
        .getResponse();

      plugin.sendResponse(res, validResponse, 200);
      triggerNextAction(newStatus, newLogEntry);
      return;
    } catch (err) {
      mfLogger.error(`${data.salesForceRequestId}: ${err}`);
      return;
    }
  }

  const currentStatus = document.workflowStatus;
  if (currentStatus !== WORKFLOW_STATUSES.INITIATED
    && !isWorkflowUpdateAllowed(currentStatus, newStatus)) {
    const errorMessage = `Cannot jump from ${currentStatus} to ${newStatus}`;
    mfLogger.info(`${document.salesForceRequestId}: ${errorMessage}`);
    const jsonBody = new ErrorResponse()
    .setError(errorMessage, ERRORS.WORKFLOW_CHANGE_INVALID, 400)
    .getResponse();

    plugin.sendResponse(res, jsonBody, 400);
    return;
  }

  if (currentStatus === WORKFLOW_STATUSES.INITIATED && newStatus === WORKFLOW_STATUSES.INITIATED) {
    const errorMessage = `The request ${data.salesForceRequestId} has already been Initiated`;
    mfLogger.info(`${document.salesForceRequestId}: ${errorMessage}`);
    const jsonBody = new ErrorResponse()
      .setError(errorMessage, ERRORS.WORKFLOW_CHANGE_INVALID, 400)
      .getResponse();

    plugin.sendResponse(res, jsonBody, 400);
    return;
  }

  const cloneDocument = document.toObject();
  delete cloneDocument._id;
  cloneDocument.workflowStatus = newStatus;
  cloneDocument.logTime = new Date(Date.now()).toISOString();
  if (data.errorDescription) {
    cloneDocument.errorDescription = data.errorDescription;
  }

  const newLogEntry = new AuditLog(cloneDocument);
  const response = await newLogEntry.save();
  const responseData = response.toObject();
  // need to set to string as xml parser breaks on dates
  responseData.expectedCompletionDate = new Date(response.expectedCompletionDate).toISOString();
  responseData.logTime = new Date(response.logTime).toISOString();

  // send acknowledgement to system sending update
  const validResponse = new Response()
    .setContent(responseData)
    .getResponse();

  triggerNextAction(newStatus, document);

  if (WORKFLOW_ERRORS.includes(newStatus)) {
    mfLogger.info(`${document.salesForceRequestId}: ${newStatus}`);
    notifier.sendNotification(response);
    plugin.sendResponse(res, validResponse, 400);
    return;
  }
  plugin.sendResponse(res, validResponse, 200);
};

export default {
  POST,
};
