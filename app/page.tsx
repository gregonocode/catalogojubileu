import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LayoutDashboard, PackageSearch } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf8] text-[#1f1a18]">
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[#eb3410]" />
        <div className="absolute left-1/2 top-0 -z-10 h-[34rem] w-[52rem] -translate-x-1/2 rounded-full bg-[#ff8c78]/60 blur-3xl" />

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-3 text-white">
            <div className="relative h-11 w-11 overflow-hidden rounded-xl bg-white p-1 shadow-lg">
              <Image src="/logo.svg" alt="Pneu Forte" fill className="object-contain p-1" priority />
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold">Pneu Forte</p>
              <p className="text-xs text-white/75">Catálogo digital</p>
            </div>
          </div>
          <Link href="/login" className="rounded-xl border border-white/35 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
            Entrar
          </Link>
        </header>

        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:pb-28 lg:pt-16">
          <div className="text-center lg:text-left">
            <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white">Venda pneus com mais agilidade</span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">Seu catálogo, seus pedidos, tudo em um só lugar.</h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-white/85 lg:mx-0">Organize produtos, compartilhe seu catálogo e acompanhe os pedidos da sua empresa de forma simples.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-[#d92f0e] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#fff4f1]">
                Acessar o painel <ArrowRight size={18} />
              </Link>
              <a href="#recursos" className="rounded-xl border border-white/40 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">Conhecer recursos</a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute inset-6 rounded-full bg-white/20 blur-3xl" />
            <Image src="/mascote.png" alt="Mascote Pneu Forte" width={640} height={640} priority className="relative mx-auto w-full max-w-[480px] object-contain drop-shadow-[0_24px_32px_rgba(79,15,5,0.28)]" />
          </div>
        </section>
      </div>

      <section id="recursos" className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-16 sm:grid-cols-3 lg:px-8">
        {[
          { icon: PackageSearch, title: "Catálogo organizado", text: "Cadastre categorias e produtos com todas as informações que seu cliente precisa." },
          { icon: CheckCircle2, title: "Pedidos simplificados", text: "Receba e acompanhe pedidos sem perder nenhuma oportunidade de venda." },
          { icon: LayoutDashboard, title: "Gestão em tempo real", text: "Visualize produtos, clientes e resultados diretamente no seu painel." },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-2xl border border-black/10 bg-white p-6 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.35)]">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#fff0ec] text-[#eb3410]"><Icon size={22} /></div>
            <h2 className="mt-5 text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-black/60">{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
