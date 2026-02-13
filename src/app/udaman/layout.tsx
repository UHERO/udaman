import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "udaman",
  description: "UHERO Data Manager",
};

export default function UdamanLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
