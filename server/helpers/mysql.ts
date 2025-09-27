import { app } from "app";

export const mysql = () => {
  if (!app.mysql) {
    throw new Error("MySQL plugin not initialized");
  }
  return app.mysql;
};
