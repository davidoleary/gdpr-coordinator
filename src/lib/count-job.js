import RequestCount from '../models/request-count';

export default async () => {
  return RequestCount.findOneAndUpdate({}, { count: 0 });
};
