import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db/connection.js";
import waitlistRoutes from "./routes/waitlistRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import operatorsRoutes from "./routes/operatorsRoutes.js";
import superusersRoutes from "./routes/superusersRoutes.js";
import adminsRoutes from "./routes/adminsRoutes.js";
import permissionsRoutes from "./routes/permissionsRoutes.js";
import { seedOperator } from "./seeders/operatorSeeder.js";
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

app.use(authRoutes);
app.use(waitlistRoutes);
app.use(statsRoutes);
app.use(operatorsRoutes);
app.use(superusersRoutes);
app.use(adminsRoutes);
app.use(permissionsRoutes);

const PORT = process.env.PORT || 4500;
app.listen(PORT, async () => {
  await connectDB();
  await seedOperator();
  console.log(`Server is running on port ${PORT}`);
});
