// Runs automatically before `npm run dev` / `npm start` (see package.json "pre*" hooks).
// If the backend is already running in another terminal, this stops the second copy
// from crashing with a scary EADDRINUSE stack trace and instead prints one plain line.
require('dotenv').config();
const net = require('net');

const PORT = process.env.PORT || 5001;

const tester = net
  .createServer()
  .once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('');
      console.log(`Munchbox backend is already running on port ${PORT} — no need to start it again.`);
      console.log('Just use the app or website as normal. If you really need to restart it,');
      console.log('close the other window/terminal that already has it running first.');
      console.log('');
      process.exit(1);
    }
    // Any other error: don't block startup, let the real server report it.
    process.exit(0);
  })
  .once('listening', () => {
    tester.close(() => process.exit(0));
  })
  .listen(PORT); // no host specified — matches Node's default dual-stack (::) bind used by the real server
