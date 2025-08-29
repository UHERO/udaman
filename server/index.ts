import { app } from "./app";

/**
 * Run the server!
 */
const start = async () => {
  try {
    app.log.info(`udaman is running on port ${app.config.SERVER_PORT}`);
    await app.listen({ port: app.config.SERVER_PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
