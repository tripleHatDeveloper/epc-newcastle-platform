import cors from "cors";
import express from "express";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { buddyRouter } from "./routes/buddy.js";
import { buildingsRouter } from "./routes/buildings.js";
import { reportsRouter } from "./routes/reports.js";

// Exported separately from index.ts so integration tests can exercise the
// real app via supertest without binding a network port.
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/buildings", buildingsRouter); // public
  app.use("/api/reports", reportsRouter); // public
  app.use("/api/buddy", buddyRouter); // public, scoped per-building
  app.use("/api/auth", authRouter); // public (login itself)
  app.use("/api/admin", adminRouter); // requires auth

  return app;
}
