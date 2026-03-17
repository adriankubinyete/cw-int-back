import { buildApp } from "./app";
import { config } from "./config";
import { logger } from "./lib/logger";

async function start() {
	const app = buildApp();

	await app.listen({
		port: config.port,
		host: "0.0.0.0",
	});

	logger.debug("server started", { port: config.port });
}

start();
