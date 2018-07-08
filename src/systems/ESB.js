import mfLogger from 'mf-logger';
import config from 'config';
import fetchRT from '../lib/fetch-retry';
import AuditLog from '../models/audit-log';
import notifier from '../helpers/notifier';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';
import { triggerNextAction } from '../helpers/state';

const execute = async (data) => {
  try {
    const result = await fetchRT(config.systemEndPoints.esb.endpoint, {
      retries: 3,
      retryDelay: 1000,
      retryOn: [500],
      body: JSON.stringify({
        customerEmail: data.customerEmailAddress,
        salesForceRequestId: data.salesForceRequestId,
        expectedCompletionDate: data.expectedCompletionDate,
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
      mode: 'cors',
    });

    if (!result.ok) {
      mfLogger.info(`${data.salesForceRequestId}: ESB bad response ${result.status} : ${result.statusText}`);

      const updates = {
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_ESB,
        system: SYSTEMS.ESB,
        nodeAppStatus: helpers.FAILED,
        errorCode: result.status,
        errorDescription: result.statusText,
      };

      const response = await AuditLog.addLogEntry(data.salesForceRequestId, updates);
      notifier.sendNotification(response);
      return response;
    }

    const updates = {
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_ESB,
      system: SYSTEMS.ESB,
    };
    const response = await AuditLog.addLogEntry(data.salesForceRequestId, updates);
    const message = response.content ? response.content.message : '';
    // ESB cannot guarantee the order of the "PROCESSED_IN_ESB" and "SENT_TI_ESB" acknowledgement
    // So we record the the PROCESSED_IN_ESB here
    const newProcessedLogEntryUpdates = {
      workflowStatus: WORKFLOW_STATUSES.PROCESSED_IN_ESB,
      system: SYSTEMS.ESB,
      actionDescription: message,
    };

    mfLogger.info(`${data.salesForceRequestId}: updating to ${WORKFLOW_STATUSES.PROCESSED_IN_ESB}`);
    const processedDoc = await AuditLog.addLogEntry(data.salesForceRequestId, newProcessedLogEntryUpdates);
    triggerNextAction(WORKFLOW_STATUSES.PROCESSED_IN_ESB, processedDoc);

    return response;
  } catch (err) {
    mfLogger.error(err);
    notifier.sendErrorNotification(err);
  }
};

export default {
  execute,
};
