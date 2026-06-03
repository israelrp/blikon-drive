import { redirect } from "next/navigation";

// En dev navegamos directo a un folder conocido
export default function Home() {
  redirect("/folder/folder-test-001");  // dev default
}
