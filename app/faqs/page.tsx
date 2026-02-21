import Link from "next/link";
import SearchModalTrigger from "@/components/search-modal-trigger";
import { FiShoppingBag, FiUser } from "react-icons/fi";

export default function FaqsPage() {
  return (
    <main className="min-h-screen bg-[#F3F1EE] text-[#111111]">
      <header className="w-full px-6 py-6">
        <div className="mx-auto grid w-full max-w-[1100px] grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-5">
          <nav
            className="flex flex-wrap items-center justify-center gap-8 text-[14px] tracking-[0.05em] text-[#1A1A1A] md:justify-start"
            style={{ fontFamily: "var(--font-header--family)" }}
            aria-label="Primary navigation"
          >
            <Link href="/">HOME</Link>
            <Link href="/shop">SHOP</Link>
            <Link href="/contact">CONTACT US</Link>
            <Link href="/faqs">FAQ&apos;s</Link>
          </nav>

          <Link href="/" className="text-center leading-[0.88]" aria-label="Grown Cookies home">
            <span
              className="block text-[42px] font-bold lowercase text-[#8D029B]"
              style={{ fontFamily: "var(--font-header--family)" }}
            >
              grown
              <br />
              cookies
            </span>
            <span
              className="mt-2 mx-auto inline-flex min-w-[12ch] items-center justify-center border border-transparent px-[6px] py-[2px] text-center text-[12px] uppercase tracking-[0.2em] leading-none text-[#8D029B]"
              style={{ fontFamily: "var(--font-header--family)" }}
            >
              flavour refined
            </span>
          </Link>

          <div
            className="flex items-center justify-center gap-5 text-[#1A1A1A] md:justify-end"
            aria-label="Actions"
          >
            <SearchModalTrigger />
            <Link href="/account" aria-label="Account" className="inline-flex text-[22px]">
              <FiUser />
            </Link>
            <Link href="/cart" aria-label="Cart" className="inline-flex text-[22px]">
              <FiShoppingBag />
            </Link>
          </div>
        </div>
      </header>

      <div className="w-full bg-[#7A1E73] py-3 text-center text-[16px] font-medium text-white">
        Shop our latest arrivals
      </div>

      <section className="mx-auto w-full max-w-[1100px] px-5 pb-[100px]">
        <h1
          className="mt-20 mb-12 text-[42px] font-bold text-[#111111] md:text-[64px]"
          style={{ fontFamily: "var(--font-heading--family)" }}
        >
          FAQ&apos;s
        </h1>

        <article>
          <h2
            className="mt-14 mb-4 text-[22px] font-bold uppercase tracking-[0.03em] text-[#111111] md:text-[28px]"
            style={{ fontFamily: "var(--font-heading--family)" }}
          >
            SHOP WITH CONFIDENCE
          </h2>
          <p
            className="max-w-[720px] text-[16px] leading-[1.7] text-[#333333]"
            style={{ fontFamily: "var(--font-body--family)" }}
          >
            We guarantee that all of our products are beautiful and well made. As most of our
            products are handmade, please be prepared to accept some variations in the product. All
            product dimensions listed are approximate.
          </p>
          <div className="mx-auto mt-6 h-1 w-1 rounded-full bg-[#C43C3C]" />
        </article>

        <article>
          <h2
            className="mt-14 mb-4 text-[22px] font-bold uppercase tracking-[0.03em] text-[#111111] md:text-[28px]"
            style={{ fontFamily: "var(--font-heading--family)" }}
          >
            STORING &amp; CONSUMING COOKIES
          </h2>
          <p
            className="max-w-[720px] text-[16px] leading-[1.7] text-[#333333]"
            style={{ fontFamily: "var(--font-body--family)" }}
          >
            Our cookies can be stored in an air-tight container. Your cookies should keep for up to
            4 days, though we recommend eating them sooner if you can! To bring any cookie back to
            life just pop it in the oven for 5 minutes.
          </p>
        </article>

        <article>
          <h2
            className="mt-14 mb-4 text-[22px] font-bold uppercase tracking-[0.03em] text-[#111111] md:text-[28px]"
            style={{ fontFamily: "var(--font-heading--family)" }}
          >
            PAYMENT METHODS
          </h2>
        </article>
      </section>
    </main>
  );
}

