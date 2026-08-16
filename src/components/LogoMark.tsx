import Image from "next/image";
import { site } from "@/config/site";

/**
 * The Nagomi logo mark (和 in the green enso, from the noren), replacing the
 * plain 和 kanji everywhere. Rendered transparent — the artwork sits directly
 * on the page background.
 * (Previous framed style, if ever wanted back:
 *  `rounded-full border border-paper/20 bg-[#f6f1e7]` + inner padding.)
 */
export function LogoMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  // Sizes scale from the 46px nav mark (46 : 52 : 124 ≈ the original 36 : 40 : 96 family).
  const box = size === "sm" ? "h-[46px] w-[46px]" : size === "md" ? "h-[52px] w-[52px]" : "h-[124px] w-[124px]";
  const px = size === "lg" ? 124 : 52;
  return (
    <span className={`grid shrink-0 place-items-center ${box}`}>
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
