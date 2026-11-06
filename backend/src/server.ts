import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { customersRouter } from "./routes/customers";
import { catalogRouter } from "./routes/catalog";
import { opportunitiesRouter } from "./routes/opportunities";
import { proposalsRouter } from "./routes/proposals";
import { ordersRouter } from "./routes/orders";
import { productionRouter } from "./routes/production";
import { dashboardRouter } from "./routes/dashboard";
import { usersRouter } from "./routes/users";
import { migrationRouter } from "./routes/migration";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "LOGAN | Gestão Integrada API" }));

app.use("/api/auth", authRouter);
app.use("/api/customers", customersRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/opportunities", opportunitiesRouter);
app.use("/api/proposals", proposalsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/production", productionRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/users", usersRouter);
app.use("/api/migration", migrationRouter);

app.use(errorHandler);

const port = Number(process.env.PORT) || 3334;
app.listen(port, () => {
  console.log(`LOGAN | Gestão Integrada — API rodando em http://localhost:${port}`);
});
