import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Bug,
  Library,
  Palette,
  Play,
  Volume2,
  type LucideProps,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AudioTab } from "@/features/settings/audio-tab";
import { PlaybackTab } from "@/features/settings/playback-tab";
import { LibrariesTab } from "@/features/settings/libraries-tab";
import { AppearanceTab } from "@/features/settings/appearance-tab";
import { DebugTab } from "@/features/settings/debug-tab";
import { PageHeader } from "@/components/ui/page-header";

const SECTIONS = [
  { value: "audio", icon: Volume2, labelKey: "settings.tabs.audio" },
  { value: "playback", icon: Play, labelKey: "settings.tabs.playback" },
  { value: "libraries", icon: Library, labelKey: "settings.tabs.libraries" },
  {
    value: "appearance",
    icon: Palette,
    labelKey: "settings.tabs.appearance",
  },
  { value: "debug", icon: Bug, labelKey: "settings.tabs.debug" },
] as const satisfies ReadonlyArray<{
  value: string;
  icon: ComponentType<LucideProps>;
  labelKey: string;
}>;

type SettingsSection = (typeof SECTIONS)[number]["value"];

function isSettingsSection(value: string | null): value is SettingsSection {
  return SECTIONS.some((section) => section.value === value);
}

export function Settings() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const sectionParam = searchParams.get("section");
  const activeSection: SettingsSection = isSettingsSection(sectionParam)
    ? sectionParam
    : "audio";

  const handleSectionChange = (value: string) => {
    if (!isSettingsSection(value)) return;
    const next = new URLSearchParams(searchParams);
    next.set("section", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <Tabs
        value={activeSection}
        onValueChange={handleSectionChange}
        orientation="vertical"
        className="block"
      >
        <div className="mb-4 lg:hidden">
          <Label htmlFor="settings-section" className="sr-only">
            {t("settings.sectionLabel")}
          </Label>
          <Select value={activeSection} onValueChange={handleSectionChange}>
            <SelectTrigger id="settings-section" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SECTIONS.map(({ value, icon: Icon, labelKey }) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      <Icon className="size-4" />
                      {t(labelKey)}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <TabsList
            variant="line"
            className="hidden h-fit w-full flex-col items-stretch border-r pr-2 lg:sticky lg:top-0 lg:flex lg:self-start"
          >
            {SECTIONS.map(({ value, icon: Icon, labelKey }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-9 flex-none justify-start gap-2 px-2"
              >
                <Icon className="size-4" />
                <span>{t(labelKey)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-w-0">
            <TabsContent value="audio">
              <AudioTab />
            </TabsContent>
            <TabsContent value="playback">
              <PlaybackTab />
            </TabsContent>
            <TabsContent value="libraries">
              <LibrariesTab />
            </TabsContent>
            <TabsContent value="appearance">
              <AppearanceTab />
            </TabsContent>
            <TabsContent value="debug">
              <DebugTab />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
