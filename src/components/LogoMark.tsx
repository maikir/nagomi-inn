import Image from "next/image";
import { site } from "@/config/site";

/**
 * The Nagomi logo mark (和 in the green enso, from the noren), replacing the
 * plain 和 kanji everywhere. Sits on a fixed cream tile so it stays legible
 * on the dark "sumi" theme — on the light theme the tile blends into washi.
 */
export function LogoMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-9 w-9 p-1" : size === "md" ? "h-10 w-10 p-1" : "h-24 w-24 p-2.5";
  const px = size === "lg" ? 96 : 40;
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-[#f6f1e7] ${box}`}>
      <Image
        src="/images/logo-mark.png"
        alt={`${site.kanji} — ${site.fullName}`}
        width={px}
        height={px}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
