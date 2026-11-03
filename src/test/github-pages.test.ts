import { describe, expect, it } from "vitest";
import { createRouter, createMemoryHistory } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "@/routeTree.gen";
describe("GitHub Pages project paths", () => {
  it.each([
    ["/dve/", "/dve/admin", "/admin"],
    ["/dve/", "/dve/akce/ranni-joga-v-parku", "/akce/$id"],
    ["/dve/", "/dve/rezervace/ranni-joga-v-parku", "/rezervace/$id"],
    ["/", "/admin", "/admin"],
  ])("matches %s hosting at %s", async (basepath, path, expected) => {
    const router = createRouter({ routeTree, basepath, history: createMemoryHistory({ initialEntries: [path] }), context: { queryClient: new QueryClient() } });
    await router.load();
    expect(router.state.matches.at(-1)?.routeId).toBe(expected);
    expect(router.buildLocation({ to: "/admin" }).publicHref).toBe(`${basepath}admin`);
  });
});
