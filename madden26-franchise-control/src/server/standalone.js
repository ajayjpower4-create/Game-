// Run the tool without Electron: `npm run serve`, then open the printed URL.
import { startServer } from './start.js';
startServer({ port: Number(process.env.PORT) || 3826, host: process.env.HOST || '0.0.0.0', log: console.log }).then(({ urls }) => {
  console.log('Madden 26 Franchise Control');
  for (const u of urls) console.log('  ' + u);
});
