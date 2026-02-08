import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2">
      <h1 className="font-mono text-7xl font-bold text-gray-700">404</h1>
      <h2 className="font-mono text-2xl font-semibold text-gray-700">
        Not Found
      </h2>
      <p className="text-xl text-gray-700">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-400"
      >
        Go home
      </Link>
    </main>
  );
}
