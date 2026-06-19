import { TopBar } from "@/components/TopBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
