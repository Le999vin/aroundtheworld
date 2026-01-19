import { Card } from "@/components/ui/card";
import { Container } from "@/components/layout/Container";
import { profile } from "@/content/profile";
import { fadeInUp } from "@/lib/motion";

import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

export function ValuesSection() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="space-y-10">
          <Reveal variants={fadeInUp}>
            <SectionHeading
              eyebrow="Values"
              title="How I like to work"
              description="Clear communication, steady momentum, and thoughtful craftsmanship."
            />
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {profile.values.map((value, index) => (
              <Reveal key={value.title} variants={fadeInUp} delay={index * 0.1}>
                <Card className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    {value.title}
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {value.description}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

