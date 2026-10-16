import { createServer } from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

// HTTPサーバー（ヘルスチェック用）
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
});

// 同じポートでWebSocketを受け付ける
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  console.log("connected:", req.socket.remoteAddress);
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    const text = data.toString();
    // 全クライアントにブロードキャスト
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(text);
    });
  });

  ws.on("close", () => console.log("closed"));
  ws.on("error", (err) => console.error("ws error:", err.message));

  ws.send("welcome");
});

// 死んだ接続の掃除 + プロキシのアイドル切断対策（30秒ごと）
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(interval));

// デプロイ時の終了シグナルできれいに閉じる
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down");
  wss.clients.forEach((c) => c.close(1001, "server restarting"));
  server.close(() => process.exit(0));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`listening on ${PORT}`);
});