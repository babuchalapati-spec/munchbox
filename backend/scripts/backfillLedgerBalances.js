// One-off backfill: recompute balanceAfter for every ledger entry, per owner, in
// chronological order — corrects entries that were created with a hardcoded 0
// placeholder instead of a real running balance.
require('dotenv').config();
const mongoose = require('mongoose');
const LedgerEntry = require('../src/models/LedgerEntry');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const owners = await LedgerEntry.distinct('owner');
  let updated = 0;

  for (const ownerId of owners) {
    const entries = await LedgerEntry.find({ owner: ownerId }).sort({ createdAt: 1 });
    let running = 0;
    for (const entry of entries) {
      if (entry.status === 'posted') {
        running += entry.direction === 'credit' ? entry.amount : -entry.amount;
      }
      const rounded = Number(running.toFixed(2));
      if (entry.balanceAfter !== rounded) {
        entry.balanceAfter = rounded;
        await entry.save();
        updated += 1;
      }
    }
  }

  console.log(`Backfilled ${updated} ledger entries across ${owners.length} owners.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
