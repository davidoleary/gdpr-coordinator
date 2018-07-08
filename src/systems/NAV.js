import json2xml from 'json2xml';
import mfLogger from 'mf-logger';
import { ntlmProxy, systemEndPoints } from 'config';
import HttpsProxyAgent from 'http-proxy-agent';
import AuditLog from '../models/audit-log';
import fetchRT from '../lib/fetch-retry';
import notifier from '../helpers/notifier';
import { SYSTEMS, WORKFLOW_STATUSES, helpers } from '../helpers/constants';
import formatter from '../helpers/date-formatter';

const XMLResponse = (json) => {
  const result = json2xml(json, { header: true });
  return result;
};

const execute = async (data) => {
  try {
    const expectedCompletionDateNAV = formatter.formatDateAndTime(data.expectedCompletionDate);
    const soapTemplate = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ems="urn:microsoft-dynamics-schemas/codeunit/EMS2NAV">
      <soapenv:Header/>
      <soapenv:Body>
          <ems:LoadGDPRRequest>
            <ems:xMLString><![CDATA[<?xml version="1.0" encoding="UTF-8"?><AnonymizeInNav>
            <customerEmail>${data.customerEmailAddress}</customerEmail>
            <salesforceRequestId>${data.salesForceRequestId}</salesforceRequestId>
            <expectedCompletionDate>${expectedCompletionDateNAV}</expectedCompletionDate>
            </AnonymizeInNav>]]></ems:xMLString>
          </ems:LoadGDPRRequest>
      </soapenv:Body>
    </soapenv:Envelope>`;

    const uri = systemEndPoints.nav.endpoint;
    const result = await fetchRT(uri, {
      retries: 3,
      retryDelay: 1000,
      retryOn: [500],
      method: 'POST',
      body: soapTemplate,
      agent: new HttpsProxyAgent(ntlmProxy),
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        Connection: 'Keep-Alive',
        SOAPAction: 'urn:microsoft-dynamics-schemas/codeunit/EMS2NAV:LoadGDPRRequest',
      },
    });

    if (!result.ok) {
      const updates = {
        workflowStatus: WORKFLOW_STATUSES.FAILED_IN_NAV,
        system: SYSTEMS.NAV,
        nodeAppStatus: helpers.FAILED,
        errorCode: result.status,
        errorDescription: result.statusText,
      };
      const response = await AuditLog.addLogEntry(data.salesForceRequestId, updates);
      notifier.sendNotification(response);
      return response;
    }

    const updates = {
      workflowStatus: WORKFLOW_STATUSES.SENT_TO_NAV,
      system: SYSTEMS.NAV,
    };
    const response = await AuditLog.addLogEntry(data.salesForceRequestId, updates);
    return response;
  } catch (err) {
    mfLogger.error(err);
    notifier.sendErrorNotification(err);
  }
};

export default {
  XMLResponse,
  execute,
};

