import { Navigation } from "@/components/landing/Navigation";
import { Hero } from "@/components/landing/Hero";
import { Ticker } from "@/components/landing/Ticker";
import { SimulationDemo } from "@/components/landing/SimulationDemo";
import { Features } from "@/components/landing/Features";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <main>
      <Navigation />
      <Hero />
      <Ticker />
      <SimulationDemo />
      <Features />
      <CallToAction />
      <Footer />
    </main>
  );
}
