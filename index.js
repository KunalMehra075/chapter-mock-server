import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db/connection.js";
import emailRoutes from "./routes/emailRoutes.js";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Chapter Landing Page Server");
});

app.use(emailRoutes);

const PORT = process.env.PORT || 4500;
app.listen(PORT, () => {
  connectDB();
  console.log(`Server is running on port ${PORT}, allowed Origin: ${APP_URL}`);
});
