import { ListenerShell } from "@/client/components/shell/listener-shell";

export default function ListenerLayout({ children }: LayoutProps<"/">) {
  return <ListenerShell>{children}</ListenerShell>;
}
