/* empty css                                    */
import { c as createComponent, f as renderComponent, r as renderTemplate, e as createAstro, m as maybeRenderHead, d as addAttribute, F as Fragment } from '../../chunks/astro/server_DPp1CpV_.mjs';
import 'kleur/colors';
import { $ as $$BaseLayout } from '../../chunks/BaseLayout_BgkBtEkl.mjs';
import { s as supabase } from '../../chunks/supabase_D5z8xYEZ.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
const prerender = false;
const $$slug = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$slug;
  const { slug } = Astro2.params;
  const { data: book, error } = await supabase.from("books").select("*").eq("slug", slug).maybeSingle();
  if (error || !book) {
    throw new Error(
      `Book not found. Slug: ${slug}. Supabase error: ${error?.message ?? "No book returned"}`
    );
  }
  const downloadUrl = book.download_url ?? null;
  const isFree = Boolean(downloadUrl) && (book.price_ngn === null || book.price_ngn === void 0 || Number(book.price_ngn) === 0);
  const formatNaira = (price) => `\u20A6${Number(price).toLocaleString("en-NG")}`;
  const priceLabel = book.price_ngn === null || book.price_ngn === void 0 || book.price_ngn === "" ? null : formatNaira(book.price_ngn);
  const orderMessage = priceLabel ? `Hi, my name is [your name]. I would like to order a copy of "${book.title}" for ${priceLabel}.` : `Hi, my name is [your name]. I would like to order a copy of "${book.title}".`;
  const whatsappOrderUrl = `https://wa.me/2348148034092?text=${encodeURIComponent(orderMessage)}`;
  const emailOrderUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    "michaelolaoluwag@gmail.com"
  )}&su=${encodeURIComponent(`Book order: ${book.title}`)}&body=${encodeURIComponent(orderMessage)}`;
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": `${book.title} | BLOSSOM`, "description": book.synopsis ?? book.description ?? `Explore ${book.title} by ${book.author}.` }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="min-h-screen bg-[#02050B] text-[#F6F3EC]"> <!-- TOP NAVIGATION --> <section class="max-w-7xl mx-auto px-6 pt-8 lg:pt-12"> <a href="/books" class="inline-flex items-center gap-3 text-xs font-mono uppercase tracking-[0.2em] text-slate-400 hover:text-[#E8C868] transition-colors"> <span class="text-lg">←</span>
Back to Books
</a> </section> <!-- BOOK HERO --> <section class="max-w-7xl mx-auto px-6 py-12 lg:py-20"> <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"> <!-- BOOK COVER --> <div class="flex justify-center"> <div class="w-full max-w-md relative"> <div class="absolute -inset-4 bg-[#E8C868]/5 blur-3xl"></div> <img${addAttribute(book.cover_image_url, "src")}${addAttribute(`${book.title} book cover`, "alt")} class="relative w-full rounded-sm shadow-2xl"> </div> </div> <!-- BOOK INFORMATION --> <div> ${book.genre && renderTemplate`<p class="text-xs font-mono uppercase tracking-[0.3em] text-[#E8C868] mb-5"> ${book.genre} </p>`} <h1 class="font-cinzel text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-4"> ${book.title} </h1> ${book.subtitle && renderTemplate`<p class="font-editorial italic text-xl sm:text-2xl text-[#E8C868] mb-6"> ${book.subtitle} </p>`} <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400 font-mono mb-8"> ${book.author && renderTemplate`<span>By ${book.author}</span>`} ${book.publication_year && renderTemplate`<span>${book.publication_year}</span>`} ${book.format && renderTemplate`<span>${book.format}</span>`} </div> <!-- SYNOPSIS --> ${book.synopsis && renderTemplate`<div class="mb-8"> <h2 class="text-xs font-mono uppercase tracking-[0.25em] text-[#E8C868] mb-3">
About the Book
</h2> <p class="text-slate-300 text-lg leading-relaxed"> ${book.synopsis} </p> </div>`} <!-- ACTION AREA --> <div class="flex flex-wrap gap-4 mb-8"> ${downloadUrl && isFree && renderTemplate`<a${addAttribute(downloadUrl, "href")} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center px-8 py-4 bg-[#E8C868] text-[#02050B] font-mono font-bold uppercase tracking-widest hover:bg-[#F6F3EC] transition-all duration-300">
Download Free E-Book
</a>`} ${!isFree && renderTemplate`${renderComponent($$result2, "Fragment", Fragment, {}, { "default": async ($$result3) => renderTemplate` <a${addAttribute(whatsappOrderUrl, "href")} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center px-8 py-4 bg-[#E8C868] text-[#02050B] font-mono font-bold uppercase tracking-widest hover:bg-[#F6F3EC] transition-all duration-300">
Order Your Copy
</a> <a${addAttribute(emailOrderUrl, "href")} class="inline-flex items-center justify-center px-8 py-4 border border-[#E8C868]/50 text-[#E8C868] font-mono text-xs font-bold uppercase tracking-widest hover:bg-[#E8C868] hover:text-[#02050B] transition-colors">
Order by Email
</a> ` })}`} </div> ${downloadUrl && isFree && renderTemplate`<p class="text-xs text-slate-500 font-mono">
Free digital edition • PDF
</p>`} ${!isFree && renderTemplate`<div class="border-t border-white/10 pt-5"> <p class="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-1">
Price
</p> <p class="font-cinzel text-xl sm:text-2xl font-bold text-[#E8C868]"> ${priceLabel ?? "Price available on request"} </p> </div>`} </div> </div> <!-- FULL DESCRIPTION --> ${book.description && renderTemplate`<section class="max-w-4xl mx-auto mt-20 pt-12 border-t border-white/10"> <p class="text-xs font-mono uppercase tracking-[0.25em] text-[#E8C868] mb-5">
The Story
</p> <h2 class="font-cinzel text-2xl sm:text-3xl font-bold mb-6">
About This Book
</h2> <div class="text-slate-300 leading-8 text-base sm:text-lg whitespace-pre-line"> ${book.description} </div> </section>`} <!-- BACK TO BOOKS --> <div class="max-w-4xl mx-auto mt-16 pt-8 border-t border-white/10"> <a href="/books" class="inline-flex items-center gap-3 text-xs font-mono uppercase tracking-[0.2em] text-slate-400 hover:text-[#E8C868] transition-colors"> <span>←</span>
Explore All Books
</a> </div> </section> </main> ` })}`;
}, "C:/Users/USERR/Desktop/blossom-platform/src/pages/books/[slug].astro", void 0);

const $$file = "C:/Users/USERR/Desktop/blossom-platform/src/pages/books/[slug].astro";
const $$url = "/books/[slug]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$slug,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
