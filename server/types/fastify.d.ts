import { MySQLPromisePool } from "@fastify/mysql";

declare module "fastify" {
  interface FastifyInstance {
    mysql: MySQLPromisePool;
    config: {
      SERVER_PORT: number;
      NODE_ENV: string;
      DB_MYSQL_URL: string;
    };
  }
}
