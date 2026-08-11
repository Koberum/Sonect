import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  SelectableRow,
  SelectableRowDescription,
  SelectableRowTitle,
} from "@/components/ui/selectable-row";
import { toast } from "sonner";
import {
  scanWifi,
  connectWifi,
  type WifiNetwork,
} from "@/features/apis/systemApis";

interface NetworkStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function NetworkStep({ onNext, onSkip }: NetworkStepProps) {
  const { t } = useTranslation();
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const nets = await scanWifi();
        setNetworks(nets);
      } catch {
        // silent
      }
    };
    load();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanWifi();
      setNetworks(result);
    } catch {
      toast.error(t("settings.network.scanError"));
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedSsid) return;
    setConnecting(true);
    try {
      const result = await connectWifi(selectedSsid, password || undefined);
      if (result.success) {
        toast.success(t("settings.network.connected", { ssid: selectedSsid }));
        onNext();
      } else {
        toast.error(result.error ?? t("settings.network.connectError"));
      }
    } catch {
      toast.error(t("settings.network.connectError"));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{t("settings.network.title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("settings.network.description")}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-medium">
          <Wifi className="h-4 w-4" />
          {t("settings.network.networks")}
        </h4>
        <Button
          onClick={handleScan}
          disabled={scanning}
          size="sm"
          variant="outline"
        >
          <Loader2
            className={`mr-2 h-4 w-4 ${scanning ? "animate-spin" : ""}`}
          />
          {scanning
            ? t("settings.network.scanning")
            : t("settings.network.scan")}
        </Button>
      </div>

      {networks.length > 0 && (
        <div className="space-y-2">
          {networks.map((net) => (
            <SelectableRow
              key={net.ssid}
              asChild
              className={selectedSsid === net.ssid ? "border-primary" : ""}
            >
              <label>
                <input
                  type="radio"
                  name="wizard-wifi"
                  value={net.ssid}
                  checked={selectedSsid === net.ssid}
                  onChange={() => {
                    setSelectedSsid(net.ssid);
                    setPassword("");
                  }}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <SelectableRowTitle>{net.ssid}</SelectableRowTitle>
                  <SelectableRowDescription className="text-xs">
                    {t("settings.network.signal")}: {net.signal}%
                  </SelectableRowDescription>
                </div>
                {net.secured && (
                  <Badge variant="secondary">
                    {t("settings.network.secured")}
                  </Badge>
                )}
              </label>
            </SelectableRow>
          ))}
        </div>
      )}

      {networks.length === 0 && !scanning && (
        <p className="text-muted-foreground text-center text-sm">
          {t(
            "setup.network.noNetworks",
            "No networks found. Scan again or skip.",
          )}
        </p>
      )}

      {selectedSsid && (
        <div className="space-y-2">
          <label className="text-muted-foreground block text-sm font-medium">
            {t("settings.network.password")}
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("settings.network.passwordPlaceholder")}
          />
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip}>
          {t("common.skip", "Skip")}
        </Button>
        <Button onClick={handleConnect} disabled={!selectedSsid || connecting}>
          {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {connecting
            ? t("settings.network.connecting")
            : t("setup.network.connectAndContinue", "Connect & Continue")}
        </Button>
      </div>
    </div>
  );
}
