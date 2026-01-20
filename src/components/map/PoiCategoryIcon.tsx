import type { PlaceCategory } from "@/lib/types";

type PoiCategoryIconProps = {
  category: PlaceCategory;
  active?: boolean;
  className?: string;
};

const iconPaths: Record<PlaceCategory, JSX.Element> = {
  landmarks: (
    <path d="M12 2.5l2.7 5.6 6.2.9-4.5 4.4 1.1 6.2L12 17.5l-5.5 3 1.1-6.2L3.1 9l6.2-.9L12 2.5z" />
  ),
  museums: (
    <>
      <path d="M4 20h16" />
      <path d="M6 20V9l6-3 6 3v11" />
      <path d="M9 20V11" />
      <path d="M12 20V11" />
      <path d="M15 20V11" />
    </>
  ),
  food: (
    <>
      <path d="M6 3v8" />
      <path d="M10 3v8" />
      <path d="M6 7h4" />
      <path d="M16 3v18" />
    </>
  ),
  nightlife: (
    <path d="M21 12.5A8.5 8.5 0 1 1 11.5 3a7 7 0 0 0 9.5 9.5z" />
  ),
  nature: (
    <>
      <path d="M5 21c7-1 12-6 14-14-8 1-12 5-14 14z" />
      <path d="M5 21c0-4 3-8 7-10" />
    </>
  ),
  other: <circle cx="12" cy="12" r="4" />,
};

export const PoiCategoryIcon = ({
  category,
  active = false,
  className,
}: PoiCategoryIconProps) => {
  const strokeWidth = active ? 2.2 : 1.8;
  const resolvedClassName = `h-4 w-4${className ? ` ${className}` : ""}`;
  return (
    <svg
      viewBox="0 0 24 24"
      className={resolvedClassName}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[category] ?? iconPaths.other}
    </svg>
  );
};

export default PoiCategoryIcon;
