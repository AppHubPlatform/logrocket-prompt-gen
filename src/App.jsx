/**
 * LogRocket AI Prompt Generator
 * ─────────────────────────────────────────────────────────────────────────────
 * A 3-step internal revenue tool that helps reps generate tailored LogRocket
 * Galileo AI prompts based on customer tool stack, contact persona, and use case.
 *
 * HOW TO USE IN CLAUDE CODE
 * ──────────────────────────
 * 1. `npx create-react-app logrocket-prompt-gen` (or use Vite)
 * 2. Replace src/App.jsx with this file
 * 3. Add your Anthropic API key to a .env file:
 *      REACT_APP_ANTHROPIC_API_KEY=sk-ant-...
 *    or for Vite:
 *      VITE_ANTHROPIC_API_KEY=sk-ant-...
 * 4. Install Tailwind (optional — this file uses inline styles + CSS vars)
 * 5. npm start
 *
 * NOTE: For production, proxy the Anthropic API call through your own backend
 * so the API key is never exposed client-side.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from "react";

// ─── Data ────────────────────────────────────────────────────────────────────

const TOOLS = [
  { name: "LogRocket",        icon: "🚀" },
  { name: "LaunchDarkly",     icon: "🚩" },
  { name: "Optimizely",       icon: "🧪" },
  { name: "Adobe Analytics",  icon: "📊" },
  { name: "Google Analytics", icon: "📈" },
  { name: "Segment",          icon: "🔀" },
  { name: "Amplitude",        icon: "📉" },
  { name: "Mixpanel",         icon: "🎯" },
  { name: "Salesforce",       icon: "☁️" },
  { name: "HubSpot",          icon: "📧" },
  { name: "Intercom",         icon: "💬" },
  { name: "Figma",            icon: "🎨" },
  { name: "Jira",             icon: "🗂️" },
  { name: "Notion",           icon: "📓" },
  { name: "Heap",             icon: "📋" },
  { name: "FullStory",        icon: "👁️" },
  { name: "VWO",              icon: "⚗️" },
  { name: "Hotjar",           icon: "🔥" },
  { name: "Snowflake",        icon: "❄️" },
];

const INDUSTRIES = [
  "E-commerce", "Fintech", "Healthcare", "SaaS / B2B software",
  "Media & entertainment", "Travel & hospitality", "Education", "Retail", "Other",
];

const USE_CASES = [
  {
    label: "Conversion Funnel Analysis",
    icon: "🔽",
    persona: "Product",
    desc: "Pinpoint where users drop off and why across key flows",
    agent: "Analytics AI",
    agentColor: "#1a6fa8",
    agentBg: "#E8F4FD",
    tip: "Include specific URLs or click/custom-event names for each funnel step (e.g., /pricing, click 'Start Trial', /checkout/success).",
    lrChatPrompt: "Build a funnel from users who visit my pricing page to users who complete checkout. Show me where the biggest drop-off is, why users are abandoning, and create a funnel to track the conversion rate over time.",
    lrAutoPrompt: "Analyze my signup funnel: landing page → signup form submitted → email verified. Identify the step with the highest drop-off, show me sessions where users abandoned, and suggest fixes.",
    lrDiscoverPrompt: "Find sessions where users reached the checkout page but didn't complete purchase in the last 7 days. What was the last action they took before leaving, and is there a pattern by device, browser, or traffic source?",
    outcome: "Prioritized list of friction points and suggested fixes",
  },
  {
    label: "Feature Usage Analysis",
    icon: "📊",
    persona: "Product",
    desc: "Understand why features are overlooked and boost adoption",
    agent: "Analytics AI",
    agentColor: "#1a6fa8",
    agentBg: "#E8F4FD",
    tip: "Include the Click text, CSS selector, Custom Event name, or URL associated with the feature you want to measure.",
    lrChatPrompt: "How many users are using the {Feature name} (click text '{CTA}')? Show me sessions of first-time users discovering it, identify any friction in the flow, and create a metric tracking weekly adoption.",
    lrAutoPrompt: "Track adoption of my new {Feature name} (URL: xyz.com). What percentage of sessions trigger it, do users encounter issues when enabling it, and what can I do to increase adoption?",
    lrDiscoverPrompt: "Show me users who have logged in more than 5 times but never triggered {feature event}. What are they doing instead, and is there a clear moment in their sessions where they could have discovered it?",
    outcome: "List of underused features and strategic adjustments to increase engagement",
  },
  {
    label: "Roadmap Prioritization with Usage Data",
    icon: "🗺️",
    persona: "Product",
    desc: "Use behavioral signals to rank features by real impact",
    agent: "Analytics AI",
    agentColor: "#1a6fa8",
    agentBg: "#E8F4FD",
    tip: "Reference custom events or URL patterns tied to the features you want to compare.",
    lrChatPrompt: "Show me feature usage across my top user segments over the last 30 days. Which features have low adoption despite high visibility, and what behavioral signals suggest they should be prioritized on the roadmap?",
    lrAutoPrompt: "Weekly: analyze feature engagement trends across Free, Pro, and Enterprise segments. Flag any features where adoption dropped more than 15% week-over-week and surface session examples showing why.",
    lrDiscoverPrompt: "Which features are used exclusively by power users but rarely by the broader base? Show me representative sessions of both groups and highlight the moments where the broader base could have discovered those features.",
    outcome: "Ranked feature list with adoption data and session evidence",
  },
  {
    label: "User Friction & Issue Detection",
    icon: "⚠️",
    persona: "Engineering",
    desc: "Rapidly identify recurring pain points without manual session review",
    agent: "Issues AI",
    agentColor: "#b85c1a",
    agentBg: "#FEF3EC",
    tip: "Galileo AI finds and ranks issues automatically in the LogRocket issues table — no manual triage needed.",
    lrChatPrompt: "Show me all high-impact issues detected in the last 7 days, ranked by number of affected sessions. For each, summarize what's breaking, which users are impacted, and the recommended fix.",
    lrAutoPrompt: "Daily: scan all new issues in my project. For any Severe-rated issue affecting more than 500 sessions, auto-generate a root cause summary, list of affected user IDs, and a recommended resolution path. Push to Jira.",
    lrDiscoverPrompt: "Find sessions in the last 48 hours where users encountered an error but did not trigger our error tracking custom event. What silent failures are slipping through, and which user flows are most affected?",
    outcome: "List of top issues with context, frequency, and recommended resolutions",
  },
  {
    label: "Issues Triage & Root Cause Analysis",
    icon: "🔍",
    persona: "Engineering",
    desc: "Move from detection to resolution faster with AI-generated root causes",
    agent: "Issues AI",
    agentColor: "#b85c1a",
    agentBg: "#FEF3EC",
    tip: "Provide the LogRocket issue URL for the deepest analysis including stack trace, first/last seen, and related issues.",
    lrChatPrompt: "Given this LogRocket issue URL: {LogRocket URL}, pull the full issue details including stack trace, first seen, last seen, top URL paths, affected browsers, and impacted user counts. Identify 1–2 representative session replays and summarize key moments leading up to the failure.",
    lrAutoPrompt: "On every new Severe issue: pull the full issue details, generate a root cause analysis, link the top 2 session replays, identify related issues from the last 7 days, and create a pre-filled Jira ticket with reproduction steps and suggested fix.",
    lrDiscoverPrompt: "Show me all issues that have been open for more than 14 days with no linked Jira ticket. For each, surface the most recent session replay and summarize what the user was doing so the team can prioritize triage.",
    outcome: "Prioritized issue with root cause, affected users, and a fix ready to hand off to engineering",
  },
  {
    label: "Performance Monitoring & Alerting",
    icon: "📡",
    persona: "Engineering",
    desc: "Track load times, errors, and regressions across releases",
    agent: "Issues AI",
    agentColor: "#b85c1a",
    agentBg: "#FEF3EC",
    tip: "Reference specific URL paths, API endpoints, or custom events tied to performance-critical flows.",
    lrChatPrompt: "Show me p75 and p95 load times for my checkout flow over the last 14 days, broken down by browser and device type. Flag any regressions introduced after our last deploy and show me sessions where users rage-clicked during slow loads.",
    lrAutoPrompt: "After every deploy: compare error rate and p95 page load time for the 2 hours pre- and post-deploy. If either metric increases more than 20%, generate an alert summary with the top 3 most affected user flows and link to representative sessions.",
    lrDiscoverPrompt: "Find sessions on mobile devices in the last 7 days where page load exceeded 4 seconds. What did users do while waiting — did they abandon, retry, or rage click — and which pages have the worst mobile performance?",
    outcome: "Regression report with session evidence and affected user counts",
  },
  {
    label: "Page Layout & Behavioral Insights",
    icon: "🖼️",
    persona: "UX / Design",
    desc: "Reveal how users actually experience your interface via heatmaps and journeys",
    agent: "Session Watching AI",
    agentColor: "#5b3d9e",
    agentBg: "#F0EDF9",
    tip: "Include an exact URL or define the page type (e.g., 'our pricing page', 'PDP for t-shirt products') to tailor the analysis.",
    lrChatPrompt: "Analyze user behavior, attention patterns, navigation paths, and engagement signals on {URL} to explain how users interact with this experience, what captures attention, and what drives progress toward key goals.",
    lrAutoPrompt: "Weekly: identify overlooked elements, confusing interactions, competing content, and friction patterns on {URL or page type} that may be preventing users from completing key actions. Summarize the top 3 layout changes with the highest impact on conversion.",
    lrDiscoverPrompt: "Show me the elements on {URL} that users hover over but never click. Are there CTAs or navigation items that look interactive but aren't driving action, and how do these dead zones differ between new and returning visitors?",
    outcome: "Heatmap insights report with suggested content and layout tweaks",
  },
  {
    label: "A/B Testing Insights & Analysis",
    icon: "⚗️",
    persona: "UX / Design",
    desc: "Synthesize test outcomes and understand behavioral drivers behind results",
    agent: "Session Watching AI",
    agentColor: "#5b3d9e",
    agentBg: "#F0EDF9",
    tip: "Include custom event names or URL patterns that distinguish each variant for the most accurate comparison.",
    lrChatPrompt: "Compare sessions where users saw the new checkout layout {Custom Event + Property} versus {Control Event + Property}. Which version has more errors, rage clicks, or drop-offs? Create a metric tracking conversion rate for each variant.",
    lrAutoPrompt: "I'm running an A/B test on my onboarding flow. Compare sessions that include the custom event onboarding_variant_A vs onboarding_variant_B. Show me which variant has higher completion, fewer issues, and why. Send a weekly summary to Slack.",
    lrDiscoverPrompt: "Find sessions from users who were exposed to both variants in the same visit. What did their behavior look like, could this be causing test contamination, and how many sessions should we exclude from the final analysis?",
    outcome: "Clear test winner, reasons behind the win, and recommended next steps",
  },
  {
    label: "Customer Journey Mapping",
    icon: "🗺️",
    persona: "UX / Design",
    desc: "Visualize end-to-end paths to uncover where users succeed or churn",
    agent: "Session Watching AI",
    agentColor: "#5b3d9e",
    agentBg: "#F0EDF9",
    tip: "Provide a start/end point (URLs or events, e.g., /signup → /onboarding/step-3 → /dashboard) plus any important intermediate steps.",
    lrChatPrompt: "Map the typical journey of users who go from {Start URL} to {End URL}. What paths do they take, where do they get stuck, and what issues do they hit along the way? Create a funnel metric for the most common path.",
    lrAutoPrompt: "Weekly: show me the journey of users who signed up this week but never completed {URL or flow}. Where did they drop off, what errors or friction did they encounter, and what should we prioritize fixing? Track onboarding completion as a metric.",
    lrDiscoverPrompt: "Show me unexpected paths users take to reach {goal URL or event} — routes we didn't design as primary flows. Which of these accidental journeys have the highest success rate, and should any of them become official navigation paths?",
    outcome: "Journey map with key moments of success or churn and tailored fix strategies",
  },
  {
    label: "Onboarding & Empty-State Optimization",
    icon: "🚀",
    persona: "UX / Design",
    desc: "Improve first-run experiences and reduce time-to-value",
    agent: "Session Watching AI",
    agentColor: "#5b3d9e",
    agentBg: "#F0EDF9",
    tip: "Reference the onboarding URL path or custom events that mark key activation milestones.",
    lrChatPrompt: "Show me sessions from users in their first 24 hours who never reached {activation milestone}. What's the most common drop-off point, what UI elements are they missing or ignoring, and what empty states or tooltips could reduce confusion?",
    lrAutoPrompt: "Daily: identify new users who signed up but didn't complete step 2 of onboarding within 24 hours. Summarize the most common abandonment patterns from their sessions and suggest 2–3 UX changes to improve activation rate.",
    lrDiscoverPrompt: "Find first-session users who spent more than 3 minutes on a single onboarding step without progressing. What were they doing during that time — reading, scrolling, retrying — and is there a specific field or action causing the delay?",
    outcome: "Activation gap analysis with session evidence and UX recommendations",
  },
  {
    label: "Campaign Landing Page Optimization",
    icon: "📣",
    persona: "Marketing",
    desc: "Understand why paid traffic isn't converting and where to fix it",
    agent: "Session Watching AI",
    agentColor: "#b5460f",
    agentBg: "#FEF0E7",
    tip: "Include the exact landing page URL and the UTM parameters or campaign names you want to compare across.",
    lrChatPrompt: "Show me sessions from users who arrived via {campaign / UTM source} and landed on {URL}. What did they do, where did they drop off, and what rage clicks or confusion signals suggest the page isn't matching their expectations?",
    lrAutoPrompt: "Weekly: compare session behavior across my top 3 paid campaigns on {landing page URL}. Flag the campaign with the highest bounce rate, surface the most common drop-off point, and suggest 2–3 copy or layout changes to improve conversion.",
    lrDiscoverPrompt: "Find sessions from paid traffic sources on {landing page URL} where users spent less than 10 seconds before leaving. What elements did they interact with, what did they ignore, and is there a pattern by device or traffic source?",
    outcome: "Campaign-specific friction report with page changes ranked by conversion impact",
  },
  {
    label: "Product-Led Growth & Trial Conversion",
    icon: "📈",
    persona: "Marketing",
    desc: "Identify which trial behaviors predict conversion and remove blockers",
    agent: "Analytics AI",
    agentColor: "#b5460f",
    agentBg: "#FEF0E7",
    tip: "Map out the key activation events in your trial (e.g., 'first project created', 'invited a teammate') as custom events in LogRocket for the sharpest signal.",
    lrChatPrompt: "Compare sessions of trial users who converted to paid vs. those who churned in the last 30 days. What actions did converters take that churners didn't, and at what point in the trial did the paths diverge?",
    lrAutoPrompt: "Weekly: identify trial users who are 5+ days in but haven't hit {activation milestone}. Summarize the most common last session before they go dark and send a prioritized list to the growth team in Slack with suggested in-app nudges.",
    lrDiscoverPrompt: "Show me the top 5 features trial users interact with in their first session. Which of those features correlates most strongly with users who go on to complete onboarding and convert?",
    outcome: "Activation playbook mapping key trial behaviors to conversion likelihood",
  },
  {
    label: "Voice of Customer for Messaging & Positioning",
    icon: "🗣️",
    persona: "Marketing",
    desc: "Use real session signals to validate and sharpen your messaging",
    agent: "Session Watching AI",
    agentColor: "#b5460f",
    agentBg: "#FEF0E7",
    tip: "Reference your pricing, homepage, or key feature pages to see what language and value props users respond to.",
    lrChatPrompt: "Show me sessions on {pricing or homepage URL} from users who went on to sign up vs. those who bounced. What sections did converters engage with most, and what did bouncers skip or ignore?",
    lrAutoPrompt: "Monthly: analyze which value proposition sections on {URL} have the highest scroll depth and click-through among users from {target segment or traffic source}. Summarize findings and suggest A/B test ideas for the next sprint.",
    lrDiscoverPrompt: "Find sessions where users copied text or highlighted content on {URL}. What phrases or sections are they capturing, and how does this compare to the messaging we're currently leading with?",
    outcome: "Messaging audit with session-backed evidence for copy and positioning changes",
  },
  {
    label: "SEO & Content Performance Analysis",
    icon: "🔍",
    persona: "Marketing",
    desc: "See how organic visitors engage with content and where they fall off",
    agent: "Analytics AI",
    agentColor: "#b5460f",
    agentBg: "#FEF0E7",
    tip: "Filter by organic traffic source or landing page URL to isolate SEO-driven sessions from other channels.",
    lrChatPrompt: "Show me sessions from organic search traffic landing on {blog or content URL}. How far do users scroll, do they click through to product pages, and where do they exit? Identify the content sections that drive the most downstream engagement.",
    lrAutoPrompt: "Weekly: track scroll depth and CTA click rate for my top 10 organic landing pages. Flag any page where CTA engagement dropped more than 20% week-over-week and surface 3 representative sessions showing why.",
    lrDiscoverPrompt: "Find organic sessions where users visited more than 3 pages in a single visit. What content paths did they take, and what page or CTA finally prompted them to sign up or contact sales?",
    outcome: "Content engagement report with CTA optimization recommendations by page",
  },
  {
    label: "Executive KPI Dashboard & Health Monitoring",
    icon: "📊",
    persona: "Executive",
    desc: "Surface the metrics that matter most to the business in one view",
    agent: "Analytics AI",
    agentColor: "#374151",
    agentBg: "#F3F4F6",
    tip: "Define your north star metric and the 2–3 leading indicators that predict it so Galileo AI can track the full signal chain.",
    lrChatPrompt: "Give me a snapshot of product health for the last 30 days: active users, key funnel conversion rates, top issues by session impact, and any significant week-over-week changes I should know about before our board meeting.",
    lrAutoPrompt: "Weekly: generate an executive summary covering MAU trend, checkout conversion rate, top 3 issues by affected users, and any regressions from the latest release. Send to the leadership Slack channel every Monday at 8am.",
    lrDiscoverPrompt: "Show me the sessions from our highest-value accounts in the last 7 days. Are they using the features they're paying for, and are there any errors or friction patterns that could put renewals at risk?",
    outcome: "Board-ready health summary with trend lines and risk flags",
  },
  {
    label: "Churn Risk & Retention Intelligence",
    icon: "⚠️",
    persona: "Executive",
    desc: "Identify accounts showing early signs of churn before it hits revenue",
    agent: "Issues AI",
    agentColor: "#374151",
    agentBg: "#F3F4F6",
    tip: "Tag your key accounts or segments as custom user properties in LogRocket so Galileo AI can filter specifically to your highest-value cohorts.",
    lrChatPrompt: "Show me sessions from accounts up for renewal in the next 60 days. Which ones have declining engagement, recurring errors, or low feature adoption? Rank them by churn risk and give me the top talking points for each account.",
    lrAutoPrompt: "Weekly: for all accounts with >$50K ARR, compare this month's active session count and feature usage to last month. Flag any account with more than 25% decline and push an alert to the CSM in Salesforce with a session-backed risk summary.",
    lrDiscoverPrompt: "Find accounts that were highly active 60 days ago but have had fewer than 5 sessions in the last 14 days. What was the last thing they did in the product, and were there any errors or friction events in those final sessions?",
    outcome: "Churn risk register ranked by ARR exposure with session-backed context for each account",
  },
  {
    label: "Release Impact & Regression Reporting",
    icon: "🚀",
    persona: "Executive",
    desc: "Quantify the business impact of every release — good and bad",
    agent: "Issues AI",
    agentColor: "#374151",
    agentBg: "#F3F4F6",
    tip: "Use LogRocket's release tagging or version custom property to compare sessions cleanly across deployment boundaries.",
    lrChatPrompt: "Compare key metrics before and after our last release: error rate, session length, checkout conversion, and rage click frequency. Did the release improve or degrade the user experience, and which user segments were most affected?",
    lrAutoPrompt: "After every production deploy: generate a release impact report comparing error rates, p95 load times, and conversion for the 24 hours pre- and post-deploy. If any metric degrades more than 10%, send an executive alert to the CTO and VP Engineering in Slack.",
    lrDiscoverPrompt: "Show me the top 5 issues introduced in the last release that weren't present in the previous version. How many sessions and users were impacted, and what is the estimated revenue exposure based on affected flows?",
    outcome: "Release scorecard with before/after metrics and business impact estimate",
  },
  {
    label: "Competitive Win/Loss Signal Analysis",
    icon: "🏆",
    persona: "Executive",
    desc: "Use behavioral data to understand why customers choose you — or don't",
    agent: "Session Watching AI",
    agentColor: "#374151",
    agentBg: "#F3F4F6",
    tip: "Tag sessions by deal stage, competitor mentioned, or win/loss outcome using custom user properties synced from your CRM.",
    lrChatPrompt: "Show me sessions from prospects who signed up after a competitive evaluation vs. those who churned within 30 days. What features did each group explore, what friction did they hit, and what patterns distinguish the wins from the losses?",
    lrAutoPrompt: "Monthly: analyze sessions from accounts tagged 'competitive deal' in Salesforce. Which product areas do they explore most, where do they drop off, and how does their session depth compare to accounts that closed without a competitor? Send a summary to the VP of Sales.",
    lrDiscoverPrompt: "Find sessions where users visited our pricing or comparison pages and then either signed up or left without converting. What did each group look at, how long did they spend, and is there a feature or pricing tier that correlates with the decision?",
    outcome: "Win/loss behavioral report with feature-level signals to inform product and sales strategy",
  },
  {
    label: "Ticket Deflection & Self-Serve Gaps",
    icon: "🎫",
    persona: "Support",
    desc: "Identify why users open tickets instead of finding answers themselves",
    agent: "Session Watching AI",
    agentColor: "#0f7b6c",
    agentBg: "#E6F6F4",
    tip: "Provide the URL path or custom event that precedes users reaching out to support (e.g., /help, click 'Contact us').",
    lrChatPrompt: "Show me sessions where users visited {help URL or support trigger} in the last 14 days. What pages did they visit before reaching out, what were they trying to do, and what in-app changes could have answered their question without a ticket?",
    lrAutoPrompt: "Weekly: identify the top 5 pages users visit immediately before submitting a support ticket. For each, summarize the most common confusion patterns from session replays and suggest self-serve improvements (tooltips, docs links, empty-state copy) to deflect those tickets.",
    lrDiscoverPrompt: "Find sessions where users searched the in-app help or docs but then still opened a ticket within 24 hours. What search terms did they use, what results did they get, and where did the self-serve experience break down?",
    outcome: "Ranked list of self-serve gaps with session evidence and deflection recommendations",
  },
  {
    label: "Reproduction & Root Cause for Support Tickets",
    icon: "🔎",
    persona: "Support",
    desc: "Reproduce customer-reported bugs instantly using session data",
    agent: "Issues AI",
    agentColor: "#0f7b6c",
    agentBg: "#E6F6F4",
    tip: "Provide the customer's user ID, email, or the LogRocket session URL from your support ticket for the most targeted replay.",
    lrChatPrompt: "Find the most recent session for user {user ID or email}. Walk me through exactly what they did, any errors or rage clicks they encountered, and identify whether this is a known issue or something new.",
    lrAutoPrompt: "On every new support ticket tagged 'bug': look up the session for the reported user, pull any errors or console warnings from that session, match against open issues, and pre-fill a Jira ticket with reproduction steps, affected browser/device, and a link to the session replay.",
    lrDiscoverPrompt: "Show me support tickets opened in the last 30 days where the same error appeared in the user's session but wasn't listed in our known issues. Which of these represent net-new bugs that engineering hasn't seen yet?",
    outcome: "Instant reproduction path with session evidence, ready to hand off to engineering",
  },
  {
    label: "Proactive At-Risk Customer Monitoring",
    icon: "🚨",
    persona: "Support",
    desc: "Catch frustrated or churning users before they submit a ticket or leave",
    agent: "Issues AI",
    agentColor: "#0f7b6c",
    agentBg: "#E6F6F4",
    tip: "Define your frustration signals — rage clicks, repeated failed actions, error pages — so Galileo AI can surface the right sessions.",
    lrChatPrompt: "Show me sessions in the last 7 days with more than 3 rage clicks or repeated failed form submissions. Which users are most frustrated, what are they trying to do, and has anyone on the support team already been in contact with them?",
    lrAutoPrompt: "Daily: flag any session where a user rage-clicked more than 5 times or hit an error page on a key flow ({URL}). For each, check if a support ticket already exists, generate a proactive outreach summary for the CSM, and log it in HubSpot.",
    lrDiscoverPrompt: "Find accounts that have had zero support contact in 90+ days but show signs of silent frustration — rage clicks, repeated failed actions, or error pages — in recent sessions. Which ones are at risk without us knowing it?",
    outcome: "Proactive alert list of at-risk users with context for immediate outreach",
  },
  {
    label: "Support Escalation Prep",
    icon: "📋",
    persona: "Support",
    desc: "Arm your team with full session context before every escalation call",
    agent: "Session Watching AI",
    agentColor: "#0f7b6c",
    agentBg: "#E6F6F4",
    tip: "Include the customer's user ID or account name and the date range of the issue to pull the most relevant sessions.",
    lrChatPrompt: "Pull the last 5 sessions for {user ID or company name} and give me a summary of what they've been trying to accomplish, any errors or friction they hit, and the key moments I should reference on our escalation call.",
    lrAutoPrompt: "30 minutes before any escalation call tagged in {CRM}: retrieve the last 10 sessions for the account, summarize recurring friction points and open issues, and send a briefing doc to the account owner in Slack with a link to the most relevant session replay.",
    lrDiscoverPrompt: "For accounts that have escalated more than twice in the last 90 days, show me the common session patterns across all escalations. Is there a recurring flow, feature, or error that keeps triggering them, and what's the fix that would stop the cycle?",
    outcome: "Pre-call briefing with session highlights, errors, and talking points",
  },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  app: {
    minHeight: "100vh",
    backgroundColor: "#F8F7FE",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#1a1523",
  },
  header: {
    backgroundColor: "#4C3DB4",
    padding: "14px 24px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  headerTitle: {
    color: "white",
    fontSize: "15px",
    fontWeight: "600",
    letterSpacing: "-0.01em",
  },
  headerSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "12px",
    marginLeft: "auto",
  },
  main: {
    maxWidth: "720px",
    margin: "0 auto",
    padding: "32px 24px 80px",
  },
  progress: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "28px",
  },
  progressStep: (active, done) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: active ? "600" : "400",
    color: done ? "#4C3DB4" : active ? "#4C3DB4" : "#9ca3af",
  }),
  progressDot: (active, done) => ({
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: done ? "#4C3DB4" : active ? "#4C3DB4" : "#e5e7eb",
    color: done || active ? "white" : "#9ca3af",
    fontSize: "11px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  progressLine: (done) => ({
    flex: 1,
    height: "1px",
    backgroundColor: done ? "#4C3DB4" : "#e5e7eb",
  }),
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    border: "1px solid #e9e5f8",
    padding: "24px",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#1a1523",
    marginBottom: "4px",
    letterSpacing: "-0.02em",
  },
  sectionSub: {
    fontSize: "13px",
    color: "#6b7280",
    marginBottom: "20px",
  },
  toolsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))",
    gap: "8px",
    marginBottom: "16px",
  },
  toolChip: (selected) => ({
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "9px 11px",
    borderRadius: "8px",
    border: selected ? "1.5px solid #4C3DB4" : "1px solid #e9e5f8",
    backgroundColor: selected ? "#EEEDFE" : "white",
    cursor: "pointer",
    fontSize: "13px",
    color: selected ? "#3C3489" : "#374151",
    fontWeight: selected ? "500" : "400",
    transition: "all 0.12s",
    userSelect: "none",
  }),
  input: {
    width: "100%",
    padding: "9px 12px",
    fontSize: "13px",
    borderRadius: "8px",
    border: "1px solid #e9e5f8",
    backgroundColor: "white",
    color: "#1a1523",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "9px 12px",
    fontSize: "13px",
    borderRadius: "8px",
    border: "1px solid #e9e5f8",
    backgroundColor: "white",
    color: "#1a1523",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "13px",
    borderRadius: "8px",
    border: "1px solid #e9e5f8",
    backgroundColor: "white",
    color: "#1a1523",
    fontFamily: "inherit",
    lineHeight: "1.6",
    resize: "vertical",
    minHeight: "80px",
    outline: "none",
    boxSizing: "border-box",
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginBottom: "12px",
  },
  fieldLabel: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: "5px",
    display: "block",
  },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    backgroundColor: "#EEEDFE",
    color: "#3C3489",
    borderRadius: "100px",
    fontSize: "12px",
    fontWeight: "500",
  },
  personaTab: (active) => ({
    padding: "6px 14px",
    borderRadius: "8px",
    border: active ? "1.5px solid #4C3DB4" : "1px solid #e9e5f8",
    backgroundColor: active ? "#EEEDFE" : "white",
    fontSize: "12px",
    fontWeight: "500",
    color: active ? "#3C3489" : "#6b7280",
    cursor: "pointer",
    transition: "all 0.12s",
  }),
  useCase: (selected) => ({
    borderRadius: "10px",
    border: selected ? "1.5px solid #4C3DB4" : "1px solid #e9e5f8",
    backgroundColor: selected ? "#EEEDFE" : "white",
    cursor: "pointer",
    transition: "all 0.12s",
    marginBottom: "8px",
    overflow: "hidden",
  }),
  useCaseHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "12px 14px",
  },
  btnPrimary: (disabled) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: disabled ? "#c4bef0" : "#4C3DB4",
    color: "white",
    fontSize: "14px",
    fontWeight: "500",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    transition: "background 0.12s",
  }),
  btnGhost: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #e9e5f8",
    backgroundColor: "transparent",
    color: "#6b7280",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  outputBlock: {
    backgroundColor: "#F8F7FE",
    borderRadius: "10px",
    border: "1px solid #e9e5f8",
    padding: "16px",
    marginBottom: "12px",
  },
  outputLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#9ca3af",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    marginBottom: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  outputText: {
    fontSize: "13px",
    color: "#1a1523",
    lineHeight: "1.75",
    whiteSpace: "pre-wrap",
    margin: 0,
  },
  copyBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    padding: "3px 9px",
    borderRadius: "6px",
    border: "1px solid #e9e5f8",
    backgroundColor: "white",
    color: "#6b7280",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  tipBox: {
    backgroundColor: "#FFFBEA",
    border: "1px solid #fde68a",
    borderRadius: "8px",
    padding: "9px 11px",
    fontSize: "12px",
    color: "#78600a",
    lineHeight: "1.5",
  },
  agentBadge: (bg, color) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 9px",
    borderRadius: "100px",
    backgroundColor: bg,
    color: color,
    fontSize: "11px",
    fontWeight: "600",
    marginBottom: "8px",
  }),
  contactCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    backgroundColor: "#EEEDFE",
    borderRadius: "8px",
    marginBottom: "16px",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#4C3DB4",
    color: "white",
    fontSize: "12px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  divider: {
    height: "1px",
    backgroundColor: "#f0edf9",
    margin: "20px 0",
  },
  lrBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 13px",
    background: "linear-gradient(135deg, #4C3DB4, #7b5ea7)",
    borderRadius: "8px",
    marginBottom: "14px",
    fontSize: "12px",
    color: "white",
    fontWeight: "500",
  },
  loadingDots: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ step }) {
  const steps = ["Select tools", "Team & use case", "Your prompts"];
  return (
    <div style={S.progress}>
      {steps.map((label, i) => {
        const num = i + 1;
        const active = step === num;
        const done = step > num;
        return (
          <div key={num} style={{ display: "flex", alignItems: "center", gap: "6px", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={S.progressDot(active, done)}>{done ? "✓" : num}</div>
            <span style={{ fontSize: "12px", fontWeight: active ? "600" : "400", color: done || active ? "#4C3DB4" : "#9ca3af", whiteSpace: "nowrap" }}>{label}</span>
            {i < steps.length - 1 && <div style={S.progressLine(done)} />}
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button style={S.copyBtn} onClick={copy}>
      {copied ? "✓ Copied" : "⎘ Copy"}
    </button>
  );
}

// ─── Step 1: Tool Selection ───────────────────────────────────────────────────

function StepTools({ selectedTools, setSelectedTools, onNext }) {
  const [custom, setCustom] = useState("");

  const toggle = (name) => {
    setSelectedTools(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const addCustom = () => {
    const val = custom.trim();
    if (!val) return;
    setSelectedTools(prev => new Set([...prev, val]));
    setCustom("");
  };

  const removeTag = (name) => {
    setSelectedTools(prev => { const next = new Set(prev); next.delete(name); return next; });
  };

  return (
    <div style={S.card}>
      <div style={S.sectionTitle}>Which tools does the customer use?</div>
      <div style={S.sectionSub}>Select all that apply — or add your own below.</div>

      <div style={S.toolsGrid}>
        {TOOLS.map(t => (
          <div key={t.name} style={S.toolChip(selectedTools.has(t.name))} onClick={() => toggle(t.name)}>
            <span>{t.icon}</span>
            <span>{t.name}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <input
          style={{ ...S.input, flex: 1 }}
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addCustom()}
          placeholder="Add another tool..."
        />
        <button style={S.btnGhost} onClick={addCustom}>+ Add</button>
      </div>

      {selectedTools.size > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
          {[...selectedTools].map(t => (
            <span key={t} style={S.tag}>
              {t}
              <button onClick={() => removeTag(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "#4C3DB4", fontSize: "14px", lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button style={S.btnPrimary(selectedTools.size === 0)} onClick={onNext} disabled={selectedTools.size === 0}>
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Contact + Use Case ───────────────────────────────────────────────

function StepUseCase({ contact, setContact, selectedUseCase, setSelectedUseCase, context, setContext, onBack, onGenerate }) {
  const [activePersona, setActivePersona] = useState("All");
  const personas = ["All", "Product", "Engineering", "UX / Design", "Support", "Marketing", "Executive"];

  const filtered = activePersona === "All" ? USE_CASES : USE_CASES.filter(u => u.persona === activePersona);
  const initials = contact.name ? contact.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";
  const showCard = contact.name || contact.title || contact.company;

  return (
    <div>
      {/* Contact */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Who are you talking to?</div>
        <div style={S.sectionSub}>Add their details so the prompts speak directly to them.</div>

        <div style={S.fieldGrid}>
          <div>
            <label style={S.fieldLabel}>Contact name</label>
            <input style={S.input} value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Sarah Chen" />
          </div>
          <div>
            <label style={S.fieldLabel}>Job title</label>
            <input style={S.input} value={contact.title} onChange={e => setContact(c => ({ ...c, title: e.target.value }))} placeholder="e.g. Senior Product Manager" />
          </div>
        </div>
        <div style={S.fieldGrid}>
          <div>
            <label style={S.fieldLabel}>Company</label>
            <input style={S.input} value={contact.company} onChange={e => setContact(c => ({ ...c, company: e.target.value }))} placeholder="e.g. Acme Corp" />
          </div>
          <div>
            <label style={S.fieldLabel}>Industry</label>
            <select style={S.select} value={contact.industry} onChange={e => setContact(c => ({ ...c, industry: e.target.value }))}>
              <option value="">Select industry...</option>
              {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
        </div>

        {showCard && (
          <div style={S.contactCard}>
            <div style={S.avatar}>{initials}</div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#3C3489" }}>{contact.name || "—"}</div>
              <div style={{ fontSize: "12px", color: "#534AB7" }}>{[contact.title, contact.company].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        )}
      </div>

      {/* Use case */}
      <div style={S.card}>
        <div style={S.sectionTitle}>What's their primary focus?</div>
        <div style={S.sectionSub}>Filter by team, then pick the closest use case.</div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {personas.map(p => (
            <button key={p} style={S.personaTab(activePersona === p)} onClick={() => setActivePersona(p)}>{p}</button>
          ))}
        </div>

        <div>
          {filtered.map(u => {
            const sel = selectedUseCase?.label === u.label;
            return (
              <div key={u.label} style={S.useCase(sel)} onClick={() => setSelectedUseCase(u)}>
                <div style={S.useCaseHeader}>
                  <span style={{ fontSize: "18px", marginTop: "1px" }}>{u.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: "500", color: sel ? "#3C3489" : "#1a1523" }}>
                      {u.label}
                      <span style={{ fontSize: "11px", fontWeight: "400", color: "#9ca3af", marginLeft: "6px" }}>{u.persona}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{u.desc}</div>
                  </div>
                </div>
                {sel && (
                  <div style={{ padding: "0 14px 12px 44px" }}>
                    <span style={S.agentBadge(u.agentBg, u.agentColor)}>✦ {u.agent}</span>
                    <div style={S.tipBox}><strong>💡 Best results tip:</strong> {u.tip}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "16px" }}>
          <label style={S.fieldLabel}>Additional context <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span></label>
          <textarea
            style={S.textarea}
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="e.g. Mobile-first app, React Native, high drop-off on step 3 of onboarding..."
          />
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", marginTop: "8px" }}>
          <button style={S.btnGhost} onClick={onBack}>← Back</button>
          <button style={S.btnPrimary(!selectedUseCase)} onClick={onGenerate} disabled={!selectedUseCase}>
            ✦ Generate prompts
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Output ───────────────────────────────────────────────────────────

function StepOutput({ result, contact, useCase, loading, onBack, onReset }) {
  if (loading) {
    return (
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", minHeight: "100px" }}>
          <div style={S.loadingDots}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: "8px", height: "8px", borderRadius: "50%",
                backgroundColor: "#4C3DB4",
                animation: `bounce 1s ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>
            Generating prompts{contact.name ? ` for ${contact.name}` : ""}...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={S.sectionTitle}>Your suggested prompts</div>
      <div style={{ ...S.sectionSub, marginBottom: "16px" }}>
        {contact.name
          ? `Tailored for ${contact.name}${contact.title ? `, ${contact.title}` : ""}${contact.company ? ` at ${contact.company}` : ""}.`
          : "Copy either prompt into LogRocket's Galileo AI or Claude to get started."}
      </div>

      {result.rationale && (
        <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.65", marginBottom: "14px" }}>
          {result.rationale}
        </p>
      )}

      {useCase && (
        <div style={S.lrBanner}>
          🚀 <strong>{useCase.label}</strong> &nbsp;·&nbsp; ✦ {useCase.agent}
        </div>
      )}

      <div style={S.outputBlock}>
        <div style={S.outputLabel}>
          <span>💬 Ask Galileo / Chat prompt</span>
          <CopyButton text={result.chat_prompt || ""} />
        </div>
        <p style={S.outputText}>{result.chat_prompt}</p>
      </div>

      <div style={S.outputBlock}>
        <div style={S.outputLabel}>
          <span>▶ Stream / MCP automation prompt</span>
          <CopyButton text={result.automation_prompt || ""} />
        </div>
        <p style={S.outputText}>{result.automation_prompt}</p>
      </div>

      <div style={{ ...S.outputBlock, borderColor: "#c7d2fe", backgroundColor: "#eef2ff" }}>
        <div style={S.outputLabel}>
          <span style={{ color: "#4338ca" }}>🔭 Discover Stream prompt</span>
          <CopyButton text={result.discover_prompt || ""} />
        </div>
        <p style={S.outputText}>{result.discover_prompt}</p>
      </div>

      {result.galileo_tip && (
        <div style={S.tipBox}>
          <strong>💡 Galileo tip:</strong> {result.galileo_tip}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        <button style={S.btnGhost} onClick={onBack}>← Adjust</button>
        <button style={S.btnGhost} onClick={onReset}>↺ Start over</button>
      </div>
    </div>
  );
}

// ─── API Call ─────────────────────────────────────────────────────────────────

async function generatePrompts({ selectedTools, useCase, contact, context }) {
  const tools = [...selectedTools].join(", ");
  const contactLine = [
    contact.name && `Contact: ${contact.name}`,
    contact.title && `Title: ${contact.title}`,
    contact.company && `Company: ${contact.company}`,
    contact.industry && `Industry: ${contact.industry}`,
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are an expert AI solutions advisor at LogRocket helping a revenue team craft highly personalized, specific prompts for customer conversations.

LogRocket's Galileo AI has three main AI agents:
- Analytics AI: understands conversion funnels, feature usage, adoption trends
- Issues AI: detects, triages, and explains bugs, errors, and user friction  
- Session Watching AI: reveals user behavior, heatmaps, journey maps, A/B test results

The customer's selected use case is: ${useCase.label}
Powered by: ${useCase.agent}
Team persona: ${useCase.persona}
${contactLine ? `\nContact:\n${contactLine}` : ""}
Customer tools: ${tools}
${context ? `Extra context: ${context}` : ""}

LogRocket prompt templates to adapt from:
- Chat template: "${useCase.lrChatPrompt}"
- Automation template: "${useCase.lrAutoPrompt}"
- Discover Stream template: "${useCase.lrDiscoverPrompt}"
- Desired outcome: ${useCase.outcome}

Generate THREE refined prompts:
1. "chat_prompt" — Ready-to-use for LogRocket's Ask Galileo or Claude. Adapt the template to be specific to the customer's tools, industry, persona, and context.
2. "automation_prompt" — Refined for LogRocket Streams or MCP agentic workflows. Include trigger conditions, output format, and destination (Slack, Jira, etc.) based on their tool stack.
3. "discover_prompt" — A suggested Discovery Stream prompt the customer can save in LogRocket to surface unexpected behavioral patterns proactively. Should be open-ended, exploratory, and adapted to the customer's specific context and tools.

Respond ONLY as valid JSON, no markdown:
{
  "chat_prompt": "...",
  "automation_prompt": "...",
  "discover_prompt": "...",
  "rationale": "1-2 sentences on the strategic angle",
  "galileo_tip": "One sentence on how to get the best results from Galileo AI for this use case"
}`;

  const res = await fetch("/api/anthropic/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1600,
      system: systemPrompt,
      messages: [{ role: "user", content: "Generate the prompts." }],
    }),
  });

  const data = await res.json();
  const raw = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep] = useState(1);
  const [selectedTools, setSelectedTools] = useState(new Set());
  const [contact, setContact] = useState({ name: "", title: "", company: "", industry: "" });
  const [selectedUseCase, setSelectedUseCase] = useState(null);
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({});

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setStep(3);
    try {
      const res = await generatePrompts({ selectedTools, useCase: selectedUseCase, contact, context });
      setResult(res);
    } catch (e) {
      setResult({ chat_prompt: "Error generating prompts. Check your API key and try again.", automation_prompt: "" });
    } finally {
      setLoading(false);
    }
  }, [selectedTools, selectedUseCase, contact, context]);

  const reset = () => {
    setStep(1);
    setSelectedTools(new Set());
    setContact({ name: "", title: "", company: "", industry: "" });
    setSelectedUseCase(null);
    setContext("");
    setResult({});
  };

  return (
    <div style={S.app}>
      {/* Inject bounce keyframes */}
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, select:focus, textarea:focus { outline: 2px solid #4C3DB4; outline-offset: 1px; }
        button:focus-visible { outline: 2px solid #4C3DB4; outline-offset: 2px; }
      `}</style>

      {/* Header */}
      <header style={S.header}>
        <span style={{ fontSize: "20px" }}>🚀</span>
        <span style={S.headerTitle}>LogRocket · AI Prompt Generator</span>
        <span style={S.headerSub}>Internal revenue tool</span>
      </header>

      {/* Main */}
      <main style={S.main}>
        <ProgressBar step={step} />

        {step === 1 && (
          <StepTools
            selectedTools={selectedTools}
            setSelectedTools={setSelectedTools}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepUseCase
            contact={contact}
            setContact={setContact}
            selectedUseCase={selectedUseCase}
            setSelectedUseCase={setSelectedUseCase}
            context={context}
            setContext={setContext}
            onBack={() => setStep(1)}
            onGenerate={handleGenerate}
          />
        )}

        {step === 3 && (
          <StepOutput
            result={result}
            contact={contact}
            useCase={selectedUseCase}
            loading={loading}
            onBack={() => setStep(2)}
            onReset={reset}
          />
        )}
      </main>
    </div>
  );
}
