import { redirect } from "next/navigation";

/** Raiz → quadro de leads; o middleware manda ao login quando preciso. */
export default function Home() {
  redirect("/leads");
}
