import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import fetch from "node-fetch";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  app.use(express.json({ limit: "50mb" }));

  // ★ここを書き換える
  app.all("/proxy", async (req, res) => {
    const targetUrl = "https://script.google.com/macros/s/AKfycbwCc4b9esvWEPS1ems6tqtKQ_h86a60CJdPpOrORCZLbH0JLJGamwGAfhsVrSrE7fc/exec";
    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Proxy failed" });
    }
  });

  registerOAuthRoutes(app);
  
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`[api] server listening on port ${port}`));
}

startServer().catch(console.error);