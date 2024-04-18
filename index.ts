import { Hono } from "hono";
import { todos } from "./data.json";

const app = new Hono();

// c = context
app.get("/todos/:id", (c) => {
  // todoId is a string
  const todoId = c.req.param("id");
  // convert todoId to number
  const todoIndex = Number(todoId);

  // get todo from todos array
  const todo = todos[todoIndex - 1] || {};
  return c.json({ todo });
});

export default app;
