import { site, formatYen } from "@/config/site";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Pricing } from "@/lib/pricing";

/**
 * Legal pages: 特定商取引法に基づく表記 and the privacy policy.
 *
 * DRAFTS — the owner must review them. Anything only the owner knows is
 * marked "change_here" (rendered highlighted) and must be filled in before
 * launch. Contact details, check-in times and the cancellation policy come
 * from site config / the dictionaries, so they stay in sync automatically.
 * Not legal advice.
 */

export type LegalSection = { heading: string; paragraphs?: string[]; list?: string[] };
export type CommerceRow = [label: string, value: string];

/** Matches the owner-to-fill markers, so pages can highlight them. */
export const PLACEHOLDER = /【change_here[^】]*】|\[change_here[^\]]*\]/g;

/** The operator, as given by the owner for the 特商法 disclosure. */
export const OPERATOR = {
  company: "株式会社岡元工務店",
  responsible: "岡元　和也",
  address: "大阪府岸和田市宮前町22-27",
  license: "シレイ24044-1003-2",
  representative: "岡元　健次",
};

/** Price line built from the live pricing, so it always matches what checkout charges. */
function priceLine(p: Pricing, ja: boolean): string {
  const extraFrom = p.includedGuests + 1;
  if (ja) {
    const parts = [
      `基本料金 ${formatYen(p.baseNightly)}／泊（${p.minGuests}〜${p.includedGuests}名様）`,
      `${extraFrom}名様以降は1名様につき ${formatYen(p.perGuestNightly)}／泊`,
      ...(p.cleaningFee > 0 ? [`清掃費 ${formatYen(p.cleaningFee)}／1滞在`] : []),
    ];
    return `${parts.join("、")}（表示価格はすべて税込）`;
  }
  const parts = [
    `Base rate ${formatYen(p.baseNightly)} per night (${p.minGuests}–${p.includedGuests} guests)`,
    `from the ${extraFrom}th guest, ${formatYen(p.perGuestNightly)} per guest per night`,
    ...(p.cleaningFee > 0 ? [`cleaning fee ${formatYen(p.cleaningFee)} per stay`] : []),
  ];
  return `${parts.join("; ")}. All prices include tax.`;
}

export function commerceDisclosure(lang: "en" | "ja", t: Dictionary, pricing: Pricing) {
  const ja = lang === "ja";
  const policy = [t.reserve.policyFree, t.reserve.policyHalf, t.reserve.policyFull].join(ja ? "／" : "; ");
  const rows: CommerceRow[] = ja
    ? [
        ["販売業者", OPERATOR.company],
        ["運営統括責任者", OPERATOR.responsible],
        ["所在地", OPERATOR.address],
        ["電話番号", site.contact.phone],
        ["メールアドレス", site.contact.email],
        ["旅館業許可番号", OPERATOR.license],
        ["販売価格", priceLine(pricing, true)],
        ["商品代金以外の必要料金", "なし（BBQをご利用の場合、炭・食材はお客様ご自身でご用意ください）"],
        ["お支払い方法", "クレジットカード（JCB等）、Apple Pay、Link、分割払い（Stripeによる決済）"],
        ["お支払い時期", "ご予約時にお支払いいただきます。お支払いの確認をもってご予約確定となります。"],
        ["サービスの提供時期", `ご予約いただいた宿泊日（チェックイン ${site.checkIn}〜／チェックアウト 〜${site.checkOut}）`],
        ["キャンセル・返金", `${policy}。返金はお支払いに使用されたクレジットカードへ行います。キャンセルは「予約の確認」ページ、またはメール・お電話にて承ります。`],
      ]
    : [
        ["Seller", OPERATOR.company],
        ["Person responsible", OPERATOR.responsible],
        ["Address", OPERATOR.address],
        ["Phone", site.contact.phone],
        ["Email", site.contact.email],
        ["Hotel Business Act license no.", OPERATOR.license],
        ["Price", priceLine(pricing, false)],
        ["Other charges", "None (for the BBQ, please bring your own charcoal and food)."],
        ["Payment methods", "Credit cards (including JCB), Apple Pay, Link and Japanese card installments, processed by Stripe."],
        ["Payment timing", "At the time of booking. Your booking is confirmed once payment is received."],
        ["Service period", `The dates you booked (check-in from ${site.checkIn}, check-out by ${site.checkOut}).`],
        ["Cancellation & refunds", `${policy}. Refunds go back to the credit card used. Cancel on the My reservations page, or contact us by email or phone.`],
      ];
  return {
    title: ja ? "特定商取引法に基づく表記" : "Specified Commercial Transactions Act disclosure",
    note: ja ? undefined : "This English translation is provided for convenience; the Japanese version takes precedence.",
    rows,
  };
}

