import Link from "next/link";

import { H1, Lead } from "@/components/typography";

export default function LoginPage() {
  return (
    <div className="">
      <H1>UDAMAN Platform</H1>
      <Lead>
        This page is not in use,{" "}
        <Link href="/udaman/uhero" className="hover:underline">
          go to app
        </Link>
      </Lead>
    </div>
  );
}
