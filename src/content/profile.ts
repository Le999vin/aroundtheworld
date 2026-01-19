export type SocialLink = {
  label: "GitHub" | "LinkedIn" | "Email" | "Dribbble";
  href: string;
};

export type Highlight = {
  title: string;
  description: string;
  icon: "Zap" | "Sparkles" | "Shield";
};

export type Skill = {
  name: string;
  level: "Expert" | "Advanced" | "Intermediate";
  category: "Frontend" | "Backend" | "Design" | "Tooling";
};

export type TimelineItem = {
  title: string;
  company: string;
  period: string;
  description: string;
};

export type ValueItem = {
  title: string;
  description: string;
};

export const profile = {
  name: "Levin Pamay",
  title: "Senior Next.js + TypeScript Engineer",
  location: "Zurich, CH",
  shortBio:
    "I design and build premium web experiences that feel fast, clear, and human.",
  longBio:
    "Senior frontend engineer focused on Next.js, TypeScript, and high-end UI. I partner with teams to ship production-grade interfaces, improve design systems, and deliver measurable UX wins without sacrificing performance.",
  email: "levinpamay08@gmail.com",
  social: [
    { label: "GitHub", href: "https://github.com/Le999vin" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/levin-pamay/" },
    { label: "Email", href: "mailto:levinpamay08@gmail.com" },
  ] as SocialLink[],
  highlights: [
    {
      title: "Speed obsessed",
      description: "Optimized bundles, smart rendering, and rapid delivery loops.",
      icon: "Zap",
    },
    {
      title: "UX first",
      description: "Clean hierarchy, intentional motion, and accessible flows.",
      icon: "Sparkles",
    },
    {
      title: "Reliable delivery",
      description: "Predictable releases with maintainable, typed code.",
      icon: "Shield",
    },
  ] as Highlight[],
  techStack: [
    "Next.js",
    "TypeScript",
    "React",
    "Tailwind CSS",
    "Framer Motion",
    "React Three Fiber",
    "Radix UI",
    "Vercel",
  ],
  skills: [
    { name: "Next.js", level: "Expert", category: "Frontend" },
    { name: "TypeScript", level: "Expert", category: "Frontend" },
    { name: "React", level: "Expert", category: "Frontend" },
    { name: "Tailwind CSS", level: "Advanced", category: "Frontend" },
    { name: "Node.js", level: "Advanced", category: "Backend" },
    { name: "Framer Motion", level: "Advanced", category: "Design" },
    { name: "React Three Fiber", level: "Intermediate", category: "Design" },
    { name: "Storybook", level: "Advanced", category: "Tooling" },
  ] as Skill[],
  timeline: [
    {
      title: "Senior Frontend Engineer",
      company: "Kite Labs",
      period: "2022 - Present",
      description:
        "Lead UI architecture for multi-tenant SaaS products, introduced design system governance, and improved Lighthouse scores by 20+ points.",
    },
    {
      title: "Frontend Engineer",
      company: "Studio North",
      period: "2019 - 2022",
      description:
        "Built marketing platforms and interactive product pages for global clients, partnering closely with design and brand teams.",
    },
    {
      title: "B.Sc. Media Informatics",
      company: "University of Hamburg",
      period: "2016 - 2019",
      description:
        "Focused on human-computer interaction, visual systems, and web engineering.",
    },
  ] as TimelineItem[],
  values: [
    {
      title: "Clarity over cleverness",
      description:
        "Interfaces should feel obvious. Clean structure beats overly complex UI patterns.",
    },
    {
      title: "Momentum matters",
      description:
        "Fast feedback loops and clear deliverables keep teams aligned and shipping.",
    },
    {
      title: "Human centered",
      description:
        "Accessibility and empathy are non-negotiable in every product I build.",
    },
  ] as ValueItem[],
};

export type Profile = typeof profile;

