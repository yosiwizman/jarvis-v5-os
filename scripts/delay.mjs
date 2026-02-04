const ms = Number.parseInt(process.argv[2] || "0", 10);
const delay = Number.isFinite(ms) ? ms : 0;

setTimeout(() => {
  process.exit(0);
}, delay);
