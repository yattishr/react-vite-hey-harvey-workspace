import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook to poll task status and execution logs in real-time
 * Automatically refetches every 2 seconds while task is running
 */
export function useTaskPolling(taskId: number | null, enabled: boolean = true) {
  const utils = trpc.useUtils();

  // Poll task status
  const taskQuery = trpc.tasks.get.useQuery(
    { id: taskId! },
    {
      enabled: !!taskId && enabled,
      refetchInterval: (data: any) => {
        // Stop polling when task is completed or failed
        if (
          data?.status === "completed" ||
          data?.status === "failed" ||
          data?.status === "cancelled"
        ) {
          return false;
        }
        // Poll every 2 seconds for running or queued tasks
        return 2000;
      },
    }
  );

  const runHistoryQuery = trpc.tasks.getTaskRunHistory.useQuery(
    { taskId: taskId! },
    {
      enabled: !!taskId && enabled,
      refetchInterval: query => {
        const status = query.state.data?.taskRun?.status;
        return status &&
          ["succeeded", "failed", "cancelled", "timed_out"].includes(status)
          ? false
          : 1000;
      },
    }
  );

  // Poll execution logs
  const logsQuery = trpc.tasks.getExecutionLogs.useQuery(
    { taskId: taskId! },
    {
      enabled: !!taskId && enabled,
      refetchInterval: (data: any) => {
        // Stop polling when we have logs and task is completed
        if (data && Array.isArray(data) && data.length > 0) {
          const lastLog = data[data.length - 1];
          if (lastLog?.action === "completion" || lastLog?.action === "error") {
            return false;
          }
        }
        // Poll every 2 seconds
        return 2000;
      },
    }
  );

  return {
    task: taskQuery.data,
    logs: logsQuery.data || [],
    runHistory: runHistoryQuery.data,
    isLoading:
      taskQuery.isLoading || logsQuery.isLoading || runHistoryQuery.isLoading,
    isError: taskQuery.isError || logsQuery.isError || runHistoryQuery.isError,
    error: taskQuery.error || logsQuery.error || runHistoryQuery.error,
  };
}
