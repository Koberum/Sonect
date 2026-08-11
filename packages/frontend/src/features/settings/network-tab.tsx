import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Wifi } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  SelectableRow,
  SelectableRowDescription,
  SelectableRowTitle,
} from "@/components/ui/selectable-row";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  scanWifi,
  connectWifi,
  disconnectWifi,
  getNetworkStatus,
  type WifiNetwork,
} from "@/features/apis/systemApis";

export function NetworkTab() {
  const { t } = useTranslation();
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [selectedSsid, setSelectedSsid] = useState("");
  const [password, setPassword] = useState("");
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    ssid?: string;
    interface?: string;
    ip?: string;
    netmask?: string;
    gateway?: string;
    dns?: string[];
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const netStatus = await getNetworkStatus();
        setStatus(netStatus);
      } catch {
        // silent
      }
      try {
        const nets = await scanWifi();
        setNetworks(nets);
      } catch {
        // silent — scan may fail if nmcli not available
      }
      setFetching(false);
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
        setStatus({ connected: true, ssid: selectedSsid });
        setConnectDialogOpen(false);
      } else {
        toast.error(result.error ?? t("settings.network.connectError"));
      }
    } catch {
      toast.error(t("settings.network.connectError"));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWifi();
      toast.success(t("settings.network.disconnected"));
      setStatus({ connected: false });
      setDisconnectDialogOpen(false);
    } catch {
      toast.error(t("settings.network.disconnectError"));
    }
  };

  const openConnectDialog = (ssid: string) => {
    setSelectedSsid(ssid);
    setPassword("");
    setConnectDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.network.title")}</CardTitle>
        <CardDescription>{t("settings.network.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            {status && (
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">
                  {status.connected
                    ? t("settings.network.statusConnected", {
                        ssid: status.ssid ?? "",
                      })
                    : t("settings.network.statusDisconnected")}
                </div>
                {status.connected && (
                  <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                    {status.interface && (
                      <div>
                        {t("settings.network.interface")}: {status.interface}
                      </div>
                    )}
                    {status.ip && (
                      <div>
                        {t("settings.network.ipAddress")}: {status.ip}
                      </div>
                    )}
                    {status.netmask && (
                      <div>
                        {t("settings.network.netmask")}: {status.netmask}
                      </div>
                    )}
                    {status.gateway && (
                      <div>
                        {t("settings.network.gateway")}: {status.gateway}
                      </div>
                    )}
                    {status.dns && status.dns.length > 0 && (
                      <div>
                        {t("settings.network.dns")}: {status.dns.join(", ")}
                      </div>
                    )}
                  </div>
                )}
                {status.connected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisconnectDialogOpen(true)}
                    className="mt-2"
                  >
                    {t("settings.network.disconnect")}
                  </Button>
                )}
              </div>
            )}

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
                    onClick={() => openConnectDialog(net.ssid)}
                  >
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
                  </SelectableRow>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedSsid}</DialogTitle>
            <DialogDescription>
              {t("settings.network.passwordPlaceholder")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="wifi-password">
              {t("settings.network.password")}
            </Label>
            <Input
              id="wifi-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("settings.network.passwordPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConnectDialogOpen(false)}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {connecting
                ? t("settings.network.connecting")
                : t("settings.network.connect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.network.disconnectTitle", "Disconnect WiFi?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.network.disconnectConfirm", {
                ssid: status?.ssid ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("settings.network.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
