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

import { useState, useCallback, useEffect } from "react";
import LogRocket from 'logrocket';
import { jsPDF } from "jspdf";

// ─── Data ────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Dutch",
  "Japanese",
  "Korean",
  "Chinese (Simplified)",
  "Turkish",
];

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
  { name: "VWO",              icon: "⚗️" },
  { name: "Snowflake",        icon: "❄️" },
  { name: "Zendesk",          icon: "🎧" },
  { name: "ServiceNow",       icon: "⚙️" },
  { name: "Qualtrics",        icon: "📝" },
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
    tip: "Include top areas to focus on i.e. pages, URLs, click actions, etc.",
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
    label: "Revenue Impact Analysis",
    icon: "💰",
    persona: "Executive",
    desc: "Connect product experience signals to revenue outcomes — what's driving growth and what's costing you",
    agent: "Analytics AI",
    agentColor: "#374151",
    agentBg: "#F3F4F6",
    tip: "Include your highest-value user segments and key revenue flows (trial → paid, upsell, renewal) as custom events or user properties in LogRocket so Galileo AI can isolate the sessions that matter most to revenue.",
    lrChatPrompt: "Show me the product experience differences between users who upgraded, renewed, or expanded their contract in the last 90 days versus those who downgraded or churned. Which features drove the most value, where did revenue-positive users spend their time, and what friction or errors appeared most often in sessions that preceded a cancellation or downgrade?",
    lrAutoPrompt: "Using the LogRocket MCP, pull session and funnel data for accounts tagged as 'at-risk' or 'expansion opportunity' in Salesforce. Cross-reference their recent feature usage and error rates with their ARR and renewal date. For any account showing declining engagement or recurring errors in a revenue-critical flow, generate a revenue risk summary and push it to the CSM in Slack with a link to the most relevant session replay and a suggested next action.",
    lrDiscoverPrompt: "Find the sessions in high-ARR accounts from the last 30 days where users encountered an error or rage-clicked in a flow directly tied to a paid feature or upgrade path. How many of these accounts have an open renewal or expansion opportunity, and what is the combined ARR at risk from these friction points?",
    outcome: "Revenue risk and growth register mapping product experience signals to ARR impact",
  },
  {
    label: "Competitive Win/Loss Signal Analysis",
    icon: "🏆",
    persona: "Executive",
    desc: "Use behavioral data to understand why customers choose you — or don't",
    agent: "Session Watching AI",
    agentColor: "#374151",
    agentBg: "#F3F4F6",
    tip: "Include information using custom user properties synced from your CRM like deal stage, competitor mentioned, or win/loss outcome.",
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

const MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const ACCENT = "#6C4BD8";
const ACCENT_DARK = "#4A2FA0";
const ACCENT_SOFT = "#F0ECFB";
const BORDER = "#EBE6DF";
const CARD_SHADOW = "0 1px 2px rgba(23,19,32,0.04), 0 14px 34px -16px rgba(23,19,32,0.12)";

const S = {
  app: {
    minHeight: "100vh",
    backgroundColor: "#F6F3EF",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#171320",
  },
  header: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderBottom: `1px solid ${BORDER}`,
    padding: "16px 32px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  hamburger: {
    display: "inline-flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "4px",
    width: "34px",
    height: "34px",
    padding: "8px",
    borderRadius: "8px",
    border: `1px solid ${BORDER}`,
    backgroundColor: "white",
    cursor: "pointer",
    flexShrink: 0,
  },
  hamburgerLine: {
    display: "block",
    height: "2px",
    width: "100%",
    backgroundColor: "#171320",
    borderRadius: "2px",
  },
  navBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 40,
  },
  navMenu: {
    position: "absolute",
    top: "60px",
    left: "24px",
    zIndex: 50,
    backgroundColor: "white",
    border: `1px solid ${BORDER}`,
    borderRadius: "14px",
    boxShadow: CARD_SHADOW,
    padding: "6px",
    minWidth: "230px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  navItem: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "9px",
    border: "none",
    backgroundColor: active ? ACCENT_SOFT : "transparent",
    color: active ? ACCENT_DARK : "#374151",
    fontSize: "14px",
    fontWeight: active ? "600" : "500",
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  }),
  headerTitle: {
    color: "#171320",
    fontSize: "17px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
  },
  headerDivider: {
    width: "1px",
    height: "20px",
    backgroundColor: BORDER,
  },
  headerSubName: {
    color: "#6b7280",
    fontSize: "15px",
    fontWeight: "400",
  },
  headerSub: {
    color: "#9ca3af",
    fontSize: "13px",
    marginLeft: "auto",
  },
  main: {
    maxWidth: "760px",
    margin: "0 auto",
    padding: "40px 24px 80px",
  },
  eyebrow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: MONO,
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: ACCENT,
    marginBottom: "12px",
  },
  eyebrowDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: ACCENT,
  },
  heroTitle: {
    fontSize: "38px",
    fontWeight: "700",
    letterSpacing: "-0.03em",
    color: "#171320",
    margin: "0 0 10px",
    lineHeight: "1.05",
  },
  heroSub: {
    fontSize: "16px",
    color: "#6b7280",
    margin: "0 0 32px",
    lineHeight: "1.5",
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
    fontFamily: MONO,
    fontSize: "11px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontWeight: active ? "600" : "500",
    color: done ? ACCENT : active ? ACCENT : "#9ca3af",
  }),
  progressDot: (active, done) => ({
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: done ? ACCENT : active ? ACCENT : "#e7e2db",
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
    backgroundColor: done ? ACCENT : "#e7e2db",
  }),
  card: {
    backgroundColor: "white",
    borderRadius: "18px",
    border: `1px solid ${BORDER}`,
    boxShadow: CARD_SHADOW,
    padding: "28px",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#171320",
    marginBottom: "6px",
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
    border: selected ? "1.5px solid #6C4BD8" : "1px solid #EBE6DF",
    backgroundColor: selected ? "#F0ECFB" : "white",
    cursor: "pointer",
    fontSize: "13px",
    color: selected ? "#4A2FA0" : "#374151",
    fontWeight: selected ? "500" : "400",
    transition: "all 0.12s",
    userSelect: "none",
  }),
  input: {
    width: "100%",
    padding: "9px 12px",
    fontSize: "13px",
    borderRadius: "8px",
    border: "1px solid #EBE6DF",
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
    border: "1px solid #EBE6DF",
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
    border: "1px solid #EBE6DF",
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
    backgroundColor: "#F0ECFB",
    color: "#4A2FA0",
    borderRadius: "100px",
    fontSize: "12px",
    fontWeight: "500",
  },
  personaTab: (active) => ({
    padding: "6px 14px",
    borderRadius: "8px",
    border: active ? "1.5px solid #6C4BD8" : "1px solid #EBE6DF",
    backgroundColor: active ? "#F0ECFB" : "white",
    fontSize: "12px",
    fontWeight: "500",
    color: active ? "#4A2FA0" : "#6b7280",
    cursor: "pointer",
    transition: "all 0.12s",
  }),
  useCase: (selected) => ({
    borderRadius: "10px",
    border: selected ? "1.5px solid #6C4BD8" : "1px solid #EBE6DF",
    backgroundColor: selected ? "#F0ECFB" : "white",
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
    backgroundColor: disabled ? "#c4bef0" : "#6C4BD8",
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
    border: "1px solid #EBE6DF",
    backgroundColor: "transparent",
    color: "#6b7280",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  outputBlock: {
    backgroundColor: "#FAF7F3",
    borderRadius: "10px",
    border: "1px solid #EBE6DF",
    padding: "16px",
    marginBottom: "12px",
  },
  outputLabel: {
    fontFamily: MONO,
    fontSize: "11px",
    fontWeight: "600",
    color: "#8a8380",
    letterSpacing: "0.06em",
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
    border: "1px solid #EBE6DF",
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
  rogPanel: {
    backgroundColor: "#F0FDF4",
    border: "1px solid #86efac",
    borderRadius: "10px",
    padding: "14px 16px",
    marginBottom: "16px",
  },
  rogPanelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  rogPanelTitle: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#15803d",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  rogPanelText: {
    fontSize: "12px",
    color: "#166534",
    lineHeight: "1.65",
    whiteSpace: "pre-wrap",
    maxHeight: "220px",
    overflowY: "auto",
  },
  rogBtn: (loading) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #86efac",
    backgroundColor: loading ? "#f0fdf4" : "#dcfce7",
    color: "#15803d",
    fontSize: "12px",
    fontWeight: "500",
    cursor: loading ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flexShrink: 0,
  }),
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
    backgroundColor: "#F0ECFB",
    borderRadius: "8px",
    marginBottom: "16px",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    backgroundColor: "#6C4BD8",
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
    background: "linear-gradient(135deg, #6C4BD8, #7b5ea7)",
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
  const steps = ["Select tools", "Team & use cases", "Add context", "Your prompts"];
  return (
    <div style={S.progress}>
      {steps.map((label, i) => {
        const num = i + 1;
        const active = step === num;
        const done = step > num;
        return (
          <div key={num} style={{ display: "flex", alignItems: "center", gap: "6px", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={S.progressDot(active, done)}>{done ? "✓" : num}</div>
            <span style={{ fontSize: "12px", fontWeight: active ? "600" : "400", color: done || active ? "#6C4BD8" : "#9ca3af", whiteSpace: "nowrap" }}>{label}</span>
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
              <button onClick={() => removeTag(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6C4BD8", fontSize: "14px", lineHeight: 1, padding: 0 }}>×</button>
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

function StepUseCase({ contact, setContact, selectedUseCases, setSelectedUseCases, rogContext, setRogContext, onBack, onNext }) {
  const [activePersonas, setActivePersonas] = useState(new Set());
  const [rogLoading, setRogLoading] = useState(false);
  const [rogError, setRogError] = useState("");
  const personas = ["Product", "Engineering", "UX / Design", "Support", "Marketing", "Executive"];

  const togglePersona = (p) => {
    setActivePersonas(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  const filtered = activePersonas.size === 0
    ? USE_CASES
    : USE_CASES.filter(u => activePersonas.has(u.persona));

  const handleEnrichFromRog = async () => {
    if (!contact.company.trim()) return;
    setRogLoading(true);
    setRogError("");
    setRogContext("");
    try {
      const ctx = await fetchRogContext(contact.company.trim());
      setRogContext(ctx);
    } catch (e) {
      LogRocket.captureException(e, { tags: { source: 'rog-enrichment' } });
      setRogError(e.message);
    } finally {
      setRogLoading(false);
    }
  };

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
            <div style={{ display: "flex", gap: "6px" }}>
              <input style={{ ...S.input, flex: 1 }} value={contact.company} onChange={e => { setContact(c => ({ ...c, company: e.target.value })); setRogContext(""); }} placeholder="e.g. Acme Corp" />
              <button
                style={S.rogBtn(rogLoading || !contact.company.trim())}
                onClick={handleEnrichFromRog}
                disabled={rogLoading || !contact.company.trim()}
                title="Pull recent Gong call themes and email context from Rog"
              >
                {rogLoading ? "⏳" : "✦"} Enrich from Rog
              </button>
            </div>
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
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#4A2FA0" }}>{contact.name || "—"}</div>
              <div style={{ fontSize: "12px", color: "#534AB7" }}>{[contact.title, contact.company].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        )}

        {rogContext && (
          <div style={S.rogPanel}>
            <div style={S.rogPanelHeader}>
              <span style={S.rogPanelTitle}>✦ Rog context — {contact.company}</span>
              <button onClick={() => setRogContext("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d", fontSize: "14px", padding: 0 }}>×</button>
            </div>
            <p style={S.rogPanelText}>{rogContext}</p>
          </div>
        )}
        {rogError && (
          <div style={{ ...S.tipBox, backgroundColor: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", marginBottom: "12px" }}>
            ⚠️ Rog error: {rogError}
          </div>
        )}
      </div>

      {/* Use case */}
      <div style={S.card}>
        <div style={S.sectionTitle}>What's their primary focus?</div>
        <div style={S.sectionSub}>Filter by team, then pick the closest use case.</div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {personas.map(p => (
            <button key={p} style={S.personaTab(activePersonas.has(p))} onClick={() => togglePersona(p)}>{p}</button>
          ))}
          {activePersonas.size > 0 && (
            <button onClick={() => setActivePersonas(new Set())} style={{ ...S.btnGhost, fontSize: "11px", padding: "4px 10px", color: "#9ca3af" }}>Clear</button>
          )}
        </div>

        <div>
          {filtered.map(u => {
            const sel = selectedUseCases.has(u.label);
            return (
              <div key={u.label} style={S.useCase(sel)} onClick={() => {
                setSelectedUseCases(prev => {
                  const next = new Set(prev);
                  next.has(u.label) ? next.delete(u.label) : next.add(u.label);
                  return next;
                });
              }}>
                <div style={S.useCaseHeader}>
                  <span style={{ fontSize: "18px", marginTop: "1px" }}>{u.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: "500", color: sel ? "#4A2FA0" : "#1a1523" }}>
                      {u.label}
                      <span style={{ fontSize: "11px", fontWeight: "400", color: "#9ca3af", marginLeft: "6px" }}>{u.persona}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{u.desc}</div>
                  </div>
                  {sel && <span style={{ fontSize: "16px", color: "#6C4BD8", flexShrink: 0 }}>✓</span>}
                </div>
                {sel && (
                  <div style={{ padding: "0 14px 12px 44px" }}>
                    <span style={S.agentBadge(u.agentBg, u.agentColor)}>✦ {u.agent}</span>
                    <div style={S.tipBox}><strong>💡 Additional Context Needed for Best Results:</strong> {u.tip}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedUseCases.size > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px" }}>
            {[...selectedUseCases].map(label => {
              const uc = USE_CASES.find(u => u.label === label);
              return (
                <span key={label} style={{ ...S.tag, backgroundColor: uc?.agentBg || "#F0ECFB", color: uc?.agentColor || "#4A2FA0" }}>
                  {uc?.icon} {label}
                  <button onClick={(e) => { e.stopPropagation(); setSelectedUseCases(prev => { const next = new Set(prev); next.delete(label); return next; }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "14px", lineHeight: 1, padding: 0 }}>×</button>
                </span>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", marginTop: "16px" }}>
          <button style={S.btnGhost} onClick={onBack}>← Back</button>
          <button style={S.btnPrimary(selectedUseCases.size === 0)} onClick={onNext} disabled={selectedUseCases.size === 0}>
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Per-use-case Context ────────────────────────────────────────────

function StepContext({ selectedUseCases, useCaseContexts, setUseCaseContexts, language, setLanguage, onBack, onGenerate }) {
  const useCaseList = USE_CASES.filter(u => selectedUseCases.has(u.label));

  return (
    <div style={S.card}>
      <div style={S.sectionTitle}>Add context for best results</div>
      <div style={S.sectionSub}>
        Fill in the details below to personalize your prompts. Each field is tailored to the use case you selected.
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={{ ...S.fieldLabel, marginBottom: "6px" }}>Output language</label>
        <select style={S.select} value={language} onChange={e => setLanguage(e.target.value)}>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px" }}>
          The generated prompts will be written in this language.
        </div>
      </div>

      {useCaseList.map(u => (
        <div key={u.label} style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "16px" }}>{u.icon}</span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#1a1523" }}>{u.label}</span>
            <span style={S.agentBadge(u.agentBg, u.agentColor)}>✦ {u.agent}</span>
          </div>
          <label style={{ ...S.fieldLabel, marginBottom: "6px", color: "#374151", fontSize: "12px" }}>
            {u.tip}
          </label>
          <textarea
            style={S.textarea}
            value={useCaseContexts[u.label] || ""}
            onChange={e => setUseCaseContexts(prev => ({ ...prev, [u.label]: e.target.value }))}
            placeholder="Optional — leave blank to use the default template..."
            rows={3}
          />
        </div>
      ))}

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", marginTop: "8px" }}>
        <button style={S.btnGhost} onClick={onBack}>← Back</button>
        <button style={S.btnPrimary(false)} onClick={onGenerate}>
          ✦ Generate {useCaseList.length > 1 ? `${useCaseList.length} use cases` : "prompts"}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Output ───────────────────────────────────────────────────────────

function UseCaseResult({ item }) {
  const { useCase: uc, prompts } = item;
  return (
    <div style={{ ...S.card, marginBottom: "16px" }}>
      <div style={S.lrBanner}>
        {uc.icon} <strong>{uc.label}</strong> &nbsp;·&nbsp; ✦ {uc.agent}
        <span style={{ marginLeft: "auto", opacity: 0.75, fontWeight: 400 }}>{uc.persona}</span>
      </div>

      {prompts.rationale && (
        <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.65", marginBottom: "14px" }}>
          {prompts.rationale}
        </p>
      )}

      <div style={S.outputBlock}>
        <div style={S.outputLabel}>
          <span>💬 Ask Galileo / Chat prompt</span>
          <CopyButton text={prompts.chat_prompt || ""} />
        </div>
        <p style={S.outputText}>{prompts.chat_prompt}</p>
      </div>

      <div style={S.outputBlock}>
        <div style={S.outputLabel}>
          <span>▶ MCP / Claude Agent / Cursor prompt</span>
          <CopyButton text={prompts.automation_prompt || ""} />
        </div>
        <p style={S.outputText}>{prompts.automation_prompt}</p>
      </div>

      <div style={{ ...S.outputBlock, borderColor: "#c7d2fe", backgroundColor: "#eef2ff" }}>
        <div style={S.outputLabel}>
          <span style={{ color: "#4338ca" }}>🔭 Discover Stream prompt</span>
          <CopyButton text={prompts.discover_prompt || ""} />
        </div>
        <p style={S.outputText}>{prompts.discover_prompt}</p>
      </div>

      {prompts.galileo_tip && (
        <div style={S.tipBox}>
          <strong>💡 Galileo tip:</strong> {prompts.galileo_tip}
        </div>
      )}
    </div>
  );
}

function PdfExportCard({ results }) {
  const [customer, setCustomer] = useState("");
  const [exporting, setExporting] = useState(false);
  // Default: every generated prompt selected.
  const [selection, setSelection] = useState(() => {
    const init = {};
    results.forEach(item =>
      PDF_PROMPT_TYPES.forEach(t => {
        if (item.prompts[t.key]) init[`${item.useCase.label}::${t.key}`] = true;
      })
    );
    return init;
  });

  const toggle = (key) => setSelection(s => ({ ...s, [key]: !s[key] }));
  const selectedCount = Object.values(selection).filter(Boolean).length;

  const download = async () => {
    setExporting(true);
    try {
      await exportPromptsToPdf({ results, selection, customer });
    } catch (e) {
      LogRocket.captureException(e, { tags: { source: "pdf-export" } });
      alert(`Could not generate PDF: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ ...S.card, borderColor: "#d9cff5", backgroundColor: "#FBFAFF" }}>
      <div style={S.sectionTitle}>Export to PDF</div>
      <div style={S.sectionSub}>
        Choose which prompts to include, add the customer you're sharing with, and download a branded PDF.
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={S.fieldLabel}>Customer name (shown on the PDF)</label>
        <input
          style={S.input}
          value={customer}
          onChange={e => setCustomer(e.target.value)}
          placeholder="e.g. Acme Corp"
        />
      </div>

      {results.map(item => {
        const available = PDF_PROMPT_TYPES.filter(t => item.prompts[t.key]);
        if (available.length === 0) return null;
        return (
          <div key={item.useCase.label} style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#171320", marginBottom: "8px" }}>
              {item.useCase.label}
            </div>
            {available.map(t => {
              const key = `${item.useCase.label}::${t.key}`;
              return (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", cursor: "pointer", fontSize: "13px", color: "#374151" }}>
                  <input type="checkbox" checked={!!selection[key]} onChange={() => toggle(key)} style={{ accentColor: "#6C4BD8", width: "15px", height: "15px" }} />
                  {t.label}
                </label>
              );
            })}
          </div>
        );
      })}

      <button
        style={{ ...S.btnPrimary(exporting || selectedCount === 0), marginTop: "4px" }}
        onClick={download}
        disabled={exporting || selectedCount === 0}
      >
        {exporting ? "Generating…" : `⬇ Download PDF (${selectedCount} prompt${selectedCount === 1 ? "" : "s"})`}
      </button>
    </div>
  );
}

function StepOutput({ results, contact, loading, loadingCount, onBack, onReset }) {
  if (loading) {
    return (
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", minHeight: "100px" }}>
          <div style={S.loadingDots}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: "8px", height: "8px", borderRadius: "50%",
                backgroundColor: "#6C4BD8",
                animation: `bounce 1s ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>
            Generating {loadingCount} use case{loadingCount > 1 ? "s" : ""}{contact.name ? ` for ${contact.name}` : ""}...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <div style={S.sectionTitle}>Your suggested prompts</div>
        <div style={S.sectionSub}>
          {contact.name
            ? `Tailored for ${contact.name}${contact.title ? `, ${contact.title}` : ""}${contact.company ? ` at ${contact.company}` : ""} — ${results.length} use case${results.length > 1 ? "s" : ""}.`
            : `${results.length} use case${results.length > 1 ? "s" : ""} — use the chat prompt in Galileo AI, the agent prompt in Cursor or Claude with MCP, and save the Discover prompt as a LogRocket Stream.`}
        </div>
      </div>

      {results.map(item => (
        <UseCaseResult key={item.useCase.label} item={item} />
      ))}

      {results.length > 0 && <PdfExportCard results={results} />}

      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
        <button style={S.btnGhost} onClick={onBack}>← Adjust</button>
        <button style={S.btnGhost} onClick={onReset}>↺ Start over</button>
      </div>
    </div>
  );
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

// The three path d-strings of the official LogRocket logo (icon + wordmark).
const LOGO_PATHS = [
  "M6.066 3.156A10.53 10.53 0 0 1 9.122 0a10.294 10.294 0 0 1 3.016 3.094 15.59 15.59 0 0 1 2.93 9.777c.637.513 1.293 1.006 1.918 1.53a3.46 3.46 0 0 1 1.104 3.189c-.302 1.457-.592 2.918-.911 4.372a1.214 1.214 0 0 1-1.848.61c-1.027-.825-2.027-1.678-3.05-2.504a4.684 4.684 0 0 1-2.891 1.255 4.678 4.678 0 0 1-3.385-1.22c-.735.541-1.419 1.191-2.138 1.772-.315.31-.666.58-1.046.806a1.215 1.215 0 0 1-1.603-.785c-.329-1.422-.672-2.839-.99-4.263a3.453 3.453 0 0 1 1.163-3.321c.559-.45 1.125-.893 1.694-1.331.159-.08.08-.261.087-.401a15.615 15.615 0 0 1 2.9-9.42m1.007 4.402a2.395 2.395 0 0 0 .21 3.173 2.636 2.636 0 0 0 3.603.075 2.398 2.398 0 0 0 .636-2.634 2.55 2.55 0 0 0-2.14-1.59 2.6 2.6 0 0 0-2.31.974",
  "M5.712 23.082a.605.605 0 0 1 .896-.485 5.778 5.778 0 0 0 5.03 0 .61.61 0 0 1 .896.45c.005.89.005 1.78 0 2.67a.602.602 0 0 1-.94.436c-.267-.226-.508-.48-.764-.719-.407.762-.789 1.534-1.199 2.294a.61.61 0 0 1-1.012.006c-.41-.761-.79-1.538-1.206-2.299-.253.24-.494.494-.761.72a.603.603 0 0 1-.94-.442c-.007-.878 0-1.756 0-2.634M9.102 10.259a1.22 1.22 0 0 0 1.248-1.192v-.008a1.221 1.221 0 0 0-1.24-1.2h-.008A1.22 1.22 0 0 0 7.855 9.05v.008a1.22 1.22 0 0 0 1.24 1.2h.007Z",
  "M22.79 6.163h1.953v13.186h8.156v1.776H22.787l.004-14.962Zm11.824 9.773a5.224 5.224 0 0 1 .476-2.229 5.588 5.588 0 0 1 1.29-1.776 5.9 5.9 0 0 1 4.14-1.584 5.746 5.746 0 0 1 4.068 1.51 5.135 5.135 0 0 1 1.649 3.941 5.142 5.142 0 0 1-1.765 3.961 5.899 5.899 0 0 1-4.141 1.576 5.74 5.74 0 0 1-4.082-1.5 5.086 5.086 0 0 1-1.638-3.898m2.005-.116a3.935 3.935 0 0 0 .296 1.531c.191.456.47.87.82 1.218a3.82 3.82 0 0 0 2.789 1.077 3.576 3.576 0 0 0 2.641-1.077 3.58 3.58 0 0 0 1.067-2.652 3.772 3.772 0 0 0-3.899-3.878 3.552 3.552 0 0 0-2.641 1.09 3.673 3.673 0 0 0-1.067 2.694m14.537.94a1.812 1.812 0 0 0-.507 1.133.8.8 0 0 0 .36.74c.3.168.623.29.959.36.402.09.857.168 1.363.232.507.063 1.028.126 1.564.19.528.07 1.046.161 1.553.274.474.093.935.242 1.373.444a2.043 2.043 0 0 1 1.322 1.88 3.753 3.753 0 0 1-1.656 3.107 5.943 5.943 0 0 1-3.624 1.151 6.751 6.751 0 0 1-3.318-.76 2.741 2.741 0 0 1-1.596-2.495 3.278 3.278 0 0 1 .785-2.017c.148-.19.31-.366.486-.529a2.005 2.005 0 0 1-1.532-1.892 3.761 3.761 0 0 1 1.394-2.894 2.957 2.957 0 0 1-.485-1.638 3.228 3.228 0 0 1 .37-1.574c.248-.451.59-.844 1.004-1.152a4.902 4.902 0 0 1 3.05-.972 4.742 4.742 0 0 1 3.022.972 4.064 4.064 0 0 1 2.18-.909 5.73 5.73 0 0 1 .824-.063l-.088 1.638a5.5 5.5 0 0 0-1.933.496c.238.464.362.979.359 1.5a2.961 2.961 0 0 1-.38 1.483 3.504 3.504 0 0 1-.994 1.142 4.839 4.839 0 0 1-2.968.95 5.13 5.13 0 0 1-2.885-.793m.507-3.707a1.87 1.87 0 0 0-.201.887c-.006.31.063.62.201.899.141.254.336.473.57.643a3.043 3.043 0 0 0 1.819.508c.907.099 1.79-.338 2.26-1.12.14-.27.21-.573.202-.877a1.856 1.856 0 0 0-.212-.898 1.857 1.857 0 0 0-.56-.655 3.006 3.006 0 0 0-1.817-.518 2.34 2.34 0 0 0-2.262 1.134m.021 7.796a2.75 2.75 0 0 0-.73 1.913 1.556 1.556 0 0 0 1.047 1.404 4.033 4.033 0 0 0 1.722.413 6.94 6.94 0 0 0 1.394-.117c.348-.064.683-.182.993-.349a1.693 1.693 0 0 0 1.025-1.542c0-.627-.606-1.047-1.817-1.258a24.982 24.982 0 0 0-1.913-.243 19.22 19.22 0 0 1-1.721-.221M75.27 10.78a4.594 4.594 0 0 1-3.064 4.597l2.843 5.758h-2.274l-2.567-5.21c-.725.108-1.456.161-2.188.16h-3.888v5.049h-1.954V6.173h6.14c1.7-.103 3.4.209 4.954.908a3.88 3.88 0 0 1 1.996 3.698m-6.984 3.529a7.267 7.267 0 0 0 3.508-.656 2.917 2.917 0 0 0 1.406-2.747c0-1.676-1.085-2.628-3.254-2.853a17.263 17.263 0 0 0-1.934-.105h-3.878v6.363l4.152-.002Zm9.328 1.638c-.007-.77.155-1.53.476-2.23a5.576 5.576 0 0 1 1.289-1.775 5.905 5.905 0 0 1 4.142-1.585 5.744 5.744 0 0 1 4.075 1.502 5.137 5.137 0 0 1 1.649 3.941 5.144 5.144 0 0 1-1.765 3.961 5.899 5.899 0 0 1-4.142 1.575 5.734 5.734 0 0 1-4.078-1.5 5.081 5.081 0 0 1-1.638-3.898m2.006-.116a3.815 3.815 0 0 0 1.11 2.747 3.82 3.82 0 0 0 2.789 1.076 3.572 3.572 0 0 0 2.641-1.076 3.582 3.582 0 0 0 1.067-2.653 3.769 3.769 0 0 0-1.11-2.779 3.782 3.782 0 0 0-2.789-1.098 3.552 3.552 0 0 0-2.642 1.088 3.673 3.673 0 0 0-1.066 2.695Zm20.35 3.043.369 1.49a6.46 6.46 0 0 1-3.888.983 4.995 4.995 0 0 1-3.846-1.5 5.592 5.592 0 0 1-1.363-3.974 5.43 5.43 0 0 1 1.532-3.93 5.207 5.207 0 0 1 3.878-1.585 5.61 5.61 0 0 1 3.4.96l-.698 1.572a4.719 4.719 0 0 0-2.896-.886 2.877 2.877 0 0 0-2.353 1.12 4.032 4.032 0 0 0-.856 2.62 4.2 4.2 0 0 0 .898 2.767 3.171 3.171 0 0 0 2.588 1.141 7.235 7.235 0 0 0 3.233-.784m2.673-14.232h2.005v10.577l4.744-4.65h2.344l-4.968 4.86 2.958 3.192a3.334 3.334 0 0 0 2.24 1.088l-.307 1.426a3.248 3.248 0 0 1-2.599-.591 5.742 5.742 0 0 1-.602-.581l-3.814-4.121v5.293h-2.005l.004-16.493Zm19.271 6.857c.392.403.691.886.878 1.416.219.57.33 1.175.327 1.786-.01.74-.081 1.479-.212 2.208h-7.354a3.507 3.507 0 0 0 1.036 2.018c.638.521 1.45.782 2.272.73a8.86 8.86 0 0 0 3.602-.72l.339 1.511a7.822 7.822 0 0 1-3.107.836c-.485.047-.971.068-1.457.063a5.49 5.49 0 0 1-1.881-.359 4.086 4.086 0 0 1-1.627-1.056 5.779 5.779 0 0 1-1.278-4.058 5.428 5.428 0 0 1 1.532-3.93 5.205 5.205 0 0 1 3.877-1.585 4.124 4.124 0 0 1 3.051 1.141m-.708 3.857.042-.57a2.513 2.513 0 0 0-1.447-2.568 2.895 2.895 0 0 0-1.162-.21 2.948 2.948 0 0 0-1.247.26 3.068 3.068 0 0 0-.971.72 3.816 3.816 0 0 0-.951 2.367l5.736.002Zm4.671-3.159h-1.134v-1.307l2.6-1.954h.539v1.638h3.021v1.626h-3.021v4.271a4.622 4.622 0 0 0 .454 2.451 2.393 2.393 0 0 0 1.774.794l-.305 1.426c-2.114.267-3.363-.567-3.749-2.504a9.235 9.235 0 0 1-.179-1.87v-4.57Z",
];

// Rasterize the LogRocket logo to a PNG data URL at the given fill color, so it
// can be embedded crisply in the PDF header.
function logoPngDataUrl(color, scale = 6) {
  const paths = LOGO_PATHS.map(d => `<path fill="${color}" fill-rule="evenodd" clip-rule="evenodd" d="${d}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 131 28">${paths}</svg>`;
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 131 * scale;
      canvas.height = 28 * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const PDF_PROMPT_TYPES = [
  { key: "chat_prompt", label: "Ask Galileo / Chat prompt" },
  { key: "automation_prompt", label: "MCP / Claude Agent / Cursor prompt" },
  { key: "discover_prompt", label: "Discover Stream prompt" },
];

async function exportPromptsToPdf({ results, selection, customer }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();   // 612
  const PH = doc.internal.pageSize.getHeight();   // 792
  const MX = 54;                                  // side margin
  const CW = PW - MX * 2;                          // content width
  const PURPLE = [108, 75, 216];
  const DARK = [23, 19, 32];
  const MUTED = [107, 114, 128];
  const HEADER_H = 92;

  let logoImg = null;
  try { logoImg = await logoPngDataUrl("#ffffff"); } catch { /* fall back to text */ }

  const drawHeaderBand = () => {
    doc.setFillColor(...PURPLE);
    doc.rect(0, 0, PW, HEADER_H, "F");
    if (logoImg) {
      const h = 20, w = (131 / 28) * h;
      doc.addImage(logoImg, "PNG", MX, 26, w, h);
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("LogRocket", MX, 42);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Galileo AI · Prompt Pack", MX, 66);
  };

  let pageNum = 0;
  const drawFooter = () => {
    pageNum += 1;
    doc.setDrawColor(235, 230, 223);
    doc.setLineWidth(0.5);
    doc.line(MX, PH - 40, PW - MX, PH - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("LogRocket · Confidential — internal & customer use", MX, PH - 26);
    doc.text(`Page ${pageNum}`, PW - MX, PH - 26, { align: "right" });
  };

  drawHeaderBand();
  drawFooter();

  // Title block
  let y = HEADER_H + 40;
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Galileo AI Prompt Pack", MX, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...MUTED);
  if (customer && customer.trim()) {
    doc.text(`Prepared for ${customer.trim()}`, MX, y);
    y += 30;
  } else {
    y += 12;
  }

  const ensureSpace = (needed) => {
    if (y + needed > PH - 56) {
      doc.addPage();
      drawFooter();
      y = 54;
    }
  };

  results.forEach(item => {
    const uc = item.useCase;
    const selectedTypes = PDF_PROMPT_TYPES.filter(
      t => selection[`${uc.label}::${t.key}`] && item.prompts[t.key]
    );
    if (selectedTypes.length === 0) return;

    ensureSpace(60);
    // Use-case heading with a purple rule
    doc.setDrawColor(...PURPLE);
    doc.setLineWidth(2);
    doc.line(MX, y - 10, MX, y + 4);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(uc.label, MX + 10, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PURPLE);
    doc.text(`${uc.agent}  ·  ${uc.persona}`, MX + 10, y);
    y += 22;

    selectedTypes.forEach(t => {
      const body = item.prompts[t.key];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const label = t.label.toUpperCase();
      ensureSpace(40);
      doc.setTextColor(...PURPLE);
      doc.text(label, MX, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(body, CW);
      lines.forEach(line => {
        ensureSpace(16);
        doc.text(line, MX, y);
        y += 15;
      });
      y += 12;
    });
    y += 8;
  });

  const safe = (customer && customer.trim() ? customer.trim().replace(/[^a-z0-9]+/gi, "-") : "logrocket") + "-galileo-prompts.pdf";
  doc.save(safe.toLowerCase());
}

// ─── API Call ─────────────────────────────────────────────────────────────────

async function generatePrompts({ selectedTools, useCase, contact, context, rogContext, language = "English" }) {
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
Customer tools: ${tools}
${context ? `Additional context from the rep (specific values to USE directly in the prompts): ${context}` : ""}
${(contactLine || rogContext) ? `\n--- INTERNAL BACKGROUND (for your direction only — see the constraint below) ---${contactLine ? `\n${contactLine}` : ""}${rogContext ? `\nRecent Gong call themes and email context from Rog:\n${rogContext}` : ""}\n--- END INTERNAL BACKGROUND ---` : ""}

IMPORTANT — how to use the INTERNAL BACKGROUND: Use it ONLY to inform your strategic
angle, which capabilities to emphasize, and your "rationale" field below. You MUST NOT
copy any of it into the three generated prompts. Specifically, the chat_prompt,
automation_prompt, and discover_prompt must NOT contain: the contact's name or title,
the company name, the industry, or any Gong call/email detail. Where a customer-specific
value would naturally go, use a neutral placeholder instead (e.g. {company}, {user ID},
{account}, {URL}, {custom event}). The three prompts must read as clean, reusable
templates — only the customer's tool stack may be referenced by name.

EXCEPTION — the rep's additional context: Any specific values the rep provided in
"Additional context from the rep" above (e.g. a feature name, URL, CTA text, custom
event, page path, or focus area) MUST be used directly and verbatim in the generated
prompts, replacing the corresponding placeholder. Only fall back to a placeholder when
the rep did NOT provide that specific value. This additional context is intentionally
supplied to be baked into the prompts — do not placeholder over it. (This exception does
NOT apply to the INTERNAL BACKGROUND, which always stays out of the prompts.)

LogRocket prompt templates to adapt from:
- Chat template: "${useCase.lrChatPrompt}"
- Automation template: "${useCase.lrAutoPrompt}"
- Discover Stream template: "${useCase.lrDiscoverPrompt}"
- Desired outcome: ${useCase.outcome}

Generate THREE refined prompts:
1. "chat_prompt" — Ready-to-use for LogRocket's Ask Galileo or Claude. Adapt the template to the customer's tools and the selected use case. Bake in any specific values from the rep's additional context verbatim, and use placeholders only for customer-specific values the rep did not provide (per the constraint and exception above).
2. "automation_prompt" — Written as an MCP / Claude agent / Cursor instruction that a developer or power user would run to pull LogRocket session, issue, or analytics data via the LogRocket MCP server and combine it with data from the customer's other tools (e.g. pull a Jira ticket + matching LogRocket session, or query Salesforce account health + LogRocket usage metrics). The prompt should read like a natural-language agent instruction with: (a) a clear trigger or starting condition, (b) which MCP tools or data sources to call and in what order, (c) how to combine or cross-reference the data, and (d) the final output format or destination (Slack message, Jira comment, dashboard, etc.). Reference the customer's actual tool stack where relevant.
3. "discover_prompt" — A suggested Discovery Stream prompt the customer can save in LogRocket to surface unexpected behavioral patterns proactively. Should be open-ended, exploratory, and adapted to the selected use case and the customer's tools (per the constraint above — no contact, company, industry, or Rog detail).

Write the "chat_prompt", "automation_prompt", "discover_prompt", "rationale", and "galileo_tip" values entirely in ${language}. Keep product and tool names (LogRocket, Galileo, Ask Galileo, Cursor, ${tools}) and placeholder tokens (e.g. {company}, {user ID}, {URL}, {custom event}) unchanged in their original form. The JSON keys must stay in English exactly as shown.

Respond ONLY as valid JSON, no markdown:
{
  "chat_prompt": "...",
  "automation_prompt": "...",
  "discover_prompt": "...",
  "rationale": "1-2 sentences on the strategic angle",
  "galileo_tip": "One sentence on how to get the best results from Galileo AI for this use case"
}`;

  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1600,
      system: systemPrompt,
      messages: [{ role: "user", content: "Generate the prompts." }],
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `API error ${res.status}`);
  }

  const raw = data.content?.find(b => b.type === "text")?.text || "";
  if (!raw) throw new Error("Empty response from API");

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

// ─── Rog Fetch ───────────────────────────────────────────────────────────────

async function fetchRogContext(company) {
  const res = await fetch("/api/rog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: `For the customer account "${company}", summarize in plain text: (1) the top 3 Gong call themes from the last 90 days including sentiment and any risk signals, and (2) key recent email exchange themes from the last 30 days. Keep it concise — 150 words max. Focus on pain points, product feedback, and relationship signals that would help a sales rep personalize an AI prompt.`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Rog API error ${res.status}`);
  return data.answer || "";
}

// ─── Competitor Guide ─────────────────────────────────────────────────────────

const COMPETITORS = [
  "PostHog", "FullStory", "Hotjar", "Datadog", "Sentry", "Pendo",
  "Amplitude", "Heap", "Glassbox", "Contentsquare", "Microsoft Clarity", "Other",
];

const GUIDE_INDUSTRIES = [
  "E-commerce", "SaaS / Software", "Fintech", "Healthcare", "Media & Entertainment",
  "Travel & Hospitality", "Marketplace", "Education", "Gaming", "Other",
];

const COMPANY_SIZES = [
  "1–50 employees", "51–200 employees", "201–1,000 employees",
  "1,001–5,000 employees", "5,000+ employees",
];

// Independent AI-accuracy study referenced in every guide.
const AI_STUDY_URL = "https://www.linkedin.com/posts/matthew-arbesfeld-04b5429b_aakash-gupta-evaluated-logrocket-vs-posthog-share-7462578059741859840-yt4l/";

async function fetchRogCustomerExamples({ industry, size, competitor }) {
  const bits = [
    industry && `in the ${industry} industry`,
    size && `around ${size}`,
  ].filter(Boolean).join(", ");
  const res = await fetch("/api/rog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: `List 2-4 LogRocket customer references or case studies${bits ? `, ideally ${bits}` : ""}${competitor ? `, that chose LogRocket over ${competitor} or switched from a competitor` : ""}. For each, give: the company name (only if it is a known/publicly referenceable customer), a one-line profile (industry + size), and the concrete outcome or result they saw with LogRocket. Plain text, concise. If you don't have specific named references, say so explicitly.`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Rog API error ${res.status}`);
  return data.answer || "";
}

async function generateCompetitorGuide({ competitor, company, industry, size, includeFeatureComparison, featureFocus, rogExamples }) {
  const systemPrompt = `You are a competitive strategy expert at LogRocket helping a sales rep build a customized competitor guide to position LogRocket against ${competitor}.

${company ? `Prospect/customer: ${company}` : ""}
${industry ? `Industry: ${industry}` : ""}
${size ? `Company size: ${size}` : ""}

Non-negotiable messages this guide MUST land:
1. AI ACCURACY: LogRocket's Galileo AI returns more accurate, trustworthy answers than ${competitor}'s AI. Reference this independent evaluation (Aakash Gupta evaluated LogRocket vs PostHog): ${AI_STUDY_URL}. Explain why accuracy matters for the buyer and what inaccurate AI answers cost a team.
2. UNIFIED DATA: LogRocket is more effective at surfacing issues because it correlates every data point across the entire stack together — errors, session replay, releases/deploys, and user feedback — in one place, whereas ${competitor} typically leaves these siloed. Make this concrete for the ${industry || "customer's"} context.

${rogExamples ? `Customer examples grounding (from LogRocket's Rog data — use ONLY the named customers and facts present here; do not invent customer names):\n${rogExamples}` : `No Rog customer data was provided. For "customer_examples", produce anonymized example PROFILES by industry/size (e.g. "A mid-market fintech…") — do NOT invent specific named companies.`}

Respond ONLY as valid JSON, no markdown, in this exact shape:
{
  "headline": "One-line positioning statement for LogRocket vs ${competitor}",
  "overview": "2-3 sentence overview framing the comparison for this specific prospect",
  "ai_accuracy": "A paragraph making message #1 above concrete for this prospect. End by citing the independent study.",
  "unified_data": "A paragraph making message #2 above concrete for this prospect and industry",
  ${includeFeatureComparison ? `"feature_comparison": [ { "feature": "Session Replay", "logrocket": "…", "competitor": "…" }, … ${featureFocus && featureFocus.trim() ? `one row for EACH of these rep-specified capabilities (in this order), plus any that are clearly essential to a fair comparison: ${featureFocus.trim()}` : "5-7 rows covering the capabilities that matter most to this buyer"} ],` : `"feature_comparison": [],`}
  "customer_examples": [ { "name": "Company name or anonymized profile", "profile": "industry + size", "outcome": "the result/win" }, … ],
  "objection_handling": "1-2 common objections a ${competitor} rep raises, each with a crisp LogRocket response",
  "discovery_questions": ["3-5 discovery questions that expose ${competitor} gaps and surface LogRocket value"]
}`;

  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Generate the competitor guide." }],
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || `API error ${res.status}`);
  const raw = data.content?.find(b => b.type === "text")?.text || "";
  if (!raw) throw new Error("Empty response from API");
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

async function exportGuideToPdf({ guide, competitor, customer }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const MX = 54;
  const CW = PW - MX * 2;
  const PURPLE = [108, 75, 216];
  const DARK = [23, 19, 32];
  const MUTED = [107, 114, 128];
  const HEADER_H = 92;

  let logoImg = null;
  try { logoImg = await logoPngDataUrl("#ffffff"); } catch { /* text fallback */ }

  const drawHeaderBand = () => {
    doc.setFillColor(...PURPLE);
    doc.rect(0, 0, PW, HEADER_H, "F");
    if (logoImg) {
      const h = 20, w = (131 / 28) * h;
      doc.addImage(logoImg, "PNG", MX, 26, w, h);
    } else {
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
      doc.text("LogRocket", MX, 42);
    }
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Competitive Guide  ·  LogRocket vs ${competitor}`, MX, 66);
  };

  let pageNum = 0;
  const drawFooter = () => {
    pageNum += 1;
    doc.setDrawColor(235, 230, 223); doc.setLineWidth(0.5);
    doc.line(MX, PH - 40, PW - MX, PH - 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text("LogRocket · Confidential — internal & customer use", MX, PH - 26);
    doc.text(`Page ${pageNum}`, PW - MX, PH - 26, { align: "right" });
  };

  drawHeaderBand();
  drawFooter();
  let y = HEADER_H + 40;

  doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text(`LogRocket vs ${competitor}`, MX, y);
  y += 20;
  if (customer && customer.trim()) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(...MUTED);
    doc.text(`Prepared for ${customer.trim()}`, MX, y);
    y += 20;
  }
  if (guide.headline) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...PURPLE);
    doc.splitTextToSize(guide.headline, CW).forEach(l => { y += 16; doc.text(l, MX, y); });
    y += 6;
  }
  y += 12;

  const ensureSpace = (n) => { if (y + n > PH - 56) { doc.addPage(); drawFooter(); y = 54; } };

  const section = (title, body) => {
    if (!body) return;
    ensureSpace(50);
    doc.setDrawColor(...PURPLE); doc.setLineWidth(2); doc.line(MX, y - 9, MX, y + 4);
    doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(title, MX + 10, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...DARK);
    doc.splitTextToSize(body, CW).forEach(l => { ensureSpace(16); doc.text(l, MX, y); y += 15; });
    y += 18;
  };

  section("Overview", guide.overview);
  section("AI accuracy you can trust", guide.ai_accuracy);
  // clickable study link
  ensureSpace(20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...PURPLE);
  doc.textWithLink("→ Read the independent LogRocket vs PostHog AI evaluation", MX, y, { url: AI_STUDY_URL });
  y += 22;
  section("One connected picture of every issue", guide.unified_data);

  if (Array.isArray(guide.feature_comparison) && guide.feature_comparison.length) {
    ensureSpace(60);
    doc.setDrawColor(...PURPLE); doc.setLineWidth(2); doc.line(MX, y - 9, MX, y + 4);
    doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("Feature comparison", MX + 10, y); y += 20;
    const c0 = MX, c1 = MX + CW * 0.34, c2 = MX + CW * 0.67;
    doc.setFontSize(9); doc.setTextColor(...MUTED); doc.setFont("helvetica", "bold");
    doc.text("CAPABILITY", c0, y); doc.text("LOGROCKET", c1, y); doc.text(competitor.toUpperCase(), c2, y);
    y += 6; doc.setDrawColor(...[235, 230, 223]); doc.setLineWidth(0.5); doc.line(MX, y, PW - MX, y); y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    guide.feature_comparison.forEach(row => {
      const f = doc.splitTextToSize(row.feature || "", CW * 0.32);
      const lr = doc.splitTextToSize(row.logrocket || "", CW * 0.31);
      const cp = doc.splitTextToSize(row.competitor || "", CW * 0.31);
      const rowH = Math.max(f.length, lr.length, cp.length) * 13 + 8;
      ensureSpace(rowH + 4);
      const y0 = y;
      doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); f.forEach((l, i) => doc.text(l, c0, y0 + i * 13));
      doc.setFont("helvetica", "normal"); doc.setTextColor(...PURPLE); lr.forEach((l, i) => doc.text(l, c1, y0 + i * 13));
      doc.setTextColor(...MUTED); cp.forEach((l, i) => doc.text(l, c2, y0 + i * 13));
      y = y0 + rowH;
      doc.setDrawColor(...[240, 236, 230]); doc.setLineWidth(0.5); doc.line(MX, y - 4, PW - MX, y - 4);
    });
    y += 18;
  }

  if (Array.isArray(guide.customer_examples) && guide.customer_examples.length) {
    ensureSpace(50);
    doc.setDrawColor(...PURPLE); doc.setLineWidth(2); doc.line(MX, y - 9, MX, y + 4);
    doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("Customer examples", MX + 10, y); y += 20;
    guide.customer_examples.forEach(ex => {
      ensureSpace(40);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...DARK);
      doc.text(`${ex.name || "Customer"}${ex.profile ? `  —  ${ex.profile}` : ""}`, MX, y); y += 15;
      if (ex.outcome) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
        doc.splitTextToSize(ex.outcome, CW).forEach(l => { ensureSpace(14); doc.text(l, MX, y); y += 13; });
      }
      y += 10;
    });
    y += 8;
  }

  section("Handling objections", guide.objection_handling);

  if (Array.isArray(guide.discovery_questions) && guide.discovery_questions.length) {
    ensureSpace(50);
    doc.setDrawColor(...PURPLE); doc.setLineWidth(2); doc.line(MX, y - 9, MX, y + 4);
    doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("Discovery questions", MX + 10, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...DARK);
    guide.discovery_questions.forEach(q => {
      doc.splitTextToSize(`•  ${q}`, CW).forEach(l => { ensureSpace(16); doc.text(l, MX, y); y += 15; });
      y += 4;
    });
  }

  const safe = (customer && customer.trim() ? customer.trim() : `logrocket-vs-${competitor}`).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`${safe}-competitor-guide.pdf`);
}

// ─── App ──────────────────────────────────────────────────────────────────────

function PromptGenerator() {
  const [step, setStep] = useState(1);
  const [selectedTools, setSelectedTools] = useState(new Set());
  const [contact, setContact] = useState({ name: "", title: "", company: "", industry: "" });
  const [selectedUseCases, setSelectedUseCases] = useState(new Set());
  const [useCaseContexts, setUseCaseContexts] = useState({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [rogContext, setRogContext] = useState("");
  const [language, setLanguage] = useState("English");

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setStep(4);
    const useCaseList = USE_CASES.filter(u => selectedUseCases.has(u.label));
    const settled = await Promise.all(
      useCaseList.map(useCase =>
        generatePrompts({ selectedTools, useCase, contact, context: useCaseContexts[useCase.label] || "", rogContext, language })
          .then(prompts => ({ useCase, prompts }))
          .catch(e => {
            LogRocket.captureException(e, { tags: { source: 'prompt-generation', useCase: useCase.label } });
            return { useCase, prompts: { chat_prompt: `Error: ${e.message}`, automation_prompt: "", discover_prompt: "" } };
          })
      )
    );
    setResults(settled);
    setLoading(false);
    LogRocket.track('Prompts Generated', {
      company: contact.company,
      useCases: [...selectedUseCases].join(', '),
      tools: [...selectedTools].join(', '),
    });
  }, [selectedTools, selectedUseCases, contact, useCaseContexts, rogContext, language]);

  const reset = () => {
    setStep(1);
    setSelectedTools(new Set());
    setContact({ name: "", title: "", company: "", industry: "" });
    setSelectedUseCases(new Set());
    setUseCaseContexts({});
    setResults([]);
    setRogContext("");
  };

  return (
    <>
      <div style={S.eyebrow}>
        <span style={S.eyebrowDot} />
        Internal · Revenue Tool
      </div>
      <h1 style={S.heroTitle}>Build a prompt</h1>
      <p style={S.heroSub}>
        Tailor LogRocket Galileo AI prompts to your customer's stack, team, and use case.
      </p>

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
          selectedUseCases={selectedUseCases}
          setSelectedUseCases={setSelectedUseCases}
          rogContext={rogContext}
          setRogContext={setRogContext}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepContext
          selectedUseCases={selectedUseCases}
          useCaseContexts={useCaseContexts}
          setUseCaseContexts={setUseCaseContexts}
          language={language}
          setLanguage={setLanguage}
          onBack={() => setStep(2)}
          onGenerate={handleGenerate}
        />
      )}

      {step === 4 && (
        <StepOutput
          results={results}
          contact={contact}
          loading={loading}
          loadingCount={selectedUseCases.size}
          onBack={() => setStep(3)}
          onReset={reset}
        />
      )}
    </>
  );
}

function LogoMark({ height = 22, color = "#171320" }) {
  return (
    <svg height={height} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 131 28" aria-label="LogRocket" style={{ color, flexShrink: 0 }}>
      {LOGO_PATHS.map((d, i) => (
        <path key={i} fill="currentColor" fillRule="evenodd" clipRule="evenodd" d={d} />
      ))}
    </svg>
  );
}

// ─── Competitor Guide page ─────────────────────────────────────────────────────

function GuideSection({ title, children }) {
  return (
    <div style={{ marginBottom: "22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ width: "3px", height: "16px", backgroundColor: ACCENT, borderRadius: "2px" }} />
        <span style={{ fontSize: "15px", fontWeight: "700", color: "#171320" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function CompetitorGuide() {
  const [preset, setPreset] = useState("PostHog");
  const [customCompetitor, setCustomCompetitor] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [includeFeatureComparison, setIncludeFeatureComparison] = useState(true);
  const [featureFocus, setFeatureFocus] = useState("");
  const [rogExamples, setRogExamples] = useState("");
  const [rogLoading, setRogLoading] = useState(false);
  const [rogError, setRogError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState(null);
  const [error, setError] = useState("");
  const [pdfCustomer, setPdfCustomer] = useState("");
  const [exporting, setExporting] = useState(false);

  const competitor = (preset === "Other" ? customCompetitor.trim() : preset);

  const pullRog = async () => {
    setRogLoading(true); setRogError("");
    try { setRogExamples(await fetchRogCustomerExamples({ industry, size, competitor })); }
    catch (e) { setRogError(e.message); }
    finally { setRogLoading(false); }
  };

  const generate = async () => {
    setLoading(true); setError(""); setGuide(null);
    try {
      const g = await generateCompetitorGuide({ competitor, company, industry, size, includeFeatureComparison, featureFocus, rogExamples });
      setGuide(g);
      if (company && !pdfCustomer) setPdfCustomer(company);
      LogRocket.track("Competitor Guide Generated", { competitor, industry, size });
    } catch (e) {
      LogRocket.captureException(e, { tags: { source: "competitor-guide" } });
      setError(e.message);
    } finally { setLoading(false); }
  };

  const downloadPdf = async () => {
    setExporting(true);
    try { await exportGuideToPdf({ guide, competitor, customer: pdfCustomer || company }); }
    catch (e) { LogRocket.captureException(e, { tags: { source: "guide-pdf" } }); alert(`Could not generate PDF: ${e.message}`); }
    finally { setExporting(false); }
  };

  return (
    <>
      <div style={S.eyebrow}>
        <span style={S.eyebrowDot} />
        Internal · Competitive
      </div>
      <h1 style={S.heroTitle}>Competitor guide</h1>
      <p style={S.heroSub}>
        Build a customized guide positioning LogRocket against a competitor — with AI-accuracy proof, our unified-data advantage, and Rog-sourced customer examples.
      </p>

      <div style={S.card}>
        <div style={S.sectionTitle}>Who are you up against?</div>
        <div style={S.sectionSub}>Pick the competitor and add customer context so examples and framing are tailored.</div>

        <div style={{ marginBottom: "16px" }}>
          <label style={S.fieldLabel}>Competitor</label>
          <select style={S.select} value={preset} onChange={e => setPreset(e.target.value)}>
            {COMPETITORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {preset === "Other" && (
            <input style={{ ...S.input, marginTop: "8px" }} value={customCompetitor} onChange={e => setCustomCompetitor(e.target.value)} placeholder="Enter competitor name" />
          )}
        </div>

        <div style={S.fieldGrid}>
          <div>
            <label style={S.fieldLabel}>Customer / prospect</label>
            <input style={S.input} value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Acme Corp" />
          </div>
          <div>
            <label style={S.fieldLabel}>Industry</label>
            <select style={S.select} value={industry} onChange={e => setIndustry(e.target.value)}>
              <option value="">Select industry…</option>
              {GUIDE_INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={S.fieldLabel}>Company size</label>
          <select style={S.select} value={size} onChange={e => setSize(e.target.value)}>
            <option value="">Select size…</option>
            {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <label style={{ ...S.fieldLabel, marginBottom: 0 }}>Customer examples (from Rog)</label>
            <button style={S.rogBtn(rogLoading)} onClick={pullRog} disabled={rogLoading}>
              {rogLoading ? "Pulling…" : "✦ Pull from Rog"}
            </button>
          </div>
          <textarea
            style={S.textarea}
            value={rogExamples}
            onChange={e => setRogExamples(e.target.value)}
            placeholder="Optional — pull LogRocket customer examples by industry/size from Rog, or paste your own. Used to ground the examples in the guide."
            rows={4}
          />
          {rogError && <div style={{ fontSize: "12px", color: "#b91c1c", marginTop: "6px" }}>⚠️ Rog error: {rogError}</div>}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#374151", marginBottom: includeFeatureComparison ? "10px" : "20px" }}>
          <input type="checkbox" checked={includeFeatureComparison} onChange={e => setIncludeFeatureComparison(e.target.checked)} style={{ accentColor: ACCENT, width: "15px", height: "15px" }} />
          Include a feature comparison table (optional)
        </label>

        {includeFeatureComparison && (
          <div style={{ marginBottom: "20px" }}>
            <label style={S.fieldLabel}>Which capabilities to compare? (optional)</label>
            <textarea
              style={S.textarea}
              value={featureFocus}
              onChange={e => setFeatureFocus(e.target.value)}
              placeholder="Comma-separated — e.g. session replay, error tracking, product analytics, funnels, AI insights, data retention. Leave blank and we'll pick the most relevant."
              rows={2}
            />
          </div>
        )}

        <button style={S.btnPrimary(loading || !competitor)} onClick={generate} disabled={loading || !competitor}>
          {loading ? "Generating…" : `✦ Generate guide${competitor ? ` vs ${competitor}` : ""}`}
        </button>
        {error && <div style={{ fontSize: "13px", color: "#b91c1c", marginTop: "12px" }}>⚠️ {error}</div>}
      </div>

      {guide && (
        <>
          <div style={S.card}>
            <div style={S.lrBanner}>
              ◆ <strong>LogRocket vs {competitor}</strong>
              {industry && <span style={{ marginLeft: "auto", opacity: 0.75, fontWeight: 400 }}>{industry}</span>}
            </div>

            {guide.headline && (
              <p style={{ fontSize: "16px", fontWeight: "600", color: ACCENT_DARK, lineHeight: "1.5", marginBottom: "16px" }}>{guide.headline}</p>
            )}

            {guide.overview && <GuideSection title="Overview"><p style={S.outputText}>{guide.overview}</p></GuideSection>}

            {guide.ai_accuracy && (
              <GuideSection title="AI accuracy you can trust">
                <p style={S.outputText}>{guide.ai_accuracy}</p>
                <a href={AI_STUDY_URL} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "8px", fontSize: "13px", color: ACCENT, fontWeight: "600" }}>
                  → Read the independent LogRocket vs PostHog AI evaluation
                </a>
              </GuideSection>
            )}

            {guide.unified_data && <GuideSection title="One connected picture of every issue"><p style={S.outputText}>{guide.unified_data}</p></GuideSection>}

            {Array.isArray(guide.feature_comparison) && guide.feature_comparison.length > 0 && (
              <GuideSection title="Feature comparison">
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 1.3fr", backgroundColor: "#FAF7F3", fontFamily: MONO, fontSize: "10px", fontWeight: "600", letterSpacing: "0.05em", color: "#8a8380", textTransform: "uppercase" }}>
                    <div style={{ padding: "8px 10px" }}>Capability</div>
                    <div style={{ padding: "8px 10px" }}>LogRocket</div>
                    <div style={{ padding: "8px 10px" }}>{competitor}</div>
                  </div>
                  {guide.feature_comparison.map((row, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 1.3fr", borderTop: `1px solid ${BORDER}`, fontSize: "12px" }}>
                      <div style={{ padding: "9px 10px", fontWeight: "600", color: "#171320" }}>{row.feature}</div>
                      <div style={{ padding: "9px 10px", color: ACCENT_DARK }}>{row.logrocket}</div>
                      <div style={{ padding: "9px 10px", color: "#6b7280" }}>{row.competitor}</div>
                    </div>
                  ))}
                </div>
              </GuideSection>
            )}

            {Array.isArray(guide.customer_examples) && guide.customer_examples.length > 0 && (
              <GuideSection title="Customer examples">
                {guide.customer_examples.map((ex, i) => (
                  <div key={i} style={{ ...S.outputBlock, marginBottom: "10px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#171320" }}>
                      {ex.name}{ex.profile ? <span style={{ color: "#6b7280", fontWeight: 400 }}> — {ex.profile}</span> : null}
                    </div>
                    {ex.outcome && <p style={{ ...S.outputText, fontSize: "12px", marginTop: "4px" }}>{ex.outcome}</p>}
                  </div>
                ))}
              </GuideSection>
            )}

            {guide.objection_handling && <GuideSection title="Handling objections"><p style={S.outputText}>{guide.objection_handling}</p></GuideSection>}

            {Array.isArray(guide.discovery_questions) && guide.discovery_questions.length > 0 && (
              <GuideSection title="Discovery questions">
                <ul style={{ margin: 0, paddingLeft: "18px" }}>
                  {guide.discovery_questions.map((q, i) => (
                    <li key={i} style={{ ...S.outputText, marginBottom: "6px" }}>{q}</li>
                  ))}
                </ul>
              </GuideSection>
            )}
          </div>

          <div style={{ ...S.card, borderColor: "#d9cff5", backgroundColor: "#FBFAFF" }}>
            <div style={S.sectionTitle}>Export to PDF</div>
            <div style={S.sectionSub}>Download a branded, uniform PDF of this guide to share.</div>
            <div style={{ marginBottom: "16px" }}>
              <label style={S.fieldLabel}>Customer name (shown on the PDF)</label>
              <input style={S.input} value={pdfCustomer} onChange={e => setPdfCustomer(e.target.value)} placeholder="e.g. Acme Corp" />
            </div>
            <button style={S.btnPrimary(exporting)} onClick={downloadPdf} disabled={exporting}>
              {exporting ? "Generating…" : "⬇ Download guide PDF"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ─── App shell ──────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("prompts");
  const [userEmail, setUserEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(({ email }) => {
        if (email) {
          setUserEmail(email);
          LogRocket.identify(email, { email, name: email.split('@')[0] });
        } else {
          LogRocket.identify('anonymous');
        }
      })
      .catch(() => LogRocket.identify('anonymous'));
  }, []);

  const go = (p) => { setPage(p); setMenuOpen(false); };

  return (
    <div style={S.app}>
      {/* Inject bounce keyframes */}
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, select:focus, textarea:focus { outline: 2px solid #6C4BD8; outline-offset: 1px; }
        button:focus-visible { outline: 2px solid #6C4BD8; outline-offset: 2px; }
      `}</style>

      {/* Header */}
      <header style={S.header}>
        <button aria-label="Open menu" style={S.hamburger} onClick={() => setMenuOpen(o => !o)}>
          <span style={S.hamburgerLine} />
          <span style={S.hamburgerLine} />
          <span style={S.hamburgerLine} />
        </button>
        <LogoMark />
        <span style={S.headerDivider} />
        <span style={S.headerSubName}>{page === "prompts" ? "AI Prompt Generator" : "Competitor Guide"}</span>
        {userEmail && <span style={S.headerSub}>{userEmail}</span>}
        {menuOpen && (
          <>
            <div style={S.navBackdrop} onClick={() => setMenuOpen(false)} />
            <nav style={S.navMenu}>
              <button style={S.navItem(page === "prompts")} onClick={() => go("prompts")}>✦ AI Prompt Generator</button>
              <button style={S.navItem(page === "competitor")} onClick={() => go("competitor")}>◆ Competitor Guide</button>
            </nav>
          </>
        )}
      </header>

      {/* Main */}
      <main style={S.main}>
        {page === "prompts" ? <PromptGenerator /> : <CompetitorGuide />}
      </main>
    </div>
  );
}
