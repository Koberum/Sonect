import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioTab } from "@/features/settings/audio-tab";
import { PlaybackTab } from "@/features/settings/playback-tab";
import { LibrariesTab } from "@/features/settings/libraries-tab";
import { AppearanceTab } from "@/features/settings/appearance-tab";
import { DebugTab } from "@/features/settings/debug-tab";
import { PageHeader } from "@/components/ui/page-header";

export function Settings() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <Tabs defaultValue="audio">
        <TabsList className="mb-4 max-w-full overflow-x-auto">
          <TabsTrigger value="audio">{t("settings.tabs.audio")}</TabsTrigger>
          <TabsTrigger value="playback">
            {t("settings.tabs.playback")}
          </TabsTrigger>
          <TabsTrigger value="libraries">
            {t("settings.tabs.libraries")}
          </TabsTrigger>
          <TabsTrigger value="appearance">
            {t("settings.tabs.appearance")}
          </TabsTrigger>
          <TabsTrigger value="debug">{t("settings.tabs.debug")}</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
