// delivery-service — bootable skeleton. See README.md in this folder for the API contract
// this service is responsible for implementing, and ARCHITECTURE.md at the repo
// root for how it fits into the overall system.
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const SERVICE_NAME = 'delivery-service';
const PORT = process.env.PORT || 4004;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

// TODO: mount this service's real routes here as they're migrated out of
// backend/src (the existing monolith) — see ARCHITECTURE.md §6 for migration order.

app.listen(PORT, () => {
  console.log(`[${SERVICE_NAME}] listening on port ${PORT}`);
});
