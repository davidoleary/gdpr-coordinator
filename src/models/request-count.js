import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const RequestCountSchema = new Schema({
  count: { type: Number, required: true, default: 0 },
});

// export like this to prevent OverwriteModelError during integration tests
export default mongoose.models.RequestCount || mongoose.model('RequestCount', RequestCountSchema);
