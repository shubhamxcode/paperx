import { Navigation } from "@/components/landing/Navigation";
import { Hero } from "@/components/landing/Hero";
import { Ticker } from "@/components/landing/Ticker";
import { Features } from "@/components/landing/Features";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";

// Public landing page — accessible to everyone, signed in or not.
export default function Home() {
  return (
    <main>
      <Navigation />
      <Hero />
      <Ticker />
      <Features />
      <CallToAction />
      <Footer />
    </main>
  );
}
