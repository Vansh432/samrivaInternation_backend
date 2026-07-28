import Counter from '../../database/models/counter.model.js';

// Atomically reserves `count` numbers from the named sequence and returns the inclusive
// range [start, end] that was just allocated (count=1 -> start === end). Used for anything
// that needs gap-free sequential numbers shared across the whole app — Investor ID, Folio
// No, and Debenture No ranges (sized by units) on debenture certificates.
export const getNextSequenceRange = async (name, count = 1) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { value: count } },
    { new: true, upsert: true }
  );
  const end = counter.value;
  const start = end - count + 1;
  return { start, end };
};

export const getNextSequence = async (name) => {
  const { start } = await getNextSequenceRange(name, 1);
  return start;
};

export const padSequence = (num, length = 6) => String(num).padStart(length, '0');
