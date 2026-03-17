import { buildApp } from "./app";
import { config } from "./config";

async function start() {
	const app = buildApp();

	await app.listen({
		port: config.port,
		host: "0.0.0.0",
	});

	console.log(`Server running on port ${config.port}`);
}

start();
