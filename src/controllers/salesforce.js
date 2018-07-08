import mfLogger from 'mf-logger';
import salesforce from '../systems/salesforce';

const POST = async (req, res) => {
  const anonymisationRequests = req.body;
  anonymisationRequests.forEach((anonRequest) => {
    mfLogger.info(`${anonRequest.salesForceRequestId}: sending to /gdpr/api/v1/updateRTBFStatus`);
    req.runMiddleware('/gdpr/api/v1/updateRTBFStatus', {
      method: 'post',
      body: anonRequest,
    }, (code, data) => {
      const result = JSON.parse(data);
      if (code !== 200) {
        result.content.salesForceRequestId = anonRequest.salesForceRequestId;
        mfLogger.info(`${anonRequest.salesForceRequestId}: updateRTBFStatus returned an error, sending info to salesforce`);
        salesforce.acknowledgeInitialisationFromSalesforce(result.content);
        return;
      }

      mfLogger.info(`${anonRequest.salesForceRequestId}: updateRTBFStatus passed sending info to salesforce`);
      salesforce.acknowledgeInitialisationFromSalesforce(result.content);
    });
  });

  res.json({ status: 200 });
};

const POSTComplete = async (req, res) => {
  const anonymisationRequests = req.body;
  anonymisationRequests.forEach((anonRequest) => {
    mfLogger.info(`${anonRequest.salesForceRequestId}: sending completed to /gdpr/api/v1/updateRTBFStatus`);
    req.runMiddleware('/gdpr/api/v1/updateRTBFStatus', {
      method: 'post',
      body: anonRequest,
    }, (code, data) => {
      const result = JSON.parse(data);
      if (code !== 200) {
        result.content.salesForceRequestId = anonRequest.salesForceRequestId;
        mfLogger.info(`${anonRequest.salesForceRequestId}: updateRTBFStatus for SF completed returned an error, sending info to salesforce`);

        salesforce.acknowledgeCompletionWithSalesforce(result.content);
        return;
      }

      mfLogger.info(`${anonRequest.salesForceRequestId}: updateRTBFStatus passed sending complete acknowledgement to salesforce`);
      salesforce.acknowledgeCompletionWithSalesforce(result.content);
    });
  });
  res.json({ status: 200 });
};

export default {
  POST,
  POSTComplete,
};
