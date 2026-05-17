import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db/connection.js";
import waitlistRoutes from "./routes/waitlistRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import tenetsRoutes from "./routes/tenetsRoutes.js";
import operatorsRoutes from "./routes/operatorsRoutes.js";
import partnersRoutes from "./routes/partnersRoutes.js";
import adminGroupsRoutes from "./routes/adminGroupsRoutes.js";
import permissionsRoutes from "./routes/permissionsRoutes.js";
import bottleMessagesPublicRoutes from "./routes/bottleMessagesPublicRoutes.js";
import bottleMessagesAdminRoutes from "./routes/bottleMessagesAdminRoutes.js";
import { seedTenet } from "./seeders/tenetSeeder.js";
dotenv.config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Hello from Chapter Landing Page Server");
});

// Public Routes
app.use(bottleMessagesPublicRoutes);

// Private Rutes
app.use(waitlistRoutes);
app.use(authRoutes);
app.use(statsRoutes);
app.use(tenetsRoutes);
app.use(operatorsRoutes);
app.use(partnersRoutes);
app.use(adminGroupsRoutes);
app.use(permissionsRoutes);
app.use(bottleMessagesAdminRoutes);

const PORT = process.env.PORT || 4500;
app.listen(PORT, async () => {
  await connectDB();
  await seedTenet();
  console.log(`Server is running on port ${PORT}`);
});
