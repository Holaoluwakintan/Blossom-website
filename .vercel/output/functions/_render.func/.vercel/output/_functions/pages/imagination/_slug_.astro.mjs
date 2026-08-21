/* empty css                                    */
import { c as createComponent, f as renderComponent, r as renderTemplate, e as createAstro, m as maybeRenderHead, d as addAttribute } from '../../chunks/astro/server_DPp1CpV_.mjs';
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
  const { data: artwork, error } = await supabase.from("artworks").select("*").eq("slug", slug).maybeSingle();
  if (error || !artwork) {
    throw new Error(`Artwork not found. Slug: ${slug}. Supabase error: ${error?.message ?? "No artwork returned"}`);
  }
  const requestMessage = `Hi, my name is [your name]. I would like to request an unwatermarked copy of "${artwork.title}".`;
  const whatsappRequestUrl = `https://wa.me/2348148034092?text=${encodeURIComponent(requestMessage)}`;
  const gmailRequestUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    "michaelolaoluwag@gmail.com"
  )}&su=${encodeURIComponent(`Unwatermarked artwork request: ${artwork.title}`)}&body=${encodeURIComponent(requestMessage)}`;
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": `${artwork.title} | Imagination World | BLOSSOM`, "description": artwork.caption || artwork.story || `Explore ${artwork.title} in Imagination World.` }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="min-h-screen bg-[#02050B] text-[#F6F3EC]"> <section class="max-w-7xl mx-auto px-6 pt-8 lg:pt-12"> <a href="/imagination" class="inline-flex items-center gap-3 text-xs font-mono uppercase tracking-[0.2em] text-slate-400 hover:text-[#E8C868] transition-colors"><span class="text-lg">←</span> Back to Imagination World</a> </section> <section class="max-w-7xl mx-auto px-6 py-12 lg:py-20"> <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start"> <div class="relative max-w-2xl mx-auto lg:mx-0 w-full"> <div class="absolute -inset-6 bg-[#E8C868]/8 blur-3xl rounded-full"></div> <div class="relative overflow-hidden border border-[#E8C868]/20 bg-[#080D16]"><img${addAttribute(artwork.image_url, "src")}${addAttribute(artwork.alt_text || artwork.title, "alt")} class="w-full aspect-square object-contain"></div> </div> <div class="lg:pt-5"> ${artwork.category && renderTemplate`<p class="text-[10px] font-mono uppercase tracking-[0.3em] text-[#E8C868]">${artwork.category}</p>`} <h1 class="font-cinzel text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mt-4">${artwork.title}</h1> ${artwork.caption && renderTemplate`<p class="font-editorial italic text-xl sm:text-2xl text-[#E8C868] mt-4">${artwork.caption}</p>`} ${artwork.story && renderTemplate`<div class="mt-9"> <p class="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-3">The meaning</p> <p class="text-slate-300 text-lg leading-relaxed whitespace-pre-line">${artwork.story}</p> </div>`} ${artwork.moral_quote && renderTemplate`<blockquote class="border-l-2 border-[#E8C868] pl-5 mt-9"> <p class="font-editorial italic text-2xl leading-relaxed text-[#F6F3EC]">“${artwork.moral_quote}”</p> </blockquote>`} <div class="border-t border-white/10 mt-10 pt-7"> <p class="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-4">Artwork access</p> <div class="flex flex-wrap gap-4"> <a${addAttribute(artwork.image_url, "href")} target="_blank" rel="noopener noreferrer" download class="inline-flex items-center justify-center px-7 py-4 border border-white/20 text-[#F6F3EC] font-mono text-xs font-bold uppercase tracking-widest hover:border-[#E8C868] hover:text-[#E8C868] transition-colors">Open / Save Artwork</a> <a${addAttribute(whatsappRequestUrl, "href")} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center px-7 py-4 bg-[#E8C868] text-[#02050B] font-mono text-xs font-bold uppercase tracking-widest hover:bg-[#F6F3EC] transition-colors">Request Unwatermarked Copy</a> <a${addAttribute(gmailRequestUrl, "href")} class="inline-flex items-center justify-center px-7 py-4 border border-[#E8C868]/50 text-[#E8C868] font-mono text-xs font-bold uppercase tracking-widest hover:bg-[#E8C868] hover:text-[#02050B] transition-colors">Request by Email</a> </div> <p class="text-xs leading-6 text-slate-500 mt-5">The public version is watermarked. Unwatermarked copies are available only with the artist’s permission.</p> </div> </div> </div> </section> </main> ` })}`;
}, "C:/Users/USERR/Desktop/blossom-platform/src/pages/imagination/[slug].astro", void 0);

const $$file = "C:/Users/USERR/Desktop/blossom-platform/src/pages/imagination/[slug].astro";
const $$url = "/imagination/[slug]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$slug,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
