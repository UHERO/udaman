import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-full min-h-svh flex-col items-center justify-center gap-2">
      <h1 className="font-mono text-7xl font-bold text-gray-700">404</h1>
      <h2 className="font-mono text-2xl font-semibold text-gray-700">
        Not Found
      </h2>
      <Link
        href="/udaman/uhero/series"
        className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-400"
      >
        Go to Series
      </Link>
    </main>
  );
}
