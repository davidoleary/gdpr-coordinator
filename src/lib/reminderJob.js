import moment from 'moment';
import AuditLog from '../models/audit-log';
import notifier from '../helpers/notifier';

export default async (settings) => {
  const documents = await AuditLog.aggregate(
    [
      { $sort: { item: 1, logTime: 1 } },
      {
        $group: {
          _id: '$salesForceRequestId',
          lastUpdateDate: { $last: '$logTime' },
          workflowStatus: { $last: '$workflowStatus' }, // get the last workflowStatus for job
          count: {
            $sum: 1,
          },
        },
      },
      { $match: { workflowStatus: { $ne: 'COMPLETED' } } }, // if last workflowStatus is COMPLETED remove it
    ],
  );

  const stuckJobs = documents.filter((doc) => {
    const a = moment(new Date());
    const b = moment(doc.lastUpdateDate);
    const result = a.diff(b, 'days');
    return result > settings.numberOfDaysWithoutChangeAllowed;
  });

  const jobDetails = stuckJobs.map((job) => {
    const d = new Date(job.lastUpdateDate);
    const iso = d.toISOString();
    return `SalesForceRequestId: ${job._id} -- Last update: ${iso}`;
  }).join('');
  /**
   * @todo send emails on stuck only
   */
  if (jobDetails) {
    notifier.sendReminderNotification(jobDetails, settings.numberOfDaysWithoutChangeAllowed);
  }
};