export function privacyPolicy(lang: "en" | "ja") {
  const ja = lang === "ja";
  const sections: LegalSection[] = ja
    ? [
        { heading: "1. 事業者", paragraphs: [
          `${OPERATOR.company}（所在地：${OPERATOR.address}、代表取締役：${OPERATOR.representative}）（以下「当宿」）は、田舎民泊「和」Nagomi Inn Miyazaki のウェブサイトおよびご予約サービスにおいて、お客様の個人情報を以下のとおり取り扱います。`,
        ] },
        { heading: "2. 取得する情報", list: [
          "お名前、メールアドレス、電話番号、ご住所（国・地域、郵便番号を含む）",
          "ご予約内容（宿泊日、人数、到着予定時刻、BBQ・サウナのご利用予定、備考、ご利用のクーポン）",
          "アカウント情報（メールアドレスとパスワード。パスワードは暗号化して保存され、当宿が知ることはできません）",
          "お支払いに関する情報（決済はStripeが行い、当宿はクレジットカード番号を取得・保存しません）",
          "お問い合わせの内容",
        ] },
        { heading: "3. 利用目的", list: [
          "ご予約の受付・管理、ご予約内容に関するご連絡",
          "旅館業法に基づく宿泊者名簿の作成",
          "ご滞在の準備（到着時刻、BBQ・サウナのご利用予定など）",
          "お支払い、キャンセル、返金の手続き",
          "ご予約確認、ご到着前のご案内、ご滞在後のお礼などのメール送信",
          "お問い合わせへの対応、不正利用の防止",
        ] },
        { heading: "4. 業務委託と国外での取り扱い", paragraphs: [
          "当宿は、上記の目的のため、次の事業者に個人情報の取り扱いを委託しています。これらの事業者により、米国など日本国外で個人情報が取り扱われる場合があります。当宿は、個人情報の適切な管理が見込まれる事業者を選定しています。",
        ], list: [
          "Stripe（決済）",
          "Supabase（データベース・アカウント管理）",
          "Vercel（ウェブサイトの運営）",
          "Resend（メール配信）",
        ] },
        { heading: "5. 第三者への提供", paragraphs: [
          "法令に基づく場合（旅館業法に基づく行政機関・警察からの照会など）を除き、ご本人の同意なく個人情報を第三者に提供することはありません。",
        ] },
        { heading: "6. 保存期間", paragraphs: [
          "宿泊者名簿に記載する情報は、旅館業法の定めにより3年間保存します。その他の情報は、利用目的の達成に必要な期間保存し、その後削除します。",
        ] },
        { heading: "7. 安全管理", paragraphs: [
          "当宿は、個人情報への不正アクセス、漏えい、滅失を防ぐため、アクセス制限や通信の暗号化などの適切な安全管理措置を講じます。",
        ] },
        { heading: "8. 開示・訂正・削除等のご請求", paragraphs: [
          `ご自身の個人情報の開示、訂正、利用停止、削除をご希望の場合は、${site.contact.email} までご連絡ください。ご本人であることを確認のうえ、法令に従い対応いたします。`,
        ] },
        { heading: "9. ブラウザへの保存（Cookie等）", paragraphs: [
          "当サイトは、ログイン状態、表示言語、表示テーマ、入力途中のご予約内容をお使いのブラウザに保存します。広告や行動分析のためのトラッキングは行っていません。",
        ] },
        { heading: "10. 改定", paragraphs: [
          "本ポリシーの内容は、必要に応じて改定することがあります。改定後の内容は本ページに掲載した時点から適用されます。",
        ] },
      ]
    : [
        { heading: "1. Who we are", paragraphs: [
          `${OPERATOR.company} (${OPERATOR.address}; representative director: ${OPERATOR.representative}) ("we") handles your personal information on the Nagomi Inn Miyazaki (田舎民泊「和」) website and booking service as described below.`,
        ] },
        { heading: "2. What we collect", list: [
          "Your name, email address, phone number and address (including country/region and postal code)",
          "Booking details (dates, number of guests, estimated arrival time, BBQ and sauna plans, notes, any coupon used)",
          "Account details (email and password; passwords are stored encrypted and we cannot see them)",
          "Payment information (payments are processed by Stripe; we never receive or store card numbers)",
          "Anything you send us when you contact us",
        ] },
        { heading: "3. How we use it", list: [
          "To take and manage your booking and contact you about it",
          "To keep the guest register required by Japan's Hotel Business Act",
          "To prepare for your stay (arrival time, BBQ and sauna plans)",
          "To process payments, cancellations and refunds",
          "To send booking confirmations, pre-arrival information and a post-stay thank-you",
          "To answer your questions and prevent misuse",
        ] },
        { heading: "4. Service providers and processing outside Japan", paragraphs: [
          "We use the following providers to run the service. They may process your information outside Japan, including in the United States. We choose providers we expect to protect personal information appropriately.",
        ], list: [
          "Stripe (payments)",
          "Supabase (database and accounts)",
          "Vercel (website hosting)",
          "Resend (email delivery)",
        ] },
        { heading: "5. Sharing", paragraphs: [
          "We do not share your personal information with third parties without your consent, except where required by law (for example, enquiries from public authorities or the police under the Hotel Business Act).",
        ] },
        { heading: "6. How long we keep it", paragraphs: [
          "Information in the guest register is kept for three years, as the Hotel Business Act requires. Other information is kept only as long as needed for the purposes above, then deleted.",
        ] },
        { heading: "7. Security", paragraphs: [
          "We take appropriate measures, such as access controls and encrypted connections, to protect your information against unauthorized access, leaks and loss.",
        ] },
        { heading: "8. Your rights", paragraphs: [
          `To see, correct, stop the use of, or delete your personal information, email ${site.contact.email}. We will confirm your identity and respond as the law requires.`,
        ] },
        { heading: "9. Browser storage (cookies etc.)", paragraphs: [
          "The site stores your sign-in session, language, display theme and any booking in progress in your browser. We do not use advertising or analytics tracking.",
        ] },
        { heading: "10. Changes", paragraphs: [
          "We may update this policy when needed. Changes apply from when they are posted on this page.",
        ] },
      ];
  return {
    title: ja ? "プライバシーポリシー" : "Privacy policy",
    note: ja ? undefined : "This English translation is provided for convenience; the Japanese version takes precedence.",
    effective: ja ? "制定日：2026年10月3日" : "Effective: October 3, 2026",
    sections,
  };
}
