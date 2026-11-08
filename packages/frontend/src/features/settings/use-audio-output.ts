import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { systemMutations, systemQueries } from "@/features/system/queries";

interface UseAudioOutputOptions {
  onConfigured?: () => void;
}

/**
 * Device listing, selection and apply flow shared by Settings → Audio and the
 * setup wizard. The current output is selected until the user picks another.
 */
export function useAudioOutput({ onConfigured }: UseAudioOutputOptions = {}) {
  const { t } = useTranslation();
  const devicesQuery = useQuery(systemQueries.audioDevices());
  const { data: devices = [] } = devicesQuery;
  const { data: audioStatus } = useQuery(systemQueries.audioStatus());
  const [selected, setSelected] = useState("");
  const userSelected = useRef(false);
  const configureMut = useMutation(systemMutations.configureAudio());

  useEffect(() => {
    if (userSelected.current || !audioStatus) return;
    const matched = devices.find((device) => device.card === audioStatus.card);
    if (matched) setSelected(matched.card);
  }, [audioStatus, devices]);

  useEffect(() => {
    if (selected && !devices.some((device) => device.card === selected)) {
      userSelected.current = false;
      setSelected("");
    }
  }, [devices, selected]);

  const select = (card: string) => {
    userSelected.current = true;
    setSelected(card);
  };

  const apply = async () => {
    if (!selected) return;
    try {
      const device = devices.find((item) => item.card === selected);
      const result = await configureMut.mutateAsync({
        card: selected,
        name: device?.name ?? "Audio Output",
      });
      if (result.success) {
        toast.success(t("settings.audio.configured"));
        if (result.warning) toast.warning(result.warning);
        onConfigured?.();
      } else {
        toast.error(result.warning ?? t("settings.audio.configureError"));
      }
    } catch {
      toast.error(t("settings.audio.configureError"));
    }
  };

  return {
    devices,
    audioStatus,
    selected,
    select,
    apply,
    loading: configureMut.isPending,
    isPending: devicesQuery.isPending,
    isError: devicesQuery.isError,
    refetch: devicesQuery.refetch,
  };
}
