import config from 'config';
import RequestCount from '../models/request-count';

export const hasReachedMaxRequestThreshold = async () => {
  if (!config.cron.counterJob.isEnforcementEnabled) {
    return false;
  }

  const requestCount = await RequestCount.findOne({});
  if (requestCount) {
    return requestCount.count >= config.cron.counterJob.numberOfRequestsAllowed;
  }

  return false;
};

export const updateRequestCount = () => {
  return RequestCount.findOneAndUpdate({}, { $inc: { count: 1 } }, { upsert: true });
};
