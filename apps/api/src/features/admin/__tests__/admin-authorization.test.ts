import { describe, expect, it } from "vitest";

import type { RequestActor } from "@/features/auth/auth.types";

import {
  adminRouteError,
  authenticateAdminRequest
} from "../admin-route-helpers";
import {
  createAdminRequest,
  createAdminRouteDependencies,
  expectApiError
} from "./admin-route-test-helpers";

describe("admin authorization foundation", () => {
  it("maps missing authentication to 401", async () => {
    const dependencies = createAdminRouteDependencies();

    try {
      await authenticateAdminRequest(createAdminRequest(), dependencies);
      expect.unreachable("Expected authentication to fail.");
    } catch (error) {
      await expectApiError(adminRouteError(error), 401, "UNAUTHORIZED");
    }
  });

  it("maps an invalid token to 401", async () => {
    const dependencies = createAdminRouteDependencies();

    try {
      await authenticateAdminRequest(
        createAdminRequest(undefined, { token: "invalid-token" }),
        dependencies
      );
      expect.unreachable("Expected authentication to fail.");
    } catch (error) {
      await expectApiError(adminRouteError(error), 401, "INVALID_TOKEN");
    }
  });

  it.each([
    {
      label: "active non-admin",
      errorCode: "FORBIDDEN",
      actor: {
        id: "22222222-2222-4222-8222-222222222222",
        roles: ["rider"],
        status: "active"
      }
    },
    {
      label: "suspended admin",
      errorCode: "ACTOR_SUSPENDED",
      actor: {
        id: "33333333-3333-4333-8333-333333333333",
        roles: ["admin"],
        status: "suspended"
      }
    },
    {
      label: "archived admin",
      errorCode: "FORBIDDEN",
      actor: {
        id: "44444444-4444-4444-8444-444444444444",
        roles: ["admin"],
        status: "archived"
      }
    }
  ] satisfies Array<{ label: string; errorCode: string; actor: RequestActor }>)(
    "maps $label to 403",
    async ({ actor, errorCode }) => {
      const dependencies = createAdminRouteDependencies({ actor });
      try {
        await authenticateAdminRequest(
          createAdminRequest(undefined, { token: "valid-token" }),
          dependencies
        );
        expect.unreachable("Expected authorization to fail.");
      } catch (error) {
        await expectApiError(adminRouteError(error), 403, errorCode);
      }
    }
  );

  it("returns an active admin actor", async () => {
    const actor = await authenticateAdminRequest(
      createAdminRequest(undefined, { token: "valid-token" }),
      createAdminRouteDependencies()
    );

    expect(actor).toMatchObject({
      roles: ["admin"],
      status: "active"
    });
  });
});
