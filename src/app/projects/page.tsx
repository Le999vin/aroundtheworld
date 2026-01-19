import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";
import { ProjectsView } from "@/components/projects/ProjectsView";
import { profile } from "@/content/profile";

export const metadata: Metadata = {
  title: "Projects",
  description: `Selected product work by ${profile.name}.`,
};

export default function ProjectsPage() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <ProjectsView />
      </Container>
    </section>
  );
}

