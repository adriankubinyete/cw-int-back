import { buildApp } from "./app";
import { config } from "./config";
import { logger } from "./lib/logger";

async function start() {
	const app = buildApp();

	await app.listen({
		port: config.fastifyPort,
		host: config.fastifyHost,
	});

	logger.info('')
	logger.info(`server started`);
	logger.debug(`host: ` + config.fastifyHost);
	logger.debug(`port: ` + config.fastifyPort);
	logger.info('')
}

start();
