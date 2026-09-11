import type { ReactElement } from "react";

import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatLongDate } from "@/utils/date";

/**
 * A category of updates published for one benchmark date.
 *
 * @property category - Category heading shown for the updates.
 * @property items - Update descriptions in source order.
 */
export interface BenchmarkChangelogSection {
  category: string;
  items: readonly string[];
}

/**
 * All updates published for one benchmark date.
 *
 * @property date - Source date for the entry.
 * @property sections - Categorized updates for the date.
 */
export interface BenchmarkChangelogEntry {
  date: string;
  sections: readonly BenchmarkChangelogSection[];
}

/**
 * Changelog entries in newest-first order.
 */
export type BenchmarkChangelog = readonly BenchmarkChangelogEntry[];

/**
 * Properties for the shared benchmark changelog metadata and Sheet.
 *
 * @property changelog - Optional newest-first changelog data; no metadata is rendered when absent.
 */
export interface BenchmarkChangelogProps {
  changelog?: BenchmarkChangelog;
}

/**
 * Displays the latest benchmark update and the complete changelog history.
 *
 * The metadata row is intentionally absent while data is unavailable or the
 * newest entry has an invalid date. The changelog is presented in its source
 * order without flattening dates, categories, or individual updates.
 *
 * @param props - Changelog data already loaded by the owning query layer.
 * @returns The metadata row and right-side history Sheet, or `null` when the
 *   latest changelog date cannot be displayed.
 */
export const BenchmarkChangelog = ({
  changelog,
}: BenchmarkChangelogProps): ReactElement | null => {
  const latestEntry = changelog?.[0];
  const latestDate = latestEntry ? formatLongDate(latestEntry.date) : null;

  if (!latestDate || !changelog) {
    return null;
  }

  return (
    <Sheet>
      <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-1.5 text-xs">
        <span>Updated {latestDate}</span>
        <span aria-hidden="true">·</span>
        <SheetTrigger
          className="hover:text-foreground focus-visible:ring-ring rounded-sm px-0.5 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          type="button"
        >
          changelog
        </SheetTrigger>
      </div>

      <SheetContent className="w-[min(100%,28rem)]" side="right">
        <SheetHeader className="border-border border-b px-6 py-5">
          <SheetTitle>Changelog</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
          <div className="flex flex-col gap-8 pt-6">
            {changelog.map((entry, entryIndex) => {
              const entryKey = `${entry.date}-${entryIndex}`;

              return (
                <div className="flex flex-col gap-8" key={entryKey}>
                  {entryIndex > 0 ? (
                    <Separator className="bg-border/60" />
                  ) : null}
                  <article className="flex flex-col gap-4">
                    <h3 className="text-foreground text-base font-semibold tracking-tight">
                      {formatLongDate(entry.date) ?? entry.date}
                    </h3>

                    <div className="flex flex-col gap-4">
                      {entry.sections.map((section, sectionIndex) => (
                        <section
                          className="flex flex-col gap-2"
                          key={`${section.category}-${sectionIndex}`}
                        >
                          <h4 className="text-foreground text-sm font-medium">
                            {section.category}
                          </h4>
                          <ul className="text-muted-foreground marker:text-muted-foreground flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6">
                            {section.items.map((item, itemIndex) => (
                              <li key={`${item}-${itemIndex}`}>{item}</li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
