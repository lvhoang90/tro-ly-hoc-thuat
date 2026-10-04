// Tệp khởi động cho cPanel "Setup Node.js App" (Passenger): nạp máy chủ đã đóng gói bằng `npm run build:server`.
process.env.NODE_NO_WARNINGS = "1";
import("./server-dist/index.mjs").catch((e) => { console.error(e); process.exit(1); });
