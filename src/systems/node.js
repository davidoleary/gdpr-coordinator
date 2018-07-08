import 'isomorphic-fetch';
import mfLogger from 'mf-logger';
import AuditLog from '../models/audit-log';
import notifier from '../helpers/notifier';
import { SYSTEMS, WORKFLOW_STATUSES } from '../helpers/constants';
import { generateOnewayHash } from '../lib/hashing';

const execute = async (data) => {
  try {
    mfLogger.info(`${data.salesForceRequestId}: Anonymisation request completed by salesforce`);

    const document = await AuditLog.findOne({ salesForceRequestId: data.salesForceRequestId }).sort([['_id', -1]]);
    const cloneDocument = document.toObject();
    delete cloneDocument._id;
    cloneDocument.logTime = new Date(Date.now()).toISOString();
    cloneDocument.workflowStatus = WORKFLOW_STATUSES.COMPLETED;
    cloneDocument.system = SYSTEMS.NODE;

    const newLogEntry = new AuditLog(cloneDocument);
    await newLogEntry.save();

    const emailHash = generateOnewayHash(data.customerEmailAddress, data.salesForceRequestId);
    await AuditLog.update(
      { salesForceRequestId: data.salesForceRequestId },
      { customerEmailAddress: emailHash },
      { multi: true });

    const lastDocumentEntry = await AuditLog.findOne({ salesForceRequestId: data.salesForceRequestId }).sort([['_id', -1]]);
    const responseData = lastDocumentEntry.toObject();
    mfLogger.info(`${data.salesForceRequestId}: Node audit log data anonymised`);
    mfLogger.info(`${data.salesForceRequestId}: All anonymised`);

    return responseData;
  } catch (err) {
    mfLogger.error(err);
    return notifier.sendErrorNotification(err);
  }
};

export default {
  execute,
};
