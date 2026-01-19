"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navigation } from "@/lib/navigation";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

import { Container } from "./Container";
import { ThemeToggle } from "./ThemeToggle";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export function Header() {
  const pathname = usePathname();
  const trimmedName = siteConfig.name.trim();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <Container className="flex h-16 items-center gap-4">
        <Link href="/" className="shrink-0 text-sm font-semibold uppercase tracking-[0.2em] text-foreground transition-colors hover:text-cyan-400">
          Portfolio
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex" aria-label="Primary">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "border-b-2 border-transparent pb-1 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Button asChild className="hidden md:inline-flex">
            <Link href="/contact">Contact</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col gap-6 pt-6">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {trimmedName || "Portfolio"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {siteConfig.title}
                  </p>
                </div>
                <nav className="flex flex-col gap-3" aria-label="Mobile">
                  {navigation.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "rounded-lg px-2 py-1 text-sm font-medium transition-colors",
                          active
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
                <Button asChild>
                  <Link href="/contact">Contact</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  );
}

