import { invokeLLM } from "./_core/llm";

/**
 * Agent orchestration module
 * Handles task execution and LLM-powered multi-agent reasoning.
 */

export interface AgentConfig {
  id: number;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  tools: string[];
}

export interface TaskInput {
  description: string;
  agentIds: number[];
  agents: AgentConfig[];
}

export interface ExecutionStep {
  step: number;
  action: string;
  details: string;
  timestamp: Date;
}

export interface TaskExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
  steps: ExecutionStep[];
}

/**
 * Execute a task using LLM-powered agent reasoning
 * Simulates agent collaboration through direct LLM calls.
 */
export async function executeTaskWithAgents(
  input: TaskInput,
  onStepUpdate?: (step: ExecutionStep) => void
): Promise<TaskExecutionResult> {
  const steps: ExecutionStep[] = [];
  let stepCount = 0;

  try {
    // Step 1: Agent Planning
    stepCount++;
    const planningStep: ExecutionStep = {
      step: stepCount,
      action: "planning",
      details: `Agents ${input.agents.map(a => a.name).join(", ")} are planning approach to: "${input.description}"`,
      timestamp: new Date(),
    };
    steps.push(planningStep);
    onStepUpdate?.(planningStep);

    // Build agent context
    const agentContext = input.agents
      .map(
        (agent) =>
          `Agent: ${agent.name}\nRole: ${agent.role}\nGoal: ${agent.goal}\nBackstory: ${agent.backstory}`
      )
      .join("\n\n");

    // Step 2: LLM-powered reasoning
    stepCount++;
    const reasoningStep: ExecutionStep = {
      step: stepCount,
      action: "reasoning",
      details: "Agents are reasoning through the task with LLM",
      timestamp: new Date(),
    };
    steps.push(reasoningStep);
    onStepUpdate?.(reasoningStep);

    const reasoningPrompt = `You are a team of AI agents working together to complete a task.

${agentContext}

Task: ${input.description}

Analyze this task carefully. Consider each agent's role and expertise. Provide a detailed plan of action and the expected outcome. Be specific and actionable.`;

    const reasoningResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert AI agent coordinator. Help teams of specialized agents plan and execute complex tasks.",
        },
        {
          role: "user",
          content: reasoningPrompt,
        },
      ],
    });

    const reasoning = typeof reasoningResponse.choices[0]?.message?.content === 'string' 
      ? reasoningResponse.choices[0].message.content 
      : "";

    // Step 3: Execution
    stepCount++;
    const executionStep: ExecutionStep = {
      step: stepCount,
      action: "execution",
      details: "Agents are executing the planned approach",
      timestamp: new Date(),
    };
    steps.push(executionStep);
    onStepUpdate?.(executionStep);

    // Step 4: LLM-powered execution and result generation
    stepCount++;
    const resultStep: ExecutionStep = {
      step: stepCount,
      action: "result_generation",
      details: "Generating final result based on agent collaboration",
      timestamp: new Date(),
    };
    steps.push(resultStep);
    onStepUpdate?.(resultStep);

    const executionPrompt = `Based on the following analysis and plan:

${reasoning}

Now provide the final result of the task execution. Include:
1. Summary of what was accomplished
2. Key findings or outputs
3. Any recommendations or next steps

Task: ${input.description}`;

    const executionResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert at synthesizing agent outputs into clear, actionable results.",
        },
        {
          role: "user",
          content: executionPrompt,
        },
      ],
    });

    const result = typeof executionResponse.choices[0]?.message?.content === 'string' 
      ? executionResponse.choices[0].message.content 
      : "";

    // Step 5: Completion
    stepCount++;
    const completionStep: ExecutionStep = {
      step: stepCount,
      action: "completion",
      details: "Task execution completed successfully",
      timestamp: new Date(),
    };
    steps.push(completionStep);
    onStepUpdate?.(completionStep);

    return {
      success: true,
      result: result,
      steps: steps,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    stepCount++;
    const errorStep: ExecutionStep = {
      step: stepCount,
      action: "error",
      details: `Task execution failed: ${errorMessage}`,
      timestamp: new Date(),
    };
    steps.push(errorStep);
    onStepUpdate?.(errorStep);

    return {
      success: false,
      error: errorMessage,
      steps: steps,
    };
  }
}

/**
 * Simulate a multi-agent conversation for task refinement
 */
export async function agentConversation(
  agents: AgentConfig[],
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  const agentContext = agents
    .map(
      (agent) =>
        `Agent: ${agent.name}\nRole: ${agent.role}\nGoal: ${agent.goal}`
    )
    .join("\n\n");

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `You are a team of AI agents with the following profiles:\n\n${agentContext}\n\nRespond as this team, considering each agent's perspective and expertise.`,
    },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    {
      role: "user",
      content: userMessage,
    },
  ];

  const response = await invokeLLM({
    messages: messages,
  });

  return typeof response.choices[0]?.message?.content === 'string' 
    ? response.choices[0].message.content 
    : "";
}

/**
 * Initialize built-in tools for agents
 */
export async function initializeBuiltInTools() {
  const builtInTools = [
    {
      name: "web_search",
      description: "Search the web for information",
      category: "search",
    },
    {
      name: "data_lookup",
      description: "Look up data from structured sources",
      category: "data",
    },
    {
      name: "document_analysis",
      description: "Analyze and extract information from documents",
      category: "analysis",
    },
    {
      name: "code_execution",
      description: "Execute and test code snippets",
      category: "execution",
    },
  ];

  return builtInTools;
}
