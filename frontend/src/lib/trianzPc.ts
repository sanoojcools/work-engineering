/** Trianz P&C leader copy, transcribed from
 * "Trianz P&C — FY27 Priority & Time-Motion Interview Guide" (2026-09-21).
 * Portfolio paragraph plus the six interview blocks only.
 * Nagraj's six answers are the guide's own words. The guide's
 * "simulated sitting" preface is not shown. */

export type LeaderQa = {
  block: string;
  question: string;
  answer: string;
};

export type StripDoor = {
  label: string;
  to?: string;
};

export type SpecialistDoor = {
  id: string;
  name: string;
  boss: string;
  to: string;
};

export type TrianzLeader = {
  id: string;
  name: string;
  role: string;
  portfolio: string;
  qa: LeaderQa[];
  doors: StripDoor[];
};

export const SPECIALIST_DOORS: SpecialistDoor[] = [
  { id: "onboarding", name: "Onboarding", boss: "Rajesh", to: "/hr/operations/onboarding" },
  { id: "offboarding", name: "Offboarding", boss: "Rajesh", to: "/hr/operations/offboarding" },
  { id: "vendor", name: "Vendor", boss: "Rajesh", to: "/hr/operations/vendor-mgmt" },
  { id: "us-hr", name: "US HR", boss: "Rajesh", to: "/hr/operations/us-hr" },
  { id: "hrbp", name: "HRBP desk", boss: "Sanuj", to: "/hr/hrbp" },
];

const NO_SHEET: StripDoor = { label: "no specialist sheet on this walk" };

const BLOCKS = ["Mandate", "Priorities", "Time & motion", "Outcomes", "Constraints", "Forward view"] as const;

function qa(rows: readonly (readonly [string, string])[]): LeaderQa[] {
  return rows.map(([question, answer], i) => ({
    block: BLOCKS[i],
    question,
    answer,
  }));
}

