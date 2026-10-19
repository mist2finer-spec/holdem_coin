const { io } = require("socket.io-client");
const socket = io("http://127.0.0.1:3003", { transports: ["polling"], reconnection: false, timeout: 5000 });
socket.on("connect", () => { console.log("CONNECTED:", socket.id); socket.emit("JOIN_ROOM", { name: "TestHero" }); });
socket.on("TABLE_STATE", (d) => { console.log("STATE:", d.phase, "seat:", d.mySeatId, "handInProgress:", d.handInProgress); socket.disconnect(); process.exit(0); });
socket.on("connect_error", (e) => { console.error("ERROR:", e.message); process.exit(1); });
setTimeout(() => { console.error("TIMEOUT"); process.exit(1); }, 10000);
