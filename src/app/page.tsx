import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Header />
      <Hero />
    </main>
  );
}
