import mongoose from 'mongoose';

import { WORKFLOW_STATUSES_ARRAY, NODE_STATUSES } from './../helpers/constants';

const Schema = mongoose.Schema;

const AuditLogSchema = new Schema({
  sequenceId: Number,
  salesForceRequestId: { type: String, required: true },
  customerEmailAddress: { type: String },
  loggedBy: { type: String, required: true },
  system: { type: String, required: true },
  workflowStatus: { type: String, enum: WORKFLOW_STATUSES_ARRAY, required: true },
  nodeAppStatus: { type: String, enum: NODE_STATUSES, required: true }, // enum
  logTime: { type: Date, required: true },
  remainingDays: Number,
  actionDescription: String,
  errorCode: String,
  errorDescription: String,
  expectedCompletionDate: Date,
});

AuditLogSchema.statics.addLogEntry = async function (salesForceRequestId, updates) {
  const document = await this.findOne({ salesForceRequestId }).sort([['_id', -1]]);
  let cloneDocument = document.toObject();

  delete cloneDocument._id;
  cloneDocument.logTime = new Date(Date.now()).toISOString();
  cloneDocument = { ...cloneDocument, ...updates };

  const newLogEntry = new this(cloneDocument);
  const response = await newLogEntry.save();
  const responseData = response.toObject();
  return responseData;
};

// export like this to prevent OverwriteModelError during integration tests
export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