export const TRIANZ_LEADERS: TrianzLeader[] = [
  {
    id: "raja",
    name: "Raja",
    role: "CHRO",
    portfolio:
      'Portfolio (per P&C Strategy, Nov 2025 — "Find, Keep & Grow the most stunning talent on earth"): owns all four functional pillars (TA & Mobility, HRBP, L&D, Comp Ben & HR Ops) plus four enabling foundations — Digital/Analytics/AI, Global Role Maturity Competency Model, globally scaled processes, and the Trianz Culture Code. Stated "way forward": density over volume (HR right-sized 83→54), AI-first DarwinBox, young talent infusion from MBA campuses, HR as full-stack specialists rather than administrators.',
    qa: qa([
      [
        "Of the four pillars and four enabling foundations, which one is most under-resourced relative to what it's accountable for right now?",
        "Functions are equally stretched.",
      ],
      [
        'The BHAG scorecard shows GTM Sales Leader Hiring still "in progress" while the other two goals closed. What\'s actually blocking that one, and whose decision is it waiting on?',
        "",
      ],
      [
        "Of your own week, how much goes to the four pillars' operating cadence versus CEO/CXO-facing strategic work versus firefighting that shouldn't require you?",
        "50% percent each.",
      ],
      [
        "The manpower variance shows (188) FTE and ($7.3M) cost reduction — how much of that was planned restructuring versus attrition you didn't backfill, and does the FY27 plan assume more of either?",
        "most of it was planned restructuring accounting for regular attritinos as well.",
      ],
      [
        '"HR right-sized 83→54" while taking on 8 new Q1 FY27 focus areas — what gets deprioritized if headcount doesn\'t grow with scope?',
        "There is a substantial improvement in the talent density of the HR function. While the numbers have come down, the quality of people that have come in has increased. Also, with David Box coming in, a lot of manual activities that were done have moved into tools and are getting done in an automated fashion.",
      ],
      [
        "If the AI-Native HRBP time & motion study (item 7) finds that HRBP/HR Ops time is misallocated, what decision rights do you have to actually reallocate it — versus needing CXO sign-off?",
        "Based on the time and motion study and the glide path towards the HRBP function, the composition of the team should look different from 83 to 54. It would come down, not from the numbers perspective, but also from the cost perspective.",
      ],
    ]),
    doors: [],
  },
  {
    id: "rajesh",
    name: "Rajesh",
    role: "Comp & Ben + HR Ops",
    portfolio:
      "Portfolio (per P&C org chart): pay structures, employee benefits, policies, compliance, and operational processes. Owns the DarwinBox platform, which is the operational backbone under this pillar.",
    qa: qa([
      [
        "With DarwinBox consolidating 11 modules to 1 and freeing ~80 hrs/week, where did that freed capacity actually go — redeployed to higher-value HR Ops work, absorbed as headcount reduction, or unaccounted for?",
        "Redistribution of work based on the freeing up and consolidation of various modules. Currently, the focus is on stabilizing the new work systems. After that, there will be redistribution and possible reduction in headcount",
      ],
      [
        "The $5.68M gross-to-net gap is described as merit/inflation + backfills + new hires — how much of that gap was foreseeable when the $10.28M target was set, and how much came from decisions made after?",
        "This was predicted because we had year-on-year attrition data. We also had tentative modeling done on the merit and inflation, backfills, and new hires. We had to put in some assumptions, but around 80% accuracy was there in our prediction.",
      ],
      [
        "Walk through a typical week: how much time is spent on compliance/policy administration that's purely rule-based versus judgment calls that need you specifically?",
        "It's 80/20.",
      ],
      [
        '"Further savings require structural, not incremental, moves" — what structural moves are actually on the table for FY27, and what\'s blocking them today?',
        "Recommendation from the AI-native HR function: after stabilizing the Darwin box, we see some structural movements happening, but only post these.",
      ],
      [
        "ADP US implementation and DarwinBox experience audit are both Q1 FY27 commitments on top of BAU comp/ben/compliance — what's the realistic capacity gap, and what's the single point of failure if this team loses someone?",
        "These are important. These are key changes that are happening in the administration of HR operations, both in the US and India. From a realistic capacity gaps standpoint, of course, it is a peak, and everybody is stretched, but it is well under control because program management support is being provided by the HRBP function. We don't see any reason for failure here.",
      ],
      [
        "If the AI-Native HRBP time & motion study finds low-value, high-volume tasks in HR Ops, which three would you automate first, and what's stopped that from happening already?",
        "Mapped out several functions, and I see a huge potential in automating several areas, right from offer desk to onboarding to offboarding to reporting to rewards. Recruiting operations are also coming, which we can automate.",
      ],
    ]),
    doors: [
      { label: "Offer Desk", to: "/scout/offer-desk" },
      { label: "Onboarding", to: "/hr/operations/onboarding" },
      { label: "Offboarding", to: "/hr/operations/offboarding" },
      { label: "Vendor", to: "/hr/operations/vendor-mgmt" },
      { label: "US HR", to: "/hr/operations/us-hr" },
    ],
  },
  {
    id: "sanuj",
    name: "Sanuj",
    role: "HRBP",
    portfolio:
      "Portfolio (per P&C org chart + your own role brief): strategic partnering aligning people initiatives with business goals, leaders, and the business — shared with Chantelle Dembowski (US/GTM People Architect). HRBP also owns Culture & Engagement (Hackathon, Kreeda, Recognition, IWD) — confirmed by you, even though it isn't a separate box on the org chart. In practice this has run: Spans & Layers optimization, the Role Maturity & Talent Density framework, the AI-Native SDLC restructuring with the CTO (8 PODs), the Engagement Charter, the Oracle→Darwinbox migration, and FY26 performance/goal-setting redesign.",
    qa: qa([
      [
        'Given HRBPs (you, Chantelle, Nithya, Kunal, Jayanthi) already sit inside the NHO Redesign program doing SME coordination, how much of "HRBP time" is actually L&D program delivery versus core business partnering?',
        "In key program design and implementation, I don't think so. There is too much time spent. NHO redesign is one part of it, but the way I look at it, the HR business partner gives lifecycle support and coverage support to leaders and spends a substantial time in designing and implementing key people programs.",
      ],
      [
        "The Role Maturity Framework hit 100% calibration adoption in FY26 — now that it's embedded, does it still need active HRBP stewardship, or can that time shift to GTM Assimilation and the new hire experience work?",
        "Yes, maturity adoption has increased, but the stickiness is something that needs to be driven. The language we want people managers, leaders, and HR business partners to use needs a little bit more widegloving and holding, but not a substantial amount of time that is required. GT explanation becomes important, new hire experience becomes important as well in new people programs, plus the Darwin box support that has also been handled at the HRBP function.",
      ],
      [
        "Of a typical week, what share goes to calibration/comp decisions that need your judgment specifically, versus coordination and status-chasing that a system or an AI agent could do?",
        "Currently, the way I see it is that it is aspirational for making the HR business function more strategic and the people programs-led, in addition to coverage. A lot of HR business partners at Pratibha, Kunal, Rajita, and Nitya levels (below HRBP Head, which is me) are still a lot about coordination, chasing, and operations.",
      ],
      [
        "Talent Mobility shows 1,139 validated demands but only 177 (15.5%) filled internally — from the HRBP seat, is that ratio a sourcing problem, a skills-match problem, or a demand-quality problem?",
        "The organization is going through a pivot and a huge transition from a services organization to a product organization, so internal fulfillment will be low, and that is intentional because the kind of talent that we wanted is a slightly different caliber.",
      ],
      [
        "The 90% critical-talent retention number carries one named regret (Solutions team cut too deep, scarcity under-weighted) — has that criteria fix actually been applied to the next round of workforce decisions, or does it still live only in the retro?",
        "yes it is a lesson learnt and will be remembered for next rounds.",
      ],
      [
        "If the AI-Native HRBP time & motion study confirms this function is over-indexed on coordination work, what would you personally stop doing first — and what's the CHRO conversation needed to make that stick?",
        "It's a CHRO conversation and alignment. The way I see it is that the nature of the team would be different, right? The coordination tasks would go away, and possibly there will be a few removals from the team and maybe a couple of additions because the nature of work has transformed fundamentally. AI-native work will start coming in, driving bots and automating a lot of processes, so the day-to-day demand from an operational standpoint for HR business partners will come down. They will be design architects. They will be outcome maximizers for the function. They talk the language of business, and they are more AI-native and tech-led.",
      ],
    ]),
    doors: [{ label: "HRBP desk", to: "/hr/hrbp" }],
  },
  {
    id: "chandana",
    name: "Chandana",
    role: "L&D",
    portfolio:
      "Portfolio (per P&C org chart): building employee capabilities, skills development, training programs, and career growth. The largest concrete program in evidence is the NHO (New Hire Onboarding) Redesign, a 6-week, 12-person cross-functional build (Apr 22–Jun 2, 2026) with Raja as Executive Sponsor and Chandana as Project Head — five components: Self-Paced Onboarding (5 core modules, India/USA localized), Bi-Weekly In-Person NHO (2-hour, 7-block agenda), Functional & Technical Tracks (6 business units, SME-discovery-driven), Senior Leaders Onboarding Experience (bespoke, owned by Chandana + Sanuj, reviewed by Raja), and Sales Track + Moodle LMS build (owned by Sumesh).",
    qa: qa([
      [
        'The NHO program has 12 named owners across L&D, HRBP, and a still-open Technical Enablement Specialist role ("TBH") — is that headcount gap on the critical path for anything currently due, and what\'s the plan if it isn\'t filled?',
        "we can manage this internally, not a deal breaker",
      ],
      [
        "With NHO 2.0, Propel Journeys, Platform eLearning, and PwC Workshop follow-through all active in the same quarter, which one would you protect if forced to cut two?",
        "i have to do all, non negotiable. platform elearning could be phased out a bit if essential.",
      ],
      [
        "Of your week, how much is content design and instructional strategy versus program-management overhead (tracking, SME scheduling, status reporting) that a coordinator or a tool could carry?",
        "50% each",
      ],
      [
        "Propel Journey is at week 3 of 8 with 184 learners — what's the leading indicator right now that tells you it will land, versus one that would tell you it's at risk?",
        "aherance to milestones",
      ],
      [
        "The Concierto Manage content backlog shows 6 of 11 courses done, 4 pending — what's actually holding up the remaining 4, and is that a content, SME-access, or platform (Moodle/DarwinBox integration) bottleneck?",
        "its the content and dependency wiht the business.",
      ],
      [
        "New Function Enablement (item 6) adds four more functions to deep-enable in Q1 FY27 on top of everything already running — what would need to be true (headcount, tooling, or scope cuts elsewhere) for that to be realistic rather than aspirational?",
        "all of them and business mindspace as well.",
      ],
    ]),
    doors: [NO_SHEET],
  },
  {
    id: "nagraj",
    name: "Nagraj",
    role: "TA & Mobility",
    portfolio:
      "Portfolio (per P&C org chart): recruiting, internal movements (redeployment and bench management), and workforce optimization — the one desk that owns both bringing people in from outside and moving people already inside to where the business needs them.",
    qa: qa([
      [
        "Your desk covers both new recruiting and internal redeployment. Of your total placement volume, what share is filled through internal mobility versus external hiring — and is that mix a deliberate target or a byproduct of the bench-clearing push?",
        "Internal is running about 15 to 20 percent of total placement volume. We pushed that up deliberately during the bench-clearing phase last year, but with the platform pivot, most of what's opening up now needs GTM or platform engineering skills the bench doesn't have yet. So external stays dominant — not because we want it that way, it's just where the skill is.",
      ],
      [
        '375 people were redeployed to billable roles and 207 were managed out in the same restructuring window — is there any overlap between those two groups, and does the "375" figure hold if some of those roles free up again this year?',
        "No overlap, those are two separate groups. The 375 is a point-in-time number though — some of those placements will cycle back onto the bench as project needs shift, so I'd treat it as something we refresh every quarter, not a number we bank permanently.",
      ],
      [
        "Now that your team itself is right-sized 7→3, what share of your team's week goes to running the demand-to-fulfillment pipeline (sourcing, screening, matching) versus internal mobility casework (identifying redeployable talent, negotiating placements)?",
        "It's roughly 65-35 — 65 on demand-to-fulfillment, sourcing, screening, matching, and 35 on mobility casework. Recruiting still eats the bigger share because platform roles are genuinely hard to fill off the bench.",
      ],
      [
        "1,139 demands were validated but only 177 (15.5%) were filled internally — from your seat, is that gap mostly a supply problem (not enough bench talent with the right skills), a demand problem (roles that should've gone external from the start), or a process/visibility problem?",
        "Mostly a skill-match problem, honestly. The bench still skews toward legacy IT-services profiles and the demand has moved to GTM and platform engineering. There's a smaller process piece too — not every hiring manager checks the bench before raising an external req.",
      ],
      [
        "with the team at 3 people covering recruiting, mobility, and workforce optimization together, what's the single point of failure if one more person leaves, and what's not getting done today because of the smaller team?",
        "If the person handling platform and tech sourcing is out, GTM assimilation hiring just stalls — there's no real backup on that skill line today. What's quietly slipping is proactive sourcing and pipeline-building; all three of us are fully consumed by reactive fulfillment.",
      ],
      [
        "with the shift to a 60–70% partner-led model reshaping what skills the business needs, how do you expect the sourcing/mobility mix to change in FY27, and does your team's current shape support that?",
        "I expect internal mobility's share to go up as delivery shifts partner-led — that should free up recruiting capacity. But we'll need either one more person or better bench-matching tooling to make that shift without losing quality. Three people is already stretched.",
      ],
    ]),
    doors: [NO_SHEET],
  },
];

export function leaderById(id: string | undefined): TrianzLeader | undefined {
  return TRIANZ_LEADERS.find((leader) => leader.id === id);
}

export function specialistById(id: string): SpecialistDoor {
  const door = SPECIALIST_DOORS.find((item) => item.id === id);
  if (!door) throw new Error(`Unknown specialist door: ${id}`);
  return door;
}
