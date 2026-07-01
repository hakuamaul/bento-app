import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import fetch from "node-fetch"; // 事前にインストールした道具を使用します

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // CORS設定：すべてのルートからのアクセスを許可
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ✨ 【新設】Netlifyからのデータ要求をGoogleスプレッドシート（GAS）へ中継する窓口
  app.all("/proxy", async (req, res) => {
    try {
      const gasUrl = "https://script.google.com/macros/s/AKfycbwi7MOdmtz0iR6JlxVVDvr0lnxzyuQniDDpdVsOy4dhioqZSRbrmSg0avwC3qRPJU4/exec";
      
      // 画面から送られてきたクエリパラメータ（?action=xxxなど）をGASのURLに結合
      const url = new URL(gasUrl);
      Object.keys(req.query).forEach((key) => {
        url.searchParams.append(key, req.query[key] as string);
      });

      const options: any = {
        method: req.method,
        headers: {
          "Accept": "application/json",
        },
      };

      // POSTなどの場合は、送られてきた中身（予約内容など）もそのままGASへ引き渡す
      if (req.method !== "GET" && req.method !== "HEAD") {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(req.body);
      }

      // Googleのサーバーにデータをデータを取りに行く
      const response = await fetch(url.toString(), options);
      const data = await response.json();
      
      // 取ってきたデータをそのままNetlifyの画面に返却する
      res.json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Failed to fetch data from Google Sheets via Proxy" });
    }
  });

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);