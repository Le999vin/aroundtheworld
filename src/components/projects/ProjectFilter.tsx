"use client";

import { Search, SortAsc } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SortOption = "newest" | "alphabetical";

type ProjectFilterProps = {
  tags: string[];
  selectedTag: string;
  onTagChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
};

export function ProjectFilter({
  tags,
  selectedTag,
  onTagChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: ProjectFilterProps) {
  return (
    <div className="space-y-4">
      <Tabs value={selectedTag} onValueChange={onTagChange}>
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          {tags.map((tag) => (
            <TabsTrigger
              key={tag}
              value={tag}
              className="rounded-full border border-border/60 px-4 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {tag}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search projects"
            className="pl-9"
            aria-label="Search projects"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SortAsc className="h-4 w-4" />
              Sort: {sort === "newest" ? "Newest" : "Alphabetical"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSortChange("newest")}>
              Newest first
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange("alphabetical")}>
              Alphabetical
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

