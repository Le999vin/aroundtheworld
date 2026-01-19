import type { Metadata } from "next";

import { Highlights } from "@/components/sections/Highlights";
import { Hero } from "@/components/sections/Hero";
import { ProjectsPreview } from "@/components/sections/ProjectsPreview";
import { TechStack } from "@/components/sections/TechStack";
import { profile } from "@/content/profile";

export const metadata: Metadata = {
  title: "Home",
  description: profile.shortBio,
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Highlights />
      <ProjectsPreview />
      <TechStack />
    </>
  );
}

