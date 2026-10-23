// Entry point: start the app from app.ts on PORT.
import { app } from "./app";
import { PORT } from "./config";

app.listen(PORT);

console.log(`Community Notice Board API running at ${app.server?.url}`);
