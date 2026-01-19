import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/sections/Reveal";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { SkillsSection } from "@/components/sections/SkillsSection";
import { TimelineSection } from "@/components/sections/TimelineSection";
import { ValuesSection } from "@/components/sections/ValuesSection";
import { profile } from "@/content/profile";
import { fadeInUp } from "@/lib/motion";

export const metadata: Metadata = {
  title: "About",
  description: profile.longBio,
};

export default function AboutPage() {
  return (
    <>
      <section className="py-16 sm:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <Reveal variants={fadeInUp}>
                <SectionHeading
                  eyebrow="About"
                  title={`Designing and building with ${profile.name}`}
                  description={profile.longBio}
                />
              </Reveal>
              <Reveal variants={fadeInUp}>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="secondary">{profile.location}</Badge>
                  <Badge variant="secondary">Remote friendly</Badge>
                  <Badge variant="secondary">Product focused</Badge>
                </div>
              </Reveal>
              <Reveal variants={fadeInUp}>
                <Button asChild size="lg">
                  <Link href="/contact">Start a project</Link>
                </Button>
              </Reveal>
            </div>
            <Reveal variants={fadeInUp}>
              <div className="glass-card p-6">
                <p className="text-sm text-muted-foreground">
                  {profile.shortBio}
                </p>
                <div className="mt-6 grid gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Focus</span>
                    <span>UI systems, Web apps, Motion</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Availability</span>
                    <span>Q2 2026</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Timezone</span>
                    <span>CET</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>
      <SkillsSection />
      <TimelineSection />
      <ValuesSection />
    </>
  );
}

