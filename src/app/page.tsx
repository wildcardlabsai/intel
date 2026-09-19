import Hero from "@/components/Hero";
import DataOverview from "@/components/DataOverview";
import AudienceSection from "@/components/AudienceSection";
import Insights from "@/components/Insights";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <div id="about" />
      <DataOverview />
      <AudienceSection />
      <Insights />
      <Footer />
    </main>
  );
}
