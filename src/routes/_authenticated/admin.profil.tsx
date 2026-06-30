import { createFileRoute } from "@tanstack/react-router";
import { ProfilPage } from "./app.profil";

// Profil Saya versi area admin: konten sama persis, tapi dirender di dalam
// AdminShell (lewat layout /admin) sehingga pengguna tetap di mode admin.
export const Route = createFileRoute("/_authenticated/admin/profil")({
  head: () => ({ meta: [{ title: "Profil Saya — Admin BelanjaKu" }] }),
  component: ProfilPage,
});
