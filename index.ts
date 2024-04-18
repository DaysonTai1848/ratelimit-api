import { Context, Env, Hono } from "hono";
import { todos } from "./data.json";
import { Ratelimit } from "@upstash/ratelimit";
import { BlankInput } from "hono/types";
import { env } from "hono/adapter";
import { Redis } from "@upstash/redis/cloudflare";

declare module "hono" {
  interface ContextVariableMap {
    ratelimit: Ratelimit;
  }
}

const app = new Hono();

const cache = new Map();

// Ratelimiter
class RedisRateLimiter {
  static instance: Ratelimit;

  static getInstance(c: Context<Env, "/todos/:id", BlankInput>) {
    if (!this.instance) {
      const { REDIS_URL, REDIS_TOKEN } = env<{
        REDIS_URL: string;
        REDIS_TOKEN: string;
      }>(c);

      const redisClient = new Redis({
        token: REDIS_TOKEN,
        url: REDIS_URL,
      });

      const ratelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(10, "10 s"), // not more than 10 requests in 10 seconds
        ephemeralCache: cache,
      });

      this.instance = ratelimit;
      return this.instance;
    } else {
      return this.instance;
    }
  }
}

// middleware of ratelimit
app.use(async (c, next) => {
  const ratelimit = RedisRateLimiter.getInstance(c);
  c.set("ratelimit", ratelimit);
  await next();
});

// c = context
app.get("/todos/:id", async (c) => {
  // RATELIMITING
  const ratelimit = c.get("ratelimit");
  const ip = c.req.raw.headers.get("CF-Connecting-IP");
  const { success } = await ratelimit.limit(ip ?? "anonymous");

  if (success) {
    // todoId is a string
    const todoId = c.req.param("id");
    // convert todoId to number
    const todoIndex = Number(todoId);

    // get todo from todos array
    const todo = todos[todoIndex - 1] || {};
    return c.json({ todo });
  } else {
    return c.json({ message: "Too Many Requests" }, { status: 429 });
  }
});

export default app;
