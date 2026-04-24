-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "gpus" INTEGER NOT NULL,
    "nodeId" TEXT,
    "datasetId" TEXT,
    "status" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "Job_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "UploadSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("completedAt", "datasetId", "framework", "gpus", "id", "name", "nodeId", "startedAt", "status", "submittedAt") SELECT "completedAt", "datasetId", "framework", "gpus", "id", "name", "nodeId", "startedAt", "status", "submittedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
