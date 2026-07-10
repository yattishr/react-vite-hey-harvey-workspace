import { getAgentRunsByTaskTeam } from "./agentRunRepository";
import { getArtifactsByTaskTeam } from "./artifactRepository";
import { getTaskTeamByTaskId, getOrderedTeamMembers } from "../teams/taskTeamRepository";

export async function getTaskRunHistory(input: { organizationId: number; taskId: number }) {
  const team = await getTaskTeamByTaskId(input.organizationId, input.taskId);
  if (!team) {
    return {
      team: null,
      members: [],
      runs: [],
      artifacts: [],
    };
  }

  const [members, runs, artifacts] = await Promise.all([
    getOrderedTeamMembers(input.organizationId, team.id),
    getAgentRunsByTaskTeam(input.organizationId, team.id),
    getArtifactsByTaskTeam(input.organizationId, team.id),
  ]);

  return {
    team,
    members,
    runs,
    artifacts,
  };
}
