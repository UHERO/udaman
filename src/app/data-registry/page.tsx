import { OctagonAlert } from "lucide-react";

import { auth } from "@/lib/auth/index";
import { getRegistryList } from "@/actions/data-registry";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import DataRegistry from "./data-registry";

export default async function DataRegistryPage() {
  const session = await auth();
  const res = await getRegistryList();

  if (res.success && session) {
    return <DataRegistry registryList={res.data} user={session} />;
  }

  return (
    <Card className="mx-auto w-full md:max-w-3xl">
      <CardHeader className="text-center">
        <CardTitle className="flex justify-center gap-x-2 text-center">
          <OctagonAlert size={24} />
          <span>Error</span>
        </CardTitle>
        <CardDescription>
          {res.success
            ? "You need to sign in to view the data registry."
            : res.error}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
