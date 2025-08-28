import { app } from "./app";
import { PORT } from "./config";

/**
 * Run the server!
 */
const start = async () => {
  try {
    app.log.info(`udaman is running on port ${PORT}`);
    await app.listen({ port: PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
