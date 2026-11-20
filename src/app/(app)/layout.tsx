import { AppShell } from "@/components/app-shell";
import { wajibLogin } from "@/lib/auth";

// Semua halaman di dalam folder (app) wajib login. Folder berkurung "(app)"
// tidak muncul di URL; ia hanya mengelompokkan halaman yang memakai layout ini.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const pengguna = await wajibLogin();
  return <AppShell email={pengguna.email}>{children}</AppShell>;
}
