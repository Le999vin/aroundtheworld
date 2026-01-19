"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { Reveal } from "@/components/sections/Reveal";
import { projects, projectTags } from "@/content/projects";
import { fadeInUp } from "@/lib/motion";

import { ProjectCard } from "./ProjectCard";
import { ProjectFilter, type SortOption } from "./ProjectFilter";

export function ProjectsView() {
  const [selectedTag, setSelectedTag] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const tags = ["All", ...projectTags];

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    let results = projects.filter((project) => {
      const matchesTag =
        selectedTag === "All" || project.tags.includes(selectedTag);
      const matchesQuery =
        !query ||
        project.title.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.tags.some((tag) => tag.toLowerCase().includes(query));
      return matchesTag && matchesQuery;
    });

    if (sort === "alphabetical") {
      results = [...results].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      results = [...results].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    return results;
  }, [selectedTag, search, sort]);

  return (
    <div className="space-y-10">
      <Reveal variants={fadeInUp}>
        <SectionHeading
          eyebrow="Projects"
          title="Case studies and product work"
          description="Explore recent projects, filter by focus areas, or search for specific stacks."
        />
      </Reveal>
      <Reveal variants={fadeInUp}>
        <ProjectFilter
          tags={tags}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
        />
      </Reveal>
      {filteredProjects.length === 0 ? (
        <Card className="glass-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No projects match your search yet. Try a different tag or keyword.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

