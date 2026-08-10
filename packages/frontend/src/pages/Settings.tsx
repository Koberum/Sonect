import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioTab } from "@/features/settings/audio-tab";
import { NetworkTab } from "@/features/settings/network-tab";
import { LibrariesTab } from "@/features/settings/libraries-tab";
import { MpdConfigTab } from "@/features/settings/mpd-config-tab";
import { DebugTab } from "@/features/settings/debug-tab";
import { PageTitle } from "@/features/dashboard/components/pageTitle";

export function Settings() {
  const { t } = useTranslation();

  return (
    <div>
      <PageTitle
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <Tabs defaultValue="audio" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="audio">{t("settings.tabs.audio")}</TabsTrigger>
          <TabsTrigger value="network">
            {t("settings.tabs.network")}
          </TabsTrigger>
          <TabsTrigger value="libraries">
            {t("settings.tabs.libraries")}
          </TabsTrigger>
          <TabsTrigger value="config">{t("settings.tabs.config")}</TabsTrigger>
          <TabsTrigger value="debug">{t("settings.tabs.debug")}</TabsTrigger>
        </TabsList>

        <TabsContent value="audio">
          <AudioTab />
        </TabsContent>
        <TabsContent value="network">
          <NetworkTab />
        </TabsContent>
        <TabsContent value="libraries">
          <LibrariesTab />
        </TabsContent>
        <TabsContent value="config">
          <MpdConfigTab />
        </TabsContent>
        <TabsContent value="debug">
          <DebugTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
