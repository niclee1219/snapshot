import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 text-zinc-900">
      <h1 className="text-3xl font-semibold tracking-tight">pixolateds</h1>
      <p className="text-sm text-zinc-500">Event photo galleries.</p>
      <Link
        href="/admin"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Admin sign in
      </Link>
    </div>
  );
}
