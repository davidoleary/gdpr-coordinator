import mfLogger from 'mf-logger';
import config from 'config';
import fetchRT from '../lib/fetch-retry';
import AuditLog from '../models/audit-log';
import notifier from '../helpers/notifier';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';

const execute = async (data) => {
  try {
    const buff = new Buffer(`${config.systemEndPoints.hybris.username}:${config.systemEndPoints.hybris.password}`);

    const base64data = buff.toString('base64');
    const result = await fetchRT(config.systemEndPoints.hybris.endpoint, {
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
        Authorization: `Basic ${base64data}`,
      },
      method: 'POST',
      mode: 'cors',
    });

    if (!result.ok) {
      const updates = {
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_HYBRIS,
        system: SYSTEMS.HYBRIS,
        nodeAppStatus: helpers.FAILED,
        errorCode: result.status,
        errorDescription: result.statusText,
      };
      const response = await AuditLog.addLogEntry(data.salesForceRequestId, updates);

      notifier.sendNotification(response);
      return response;
    }

    const updates = {
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_HYBRIS,
      system: SYSTEMS.HYBRIS,
    };

    const response = await AuditLog.addLogEntry(data.salesForceRequestId, updates);

    return response;
  } catch (err) {
    mfLogger.error(err);
    return notifier.sendErrorNotification(err);
  }
};

export default {
  execute,
};
