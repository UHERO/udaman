import React from "react";

export default function Dvw_Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex justify-center pt-2 md:h-[880px] md:w-[962px]">
      {children}
    </main>
  );
}
