# Reasoning on/off platform test — 8 October 2026

Signed in to the existing account and used the authenticated platform HTTP API for the same Create My Team and Approve Team & Start Work operations. Browser automation failed to initialize, so browser interactions were not verified. No replacement account was created.

Both tests used GPT-6 Luna and the same onboarding-process brief. Each generated plan included an Operations Analyst and a Quality Reviewer. Two new tasks and associated workflows were created and approved; both finished successfully.

| Setting sent | Task | Task / run status | Planning | Approval to response | Output words |
| --- | --- | --- | --- | --- | --- |
| Off (none) | [Task 19](http://localhost:3000/tasks/19) | completed / succeeded | 7.7 s | 19.8 s | 307 |
| On (medium) | [Task 20](http://localhost:3000/tasks/20) | completed / succeeded | 11.8 s | 43.7 s | 268 |

Times are client-observed request durations, including application and database overhead. They are not pure model latency. Output length uses whitespace-separated words.

## Result verification

Expected current workload: 3,300 minutes = 55 hours/month. Expected proposed workload: 2,075 minutes = 34.5833 hours/month. Savings: 1,225 minutes = 20.4167 hours/month, or 37.1212%. Both reports returned these values with appropriate rounding. Both included a two-week rollout, three measurable success metrics, two risks with mitigations, and stayed under 600 words.

The reasoning-on report explicitly distinguished labor time from elapsed calendar time, normalized the monthly metric to 100 customers, and made expansion conditional on pilot results. The reasoning-off report was correct and usable. This single pair does not establish a general quality or speed advantage; the generated plans differ and inference is nondeterministic.

## Traceability and limitations

- Off: task 19, workflow 6, task run 5.
- On: task 20, workflow 7, task run 6.
- The active executor was legacy. Both runs have persisted run_started and run_succeeded events.
- Requests explicitly carried x-reasoning-effort=none or medium. Server model configuration was verified as gpt-6-luna before creation. The active legacy path does not persist per-agent reasoning metadata, so exact model effort cannot be independently confirmed from these historical run records alone.
- Token usage and cost were not available in the returned task records.
- No email, external browsing, or external business action was requested of either team.

## Test brief

Review this fictional customer onboarding process using exactly two specialist roles: Operations Analyst and Quality Reviewer. Facts: 100 customers per month; form review takes 10 minutes per customer; account setup takes 15 minutes per customer; welcome email takes 5 minutes per customer; 20% of forms need one extra 15-minute correction. Tasks are sequential. Proposed changes reduce setup to 5 minutes and the correction rate to 5%, with no other changes. Produce a concise report calculating current and proposed total monthly staff hours, hours saved, and percentage reduction. Show assumptions and arithmetic. Recommend a two-week rollout, three measurable success metrics, and two risks with mitigations. Use only supplied facts and label estimates. Do not browse or send messages. Keep the final report under 600 words.

## Reasoning off output

## Customer Onboarding Process Review

### Summary
Calculated monthly onboarding workload before and after the proposed changes. Under the assumptions below, the changes save an estimated **20.42 staff hours per month**, a **37.1% reduction**.

### Workload calculations
**Assumptions:** 100 customers per month; each correction takes one additional 15 minutes; fractional corrections are treated as expected workload; tasks are sequential; only setup time and correction rate change.

- **Current:** Form review 10 + setup 15 + welcome email 5 = 30 minutes per customer.  
  Expected correction time: 20% × 15 = 3 minutes per customer.  
  **100 × (30 + 3) = 3,300 minutes = 55 hours per month.**

- **Proposed:** Form review 10 + setup 5 + welcome email 5 = 20 minutes per customer.  
  Expected correction time: 5% × 15 = 0.75 minutes per customer.  
  **100 × (20 + 0.75) = 2,075 minutes = 34.58 hours per month** (about 34 hours 35 minutes).

- **Estimated savings:** 55 − 34.58 = **20.42 hours per month**.  
  **Percentage reduction:** 20.42 ÷ 55 × 100 = **about 37.1%**.

### Recommended two-week rollout
- **Week 1:** Introduce the proposed setup process and correction approach; track time and corrections using the same definitions as the baseline.
- **Week 2:** Continue tracking, review results against the baseline, and decide whether to continue or adjust the process.

### Success metrics
1. **Total staff hours per month**, compared with the current 55-hour estimate.
2. **Average setup time per customer**, compared with the proposed 5 minutes.
3. **Percentage of forms requiring correction**, compared with the proposed 5%.

### Risks and mitigations
- **Correction rate does not reach 5%:** Track the correction rate during rollout and review corrected forms to identify recurring issues.
- **Setup takes longer than 5 minutes in practice:** Track setup time per customer and review the process if the measured average exceeds the target.

## Reasoning on output

## Onboarding Process Review

**Summary:** The Operations Analyst estimated current and proposed monthly staff workload. The Quality Reviewer checked the arithmetic, assumptions, and rollout measures. All workload figures below are estimates, not measured results.

### Key findings

**Assumptions:** All 100 customers complete the process; stated times apply per customer; 20% currently and 5% under the proposal need one additional 15-minute correction. Tasks are sequential, so times are added to estimate staff labor—not elapsed calendar time.

- **Current:** 10 + 15 + 5 + (20% × 15) = **33 minutes/customer**.  
  100 × 33 = **3,300 minutes = 55 hours/month**.
- **Proposed:** 10 + 5 + 5 + (5% × 15) = **20.75 minutes/customer**.  
  100 × 20.75 = **2,075 minutes = 34.58 hours/month**.
- **Estimated savings:** 3,300 − 2,075 = **1,225 minutes = 20.42 hours/month**.
- **Estimated reduction:** 1,225 ÷ 3,300 × 100 = **37.1%**.

Correction counts are expected-value averages and may be fractional.

### Recommendation and next steps

Run a **two-week rollout**. In week one, conduct a small pilot and track the measures below; pilot size is unspecified. Review the results, then expand in week two only if the measures support the changes. No pilot results are yet available.

**Three success metrics**
1. Monthly staff hours normalized to 100 customers: **55 current estimate; 34.58 proposed estimate**.
2. Account setup time per customer: **15 minutes current; 5-minute proposed target**.
3. Correction rate: **20% current; 5% proposed target**.

**Two risks and mitigations**
1. Faster setup could affect accuracy; monitor the correction rate during the pilot.
2. Setup may not reach five minutes; track setup time and expand only after reviewing results.
