import { MenuIcon } from "lucide-react";

export default function SidebarToggler({
  isOpen,
  toggleSidebar,
}: {
  isOpen: boolean;
  toggleSidebar: (open: boolean) => void;
}) {
  return (
    <button
      onClick={() => toggleSidebar(!isOpen)}
      className="text-muted-foreground hover:text-foreground cursor-pointer rounded-md p-2"
    >
      <MenuIcon className="h-5 w-5" />
    </button>
  );
}
