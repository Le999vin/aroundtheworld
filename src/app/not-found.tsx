import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="py-24">
      <Container>
        <div className="glass-card mx-auto max-w-xl p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            404
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">
            This page is not available
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The page you are looking for moved or does not exist.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}

