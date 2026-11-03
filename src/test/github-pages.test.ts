import { describe, expect, it } from "vitest";
import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "@/routeTree.gen";
describe("GitHub Pages project paths", () => {
  it.each([
    ["/dve/", "/dve/admin", "/admin"],
    ["/dve/", "/dve/akce/ranni-joga-v-parku", "/akce/$id"],
    ["/dve/", "/dve/rezervace/ranni-joga-v-parku", "/rezervace/$id"],
    ["/", "/admin", "/admin"],
  ])("matches %s hosting at %s", (basepath, path, expected) => {
    const router = createRouter({ routeTree, basepath, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(expected);
  });
});
