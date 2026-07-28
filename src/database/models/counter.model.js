import mongoose from 'mongoose';

// Cross-cutting sequence generator — not owned by a single module, since Investor ID,
// Folio No and Debenture No (certificates) all need gap-free, collision-free sequential
// numbers. A single findOneAndUpdate with $inc is atomic at the Mongo level, so concurrent
// requests (e.g. two admins approving investments at once) can never allocate the same number.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // sequence name, e.g. 'investorId', 'folioNumber', 'debentureNo'
  value: { type: Number, default: 0 },
});

export default mongoose.model('Counter', counterSchema);
