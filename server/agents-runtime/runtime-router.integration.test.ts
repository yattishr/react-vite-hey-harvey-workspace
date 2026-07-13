import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  getTaskRun: vi.fn(),
  updateTaskRun: vi.fn(),
  publishRuntimeEvent: vi.fn(),
  cancelActiveRun: vi.fn(),
  getTaskById: vi.fn(),
}));

vi.mock("./repositories/task-run-repository", () => ({
  getTaskRun: mocks.getTaskRun,
  updateTaskRun: mocks.updateTaskRun,
}));
vi.mock("./repositories/event-repository", () => ({
  publishRuntimeEvent: mocks.publishRuntimeEvent,
}));
vi.mock("./cancellation", () => ({ cancelActiveRun: mocks.cancelActiveRun }));
vi.mock("../db", async importOriginal => {
  const original = await importOriginal<typeof import("../db")>();
  return { ...original, getTaskById: mocks.getTaskById };
});

const { appRouter } = await import("../routers");

function context(organizationId: number): TrpcContext {
  const user = {
    id: 7,
    supabaseUserId: "00000000-0000-4000-8000-000000000007",
    email: "owner@example.com",
    name: "Owner",
    loginMethod: "supabase",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    organization: {
      id: organizationId,
      name: "Organization",
      slug: `org-${organizationId}`,
      createdByUserId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    membership: {
      id: 1,
      organizationId,
      userId: user.id,
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("tenant-safe run cancellation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTaskRun.mockImplementation(async (organizationId: number) =>
      organizationId === 11
        ? { id: 99, organizationId: 11, taskId: 5, status: "running" }
        : null
    );
    mocks.getTaskById.mockResolvedValue({
      id: 5,
      organizationId: 11,
      userId: 7,
    });
    mocks.cancelActiveRun.mockReturnValue(true);
  });

  it("cancels only a run resolved through the authenticated organization", async () => {
    const result = await appRouter
      .createCaller(context(11))
      .tasks.cancelRun({ taskRunId: 99 });
    expect(result).toEqual({
      taskRunId: 99,
      status: "cancel_requested",
      delivered: true,
    });
    expect(mocks.updateTaskRun).toHaveBeenCalledWith(11, 99, {
      status: "cancel_requested",
    });
  });

  it("does not reveal a run belonging to another organization", async () => {
    await expect(
      appRouter.createCaller(context(12)).tasks.cancelRun({ taskRunId: 99 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.updateTaskRun).not.toHaveBeenCalled();
  });
});
