const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Dev-only: watch product collection for changes to aid debugging
  if (process.env.NODE_ENV === "development") {
    try {
      const Product = require("./models/Product");
      const changeStream = Product.watch([], { fullDocument: "updateLookup" });
      changeStream.on("change", (change) => {
        console.log("[PRODUCT_CHANGE]", JSON.stringify(change));
      });
    } catch (err) {
      console.warn("[PRODUCT_CHANGE] Change stream unavailable:", err.message || err);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err.message);
    server.close(() => process.exit(1));
  });
};

startServer();
