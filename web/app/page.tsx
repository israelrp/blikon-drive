import { requireSession } from "@/lib/auth";
import { getFolderChildren } from "@/lib/api";
import { HomeClient } from "./HomeClient";

export default async function HomePage() {
  const [session, folders] = await Promise.all([
    requireSession(),
    getFolderChildren().catch(() => []),
  ]);

  return <HomeClient folders={folders} userInfo={session} />;
}
