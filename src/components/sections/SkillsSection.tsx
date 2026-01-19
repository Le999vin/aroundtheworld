import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/layout/Container";
import { profile } from "@/content/profile";
import { fadeInUp } from "@/lib/motion";

import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

export function SkillsSection() {
  const grouped = profile.skills.reduce<Record<string, typeof profile.skills>>(
    (acc, skill) => {
      acc[skill.category] = acc[skill.category] || [];
      acc[skill.category].push(skill);
      return acc;
    },
    {}
  );

  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="space-y-10">
          <Reveal variants={fadeInUp}>
            <SectionHeading
              eyebrow="Skills"
              title="Crafted for modern product teams"
              description="A balance of engineering rigor, design sensibility, and system thinking."
            />
          </Reveal>
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries(grouped).map(([category, skills], index) => (
              <Reveal key={category} variants={fadeInUp} delay={index * 0.1}>
                <div className="glass-card p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {category}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {skills.map((skill) => (
                      <Badge
                        key={skill.name}
                        variant="secondary"
                        className="flex items-center gap-2 px-3 py-1.5"
                      >
                        {skill.name}
                        <span className="text-xs text-muted-foreground">
                          {skill.level}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

