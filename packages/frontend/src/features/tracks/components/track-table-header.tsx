import { useTranslation } from "react-i18next";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function TrackTableHeader() {
  const { t } = useTranslation();

  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-10 text-center">
          {t("album.trackNumber")}
        </TableHead>
        <TableHead>{t("album.title")}</TableHead>
        <TableHead className="w-14 text-right sm:w-20">
          {t("album.duration")}
        </TableHead>
        <TableHead className="w-10" />
      </TableRow>
    </TableHeader>
  );
}
