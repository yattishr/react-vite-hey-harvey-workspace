import {
  getAgentRunsByTaskRun,
  getAgentRunsByTaskTeam,
} from "./agentRunRepository";
import {
  getArtifactsByTaskRun,
  getArtifactsByTaskTeam,
} from "./artifactRepository";
import {
  getTaskTeamByTaskId,
  getOrderedTeamMembers,
} from "../teams/taskTeamRepository";
import { getRuntimeEvents } from "../agents-runtime/repositories/event-repository";
import { getLatestTaskRun } from "../agents-runtime/repositories/task-run-repository";

export async function getTaskRunHistory(input: {
  organizationId: number;
  taskId: number;
}) {
  const team = await getTaskTeamByTaskId(input.organizationId, input.taskId);
  const taskRun = await getLatestTaskRun(input.organizationId, input.taskId);
  if (!team) {
    return {
      team: null,
      taskRun,
      members: [],
      runs: [],
      artifacts: [],
      events: taskRun
        ? await getRuntimeEvents(input.organizationId, taskRun.id)
        : [],
    };
  }

  const [members, runs, artifacts, events] = await Promise.all([
    getOrderedTeamMembers(input.organizationId, team.id),
    taskRun
      ? getAgentRunsByTaskRun(input.organizationId, taskRun.id)
      : getAgentRunsByTaskTeam(input.organizationId, team.id),
    taskRun
      ? getArtifactsByTaskRun(input.organizationId, taskRun.id)
      : getArtifactsByTaskTeam(input.organizationId, team.id),
    taskRun
      ? getRuntimeEvents(input.organizationId, taskRun.id)
      : Promise.resolve([]),
  ]);

  return {
    team,
    taskRun,
    members,
    runs,
    artifacts,
    events,
  };
}
