import { treaty } from "@elysiajs/eden";
import type { App } from "../app/api/[[...slugs]]/route";

export const client = treaty<App>("https://realtime-chat-umber-one.vercel.app/").api;
