import app from "./app.js";
import { PORT, HOST } from "./constants/server.js";

// =======================
// Start server
// =======================
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
server.keepAliveTimeout = 12000000; // 2 min
server.headersTimeout = 12100000;
server.requestTimeout = 12000000;
