import Header from "@/components/Header";
import RegisterButton from "@/components/RegisterButton";

export default function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[85vh] items-center overflow-hidden px-6 pb-20 pt-32 text-white lg:min-h-[90vh] lg:px-12"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2000&auto=format&fit=crop"
        alt="Mountains and a lake in the Welsh countryside"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(16, 42, 35, 0.45) 0%, rgba(16, 42, 35, 0.75) 100%)",
        }}
      />

      <Header />

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-end gap-8 lg:grid-cols-12">
        <div className="max-w-2xl space-y-6 lg:col-span-8">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Know what&rsquo;s
            <br className="hidden sm:inline" /> happening in Wales
          </h1>

          <p className="text-lg font-normal leading-relaxed text-emerald-50/90 sm:text-xl">
            Companies. Contracts. Planning. Funding.
            <br className="hidden sm:inline" /> Development. All in one place.
          </p>

          <div className="space-y-3 pt-4">
            <RegisterButton variant="cream" />
            <p className="text-xs font-light text-emerald-100/70 sm:text-sm">
              Be the first to know when we launch.
            </p>
          </div>
        </div>

        <div className="hidden lg:col-span-4 lg:block lg:text-right">
          <div className="border-l-2 border-emerald-400/30 py-1 pl-4 text-lg font-normal leading-snug text-emerald-100/80 sm:text-xl lg:border-l-0 lg:border-r-2 lg:pl-0 lg:pr-6">
            Real data.
            <br />
            Deeper insights.
            <br />
            A stronger Wales.
          </div>
        </div>
      </div>
    </section>
  );
}
