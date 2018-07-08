import 'isomorphic-fetch';
import sql from 'mssql';
import mfLogger from 'mf-logger';
import config from 'config';
import AuditLog from '../models/audit-log';
import notifier from '../helpers/notifier';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';

const biConfig = config.systemEndPoints.bi;

const connectToBIDatabase = async () => {
  const mssqlServer = biConfig.mssqlServer;
  const mssqlDomain = biConfig.mssqlDomain;

  const dbOptions = {
    user: biConfig.user,
    password: biConfig.password,
    server: mssqlServer,
    domain: mssqlDomain,
    requestTimeout: 5 * 60 * 1000, // 5 mins
    options: {
      trustedConnection: true,
    },
    database: biConfig.database,
  };

  return new Promise((resolve, reject) => {
    /**
     * @todo use single connection or pool
     */
    sql.connect(dbOptions, (err, result) => {
      if (err) {
        return reject(err);
      }

      resolve(result);
    });
  });
};

const executeStoredProc = async (anonymizationRequest) => {
  return new Promise((resolve, reject) => {
    const request = new sql.Request();
    request.input('RTBFEmailAddress', sql.NVarChar, anonymizationRequest.customerEmailAddress);
    request.input('SalesForceRequestId', sql.NVarChar, anonymizationRequest.salesForceRequestId);
    request.input('expectedCompletionDate', sql.NVarChar, anonymizationRequest.expectedCompletionDate);
    request.execute('[rtbf].[uspLogRTBFRequests]', (err, result) => {
      if (err) {
        mfLogger.error(`${anonymizationRequest.salesForceRequestId}: error executing sql: ${err}`);
        return reject(err);
      }

      resolve(result);
    });
  });
};

const execute = async (data) => {
  try {
    await connectToBIDatabase();
    const dbResponse = await executeStoredProc(data);
    const updates = {
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_BI,
      system: SYSTEMS.BI,
    };
    const response = await AuditLog.addLogEntry(data.salesForceRequestId, updates);
    return response;
  } catch (err) {
    mfLogger.error(`${data.salesForceRequestId}: BI error executing stored proc ${err}`);
    const updates = {
      workflowStatus: WORKFLOW_STATUSES.FAILED_IN_BI,
      system: SYSTEMS.BI,
      nodeAppStatus: helpers.FAILED,
      errorDescription: err,
    };
    const response = await AuditLog.addLogEntry(data.salesForceRequestId, updates);

    notifier.sendNotification(response);
    return response;
  }
};

export default {
  execute,
};
