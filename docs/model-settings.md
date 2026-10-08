# Model and reasoning settings

Both the standard LLM adapter and Agents SDK default to `gpt-6-luna`. The local `.env` sets `OPENAI_MODEL=gpt-6-luna` and `OPENAI_AGENTS_DEFAULT_MODEL=gpt-6-luna`; deployments should use the same values. Restart the server after changing environment variables.

The **Reasoning** switch appears above each workspace page:

- **Off** (initial default): sends effort `none` explicitly, rather than relying on the model's default.
- **On**: sends effort `medium`.

The preference is stored in this browser and applies to new requests from it. Existing requests and the background runs they spawn retain their original choice. Separate requests use isolated async contexts, so another user or browser cannot change the effort of an active run. Calls made outside an HTTP request default to off. The switch is disabled if either runtime is configured with a model outside GPT-6 Luna.

Standard application calls use Chat Completions with `reasoning_effort`; the Agents SDK uses Responses with `modelSettings.reasoning.effort`. GPT-6 Luna's Chat Completions function calling supports effort `none` only. A reasoning-on request with tools is rejected locally with instructions to use the SDK/Responses path; current standard application callers do not pass tools. No prompts, output contracts, or tools were changed.

Agent-run input metadata records the selected effort. SDK `step_started` / `step_retrying` events also include `model` and `reasoningEffort`, visible when expanding entries in Logs Explorer. Historical runs retain their original metadata. No schema migration is needed.

For an A/B check, run the same task once with the switch off and once with it on. Compare output quality and duration; enablement means the requested effort, not a guarantee of a particular number of reasoning tokens. The switch does not expose internal reasoning text.

Verified with unit tests for both transports and concurrent/background request isolation, plus small live structured-output requests for both off and on through Chat Completions and the Agents SDK.

Reference: [GPT-6 Luna model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna).
