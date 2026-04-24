-- CreateTable
CREATE TABLE "TelemetrySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeName" TEXT NOT NULL,
    "gpu" INTEGER NOT NULL,
    "memory" INTEGER NOT NULL,
    "temp" REAL NOT NULL,
    "power" REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
