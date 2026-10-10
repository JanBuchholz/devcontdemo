
import express from "express";
import { Collection, MongoClient } from "mongodb";

interface HealthCheckRecord {
  checkedAt: Date;
  healthy: boolean;
  statusCode?: number;
  response?: string;
  error?: string;
}

const port = Number(process.env.PORT ?? 3000);
const mongoUri = process.env.MONGODB_URI ?? "mongodb://mongo:27017";
const healthcheckUrl =
  process.env.HEALTHCHECK_URL ?? `http://127.0.0.1:${port}/health`;
const checkIntervalMs = 10 * 60 * 1000;

const app = express();

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

async function recordHealthCheck(
  collection: Collection<HealthCheckRecord>,
): Promise<void> {
  const record: HealthCheckRecord = {
    checkedAt: new Date(),
    healthy: false,
  };

  try {
    const response = await fetch(healthcheckUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    record.statusCode = response.status;
    record.response = await response.text();
    record.healthy = response.ok;
  } catch (error) {
    record.error = error instanceof Error ? error.message : String(error);
  }

  try {
    await collection.insertOne(record);
    console.log(
      `Health check recorded: ${record.healthy ? "healthy" : "unhealthy"}`,
    );
  } catch (error) {
    console.error("Failed to write health check to MongoDB:", error);
  }
}

async function main(): Promise<void> {
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const collection = mongoClient
    .db("dcd")
    .collection<HealthCheckRecord>("meldungen");

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Health service listening on port ${port}`);
  });

  let probeInProgress = false;
  let activeProbe: Promise<void> | undefined;
  const runProbe = (): void => {
    if (probeInProgress) {
      return;
    }
    probeInProgress = true;
    activeProbe = recordHealthCheck(collection).finally(() => {
      probeInProgress = false;
      activeProbe = undefined;
    });
  };

  runProbe();
  const interval = setInterval(runProbe, checkIntervalMs);

  const shutdown = async (): Promise<void> => {
    clearInterval(interval);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await activeProbe;
    await mongoClient.close();
  };

  process.once("SIGINT", () => {
    void shutdown().catch((error) => {
      console.error("Failed to shut down cleanly:", error);
      process.exitCode = 1;
    });
  });
  process.once("SIGTERM", () => {
    void shutdown().catch((error) => {
      console.error("Failed to shut down cleanly:", error);
      process.exitCode = 1;
    });
  });
}

main().catch((error: unknown) => {
  console.error("Failed to start the health service:", error);
  process.exitCode = 1;
});
