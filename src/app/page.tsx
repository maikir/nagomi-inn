import { Hero } from "@/components/home/Hero";
import { Intro } from "@/components/home/Intro";
import { Spaces } from "@/components/home/Spaces";
import { Sauna } from "@/components/home/Sauna";
import { Gallery } from "@/components/home/Gallery";
import { Access } from "@/components/home/Access";
import { FinalCta } from "@/components/home/FinalCta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Intro />
      <Spaces />
      <Sauna />
      <Gallery />
      <Access />
      <FinalCta />
    </>
  );
}
