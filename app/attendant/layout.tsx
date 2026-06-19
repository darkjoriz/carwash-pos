import { TopBar } from "@/components/TopBar";

export default function AttendantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}
