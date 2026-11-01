import { defineMiddlewares, authenticate } from "@medusajs/framework/http";

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/documents/:id/document",
      methods: ["GET"],
      middlewares: [
        authenticate("user", ["bearer", "session", "api-key"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    {
      matcher: "/admin/documents/templates/preview",
      methods: ["GET"],
      middlewares: [
        authenticate("user", ["bearer", "session", "api-key"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    {
      matcher: "/api/admin/documents/:id/document",
      methods: ["GET"],
      middlewares: [
        authenticate("user", ["bearer", "session", "api-key"], {
          allowUnauthenticated: true,
        }),
      ],
    },
  ],
});
