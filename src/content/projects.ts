export type ProjectLink = {
  github?: string;
  live?: string;
};

export type ProjectSection = {
  title: string;
  body: string[];
};

export type Project = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  role: string;
  tech: string[];
  links: ProjectLink;
  date: string;
  highlights: string[];
  contentSections: ProjectSection[];
  coverImage: string;
  gallery?: string[];
  featured?: boolean;
};

export const projects: Project[] = [
  {
    slug: "aether-finance",
    title: "Aether Finance Dashboard",
    description:
      "A modular fintech dashboard that turns complex portfolio data into clear, actionable insights.",
    tags: ["SaaS", "Fintech", "Dashboard"],
    role: "Lead Frontend Engineer",
    tech: ["Next.js", "TypeScript", "Tailwind CSS", "Framer Motion"],
    links: {
      github: "https://github.com/lucapalma/aether-finance",
      live: "https://aether-finance.example.com",
    },
    date: "2024-10-12",
    highlights: [
      "Reduced initial load time by 38% through route-level code splitting.",
      "Built a reusable charting system with accessible keyboard navigation.",
      "Introduced a motion system aligned with product risk states.",
    ],
    contentSections: [
      {
        title: "Problem",
        body: [
          "Portfolio managers struggled to understand risk exposure quickly.",
          "Legacy UI hid critical metrics behind dense tables.",
        ],
      },
      {
        title: "Solution",
        body: [
          "Designed a layout that prioritizes key metrics and drill-down flows.",
          "Implemented a composable card system for rapid feature launches.",
        ],
      },
      {
        title: "Tech",
        body: [
          "Next.js App Router with streamed data loading.",
          "Typed UI tokens and reusable motion variants.",
        ],
      },
      {
        title: "Features",
        body: [
          "Scenario comparison with inline deltas.",
          "Guided insights panel with priority scoring.",
          "Export-ready reporting view.",
        ],
      },
      {
        title: "Learnings",
        body: [
          "Micro-interactions improve comprehension when they reinforce hierarchy.",
          "Performance budgets are essential for data-dense interfaces.",
        ],
      },
    ],
    coverImage: "/projects/aether-finance.svg",
    gallery: ["/projects/aether-finance.svg"],
    featured: true,
  },
  {
    slug: "nordic-trails",
    title: "Nordic Trails Booking",
    description:
      "A premium booking experience for adventure travel, focused on trust and conversion.",
    tags: ["Booking", "E-commerce", "B2C"],
    role: "Senior Frontend Engineer",
    tech: ["Next.js", "TypeScript", "Tailwind CSS", "Radix UI"],
    links: {
      github: "https://github.com/lucapalma/nordic-trails",
      live: "https://nordic-trails.example.com",
    },
    date: "2024-07-05",
    highlights: [
      "Raised checkout conversion by 18% with a simplified flow.",
      "Built a dynamic itinerary builder with instant feedback.",
      "Implemented accessible tabs and accordions for trip details.",
    ],
    contentSections: [
      {
        title: "Problem",
        body: [
          "Trip details were fragmented across multiple pages.",
          "Users dropped off during the multi-step checkout.",
        ],
      },
      {
        title: "Solution",
        body: [
          "Unified trip details into a single, scannable layout.",
          "Introduced progress-based checkout with clear pricing visibility.",
        ],
      },
      {
        title: "Tech",
        body: [
          "Component-driven UI with shadcn and Radix primitives.",
          "Optimized images and lazy-loaded itinerary media.",
        ],
      },
      {
        title: "Features",
        body: [
          "Flexible date selection with intelligent defaults.",
          "Transparent pricing breakdown and add-on options.",
          "Localized content blocks for regional offers.",
        ],
      },
      {
        title: "Learnings",
        body: [
          "Trust signals need to appear before pricing decisions.",
          "Shorter forms outperform modal-heavy flows on mobile.",
        ],
      },
    ],
    coverImage: "/projects/nordic-trails.svg",
    gallery: ["/projects/nordic-trails.svg"],
    featured: true,
  },
  {
    slug: "pulse-analytics",
    title: "Pulse Analytics Platform",
    description:
      "A real-time analytics workspace for growth teams with live KPIs and alerts.",
    tags: ["Analytics", "SaaS", "Product"],
    role: "Frontend Engineer",
    tech: ["Next.js", "TypeScript", "Framer Motion", "TanStack Query"],
    links: {
      github: "https://github.com/lucapalma/pulse-analytics",
      live: "https://pulse-analytics.example.com",
    },
    date: "2024-03-18",
    highlights: [
      "Streamed live KPI updates without layout shifts.",
      "Designed a flexible notification system with severity tiers.",
      "Improved onboarding completion by 26%.",
    ],
    contentSections: [
      {
        title: "Problem",
        body: [
          "Teams lacked clarity on which KPIs needed attention.",
          "Alerting felt noisy and led to dashboard fatigue.",
        ],
      },
      {
        title: "Solution",
        body: [
          "Introduced signal-to-noise scoring with visual emphasis.",
          "Created modular dashboards that adapt to team roles.",
        ],
      },
      {
        title: "Tech",
        body: [
          "Incremental rendering for data-dense views.",
          "Centralized animation presets for consistency.",
        ],
      },
      {
        title: "Features",
        body: [
          "Real-time KPI streaming and sparkline summaries.",
          "Alert routing based on urgency and ownership.",
          "Quick filters for teams, segments, and regions.",
        ],
      },
      {
        title: "Learnings",
        body: [
          "Clear defaults outperform heavy customization at launch.",
          "Teams adopt dashboards faster when alerts feel curated.",
        ],
      },
    ],
    coverImage: "/projects/pulse-analytics.svg",
    gallery: ["/projects/pulse-analytics.svg"],
    featured: true,
  },
  {
    slug: "studio-forma",
    title: "Studio Forma Portfolio",
    description:
      "An editorial portfolio for a design studio with immersive storytelling and WebGL accents.",
    tags: ["Brand", "Marketing", "WebGL"],
    role: "UI Engineer",
    tech: ["Next.js", "TypeScript", "React Three Fiber", "GSAP"],
    links: {
      github: "https://github.com/lucapalma/studio-forma",
      live: "https://studio-forma.example.com",
    },
    date: "2023-11-20",
    highlights: [
      "Delivered a cinematic case study experience with smooth transitions.",
      "Built a lightweight WebGL scene under 1MB.",
      "Crafted typography-first layouts for editorial impact.",
    ],
    contentSections: [
      {
        title: "Problem",
        body: [
          "The studio needed a fresh narrative that matched their premium brand.",
          "Previous site failed to showcase process and results.",
        ],
      },
      {
        title: "Solution",
        body: [
          "Designed a scroll-based story with cinematic pacing.",
          "Paired WebGL accents with glass UI layers.",
        ],
      },
      {
        title: "Tech",
        body: [
          "Dynamic imports for WebGL and motion layers.",
          "Optimized image pipeline and font loading.",
        ],
      },
      {
        title: "Features",
        body: [
          "Narrative case study layout with sticky highlights.",
          "Interactive gallery with keyboard navigation.",
          "Motion cues tuned to brand tone.",
        ],
      },
      {
        title: "Learnings",
        body: [
          "Subtle 3D details can elevate without overwhelming.",
          "Editorial spacing boosts readability and perceived quality.",
        ],
      },
    ],
    coverImage: "/projects/studio-forma.svg",
    gallery: ["/projects/studio-forma.svg"],
    featured: false,
  },
];

export const projectTags = Array.from(
  new Set(projects.flatMap((project) => project.tags))
).sort();

