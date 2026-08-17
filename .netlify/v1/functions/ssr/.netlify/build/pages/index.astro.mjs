/* empty css                                 */
import { c as createComponent, r as renderTemplate, d as renderSlot, e as renderHead, a as addAttribute, b as createAstro, f as renderComponent, m as maybeRenderHead } from '../chunks/astro/server_CWB6S9zM.mjs';
import 'kleur/colors';
import 'html-escaper';
import 'clsx';
import { s as supabase } from '../chunks/supabase_QIRAwXL8.mjs';
export { renderers } from '../renderers.mjs';

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro = createAstro();
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const {
    title = "BLOSSOM \u2014 The Creative World of Olaoluwa Michael",
    description = "Official publishing ecosystem of Olaoluwa Michael: Author of 'TWISTED' & 'GOLGOTHA', AI Creative Specialist, and Stickman Storyteller.",
    image = "/assets/images/input_file_11.png"
  } = Astro2.props;
  return renderTemplate(_a || (_a = __template(['<html lang="en" class="scroll-smooth bg-navy-980"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>', '</title><meta name="description"', '><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400;1,600&family=JetBrains+Mono:wght@300;400;500;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">', '</head> <body class="bg-[#02050B] text-slate-300 font-sans antialiased overflow-x-hidden editorial-grid-lines min-h-screen flex flex-col justify-between"> <nav class="sticky top-0 z-40 bg-[#02050B]/90 backdrop-blur-xl border-b border-[#D4AF37]/10"> <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between"> <a href="/" class="flex items-center space-x-3.5 group"> <div class="w-11 h-11 border border-[#D4AF37]/40 bg-[#081021] flex items-center justify-center font-cinzel text-xl font-black text-[#E8C868]">B</div> <div class="flex flex-col"> <span class="font-cinzel tracking-[0.3em] text-lg font-bold text-[#F6F3EC]">BLOSSOM</span> <span class="text-[9px] font-mono tracking-[0.25em] text-[#D4AF37]/80 uppercase">Olaoluwa Michael</span> </div> </a> <div class="hidden xl:flex items-center space-x-7 text-[11px] uppercase tracking-[0.22em] font-mono text-slate-300"> <a href="/" class="hover:text-[#E8C868]">Home</a> <a href="/books/twisted" class="hover:text-[#E8C868]">Books</a> <a href="/journal/why-i-turned-to-ai-speed-editing" class="hover:text-[#E8C868]">Journal</a> <a href="/admin" class="text-slate-600 hover:text-[#E8C868]">CMS Studio</a> </div> </div> </nav> <main class="flex-grow"> ', ' </main> <footer class="border-t border-[#D4AF37]/15 bg-[#02050B] py-12 px-4 text-center text-xs font-mono text-slate-500"> <p>\xA9 ', " Olaoluwa Michael \u2022 BLOSSOM Ecosystem \u2022 Ondo State, Nigeria</p> </footer> <script>\n      if (window.lucide) window.lucide.createIcons();\n    <\/script> </body> </html>"])), title, addAttribute(description, "content"), renderHead(), renderSlot($$result, $$slots["default"]), (/* @__PURE__ */ new Date()).getFullYear());
}, "C:/Users/USERR/Desktop/blossom-platform/src/layouts/BaseLayout.astro", void 0);

const prerender = false;
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const { data: books } = await supabase.from("books").select("*").limit(3);
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, {}, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center"> <span class="text-xs font-mono uppercase tracking-[0.3em] text-[#E8C868] block mb-4">Digital Creative Ecosystem</span> <h1 class="font-cinzel text-4xl sm:text-7xl font-extrabold text-[#F6F3EC] leading-tight mb-6">
Stories. Ideas. <br><span class="italic font-editorial font-normal text-[#E8C868]">Technology. Creativity.</span> </h1> <p class="text-slate-400 max-w-2xl mx-auto font-sans font-light text-base sm:text-lg mb-8">
Welcome to BLOSSOM — the creative world of Olaoluwa Michael. Author, AI Creative Specialist, and Stickman Storyteller from Ondo State, Nigeria.
</p> <div class="flex justify-center gap-4 font-mono text-xs"> <a href="/books/twisted" class="px-8 py-4 bg-[#E8C868] text-[#02050B] font-bold uppercase tracking-widest rounded-xs">Explore Books</a> <a href="/journal/why-i-turned-to-ai-speed-editing" class="px-8 py-4 border border-[#D4AF37]/40 text-[#F6F3EC] font-bold uppercase tracking-widest rounded-xs">The Journal</a> </div> </section> ` })}`;
}, "C:/Users/USERR/Desktop/blossom-platform/src/pages/index.astro", void 0);

const $$file = "C:/Users/USERR/Desktop/blossom-platform/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
