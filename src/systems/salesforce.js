import jsforce from 'jsforce';
import config from 'config';
import mfLogger from 'mf-logger';
import AuditLog from '../models/audit-log';
import notifier from '../helpers/notifier';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';

const login = async () => {
  const username = config.systemEndPoints.salesforce.username;
  const password = config.systemEndPoints.salesforce.password;

  return new Promise((resolve, reject) => {
    const conn = new jsforce.Connection({
      loginUrl: config.systemEndPoints.salesforce.endpoint,
    });

    conn.login(username, password, (err, userInfo) => {
      if (err) {
        mfLogger.error(err);
        notifier.sendErrorNotification(err);
        reject(err);
        return;
      }

      resolve({ userInfo, conn });
    });
  });
};

const apexGet = (functionName) => {
  return new Promise(async (resolve, reject) => {
    let loginResult;
    try {
      loginResult = await login();
    } catch (err) {
      return reject(err);
    }

    loginResult.conn.apex.get(functionName, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
};

const apexPost = (functionName, data, salesForceRequestId) => {
  return new Promise(async (resolve, reject) => {
    let loginResult;
    try {
      loginResult = await login();
    } catch (err) {
      return reject(err);
    }
    loginResult.conn.apex.post(functionName, data, (err) => {
      if (err) {
        mfLogger.error(err);
        reject(err);
        return;
      }

      if (salesForceRequestId) {
        mfLogger.info(`${salesForceRequestId}: ok response from ${functionName}`);
      }
      resolve();
    });
  });
};

const pullRightToBeForgottenRequestsFromSalesforce = async () => {
  return apexGet('/NewRTBFRequests');
};

const pullCompletedJobsFromSalesforce = async () => {
  return apexGet('/CompletedRTBFRequests');
};


const acknowledgeInitialisationFromSalesforce = async (response) => {
  const data = {
    RTBFRequestAcknowledgements: [],
  };

  if (response.error) {
    data.RTBFRequestAcknowledgements.push({
      salesForceRequestId: response.salesForceRequestId,
      status: 'Error',
      message: response.error.message,
    });
  } else {
    data.RTBFRequestAcknowledgements.push({
      salesForceRequestId: response.salesForceRequestId,
      status: 'ACKNOWLEDGED',
    });
  }

  return apexPost('/RTBFRequestAcknowledgements', data);
};

// once we pull and update out audit log
// send an ack back to salesforce
// this allows salesforce to track what
// jobs will be returned on the next CompletedRTBFRequests
const acknowledgeCompletionWithSalesforce = async (response) => {
  const data = {
    CompletedRTBFAcknowledgments: [],
  };

  if (response.error) {
    mfLogger.error(`${response.salesForceRequestId}: acknowledgeCompletionWithSalesforce error ${response.error.message}`);
    mfLogger.error(`${response.salesForceRequestId} ${JSON.stringify(response.error)}`);
    data.CompletedRTBFAcknowledgments.push({
      salesForceRequestId: response.salesForceRequestId,
      status: 'Error',
      message: response.error.message,
    });
  } else {
    mfLogger.info(`${response.salesForceRequestId}: acknowledgeCompletionWithSalesforce passed`);
    data.CompletedRTBFAcknowledgments.push({
      salesForceRequestId: response.salesForceRequestId,
      status: WORKFLOW_STATUSES.COMPLETED,
    });
  }

  return apexPost('/CompletedRTBFAcknowledgments', data, response.salesForceRequestId);
};

const execute = async (data) => {
  try {
    const sfData = {
      customerEmail: data.customerEmail,
      salesForceRequestId: data.salesForceRequestId,
      expectedCompletionDate: data.expectedCompletionDate,
    };

    await apexPost('/services/apexrest/anonymizeInSalesforce', sfData);
    mfLogger.info(`${data.salesForceRequestId}: Anonymisation request sent to salesforce`);

    const updates = {
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_SALESFORCE,
      system: SYSTEMS.SALESFORCE,
    };
    return await AuditLog.addLogEntry(data.salesForceRequestId, updates);
  } catch (err) {
    mfLogger.error(`anonymizeInSalesforce error ${err}`);

    const updates = {
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_SALESFORCE,
      system: SYSTEMS.SALESFORCE,
      nodeAppStatus: helpers.FAILED,
      errorCode: '',
      errorDescription: err,
    };
    notifier.sendErrorNotification(err);
    const response = await AuditLog.addLogEntry(data.salesForceRequestId, updates);
    return response;
  }
};

export default {
  pullRightToBeForgottenRequestsFromSalesforce,
  pullCompletedJobsFromSalesforce,
  acknowledgeInitialisationFromSalesforce,
  acknowledgeCompletionWithSalesforce,
  execute,
};
