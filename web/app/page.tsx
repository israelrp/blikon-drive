import { requireSession } from "@/lib/auth";
import { getFolderChildren } from "@/lib/api";
import { HomeClient } from "./HomeClient";

export default async function HomePage() {
  const session = await requireSession();
  const folders = await getFolderChildren(undefined, session.blikonId).catch(() => []);

  return <HomeClient folders={folders} userInfo={session} />;
}
