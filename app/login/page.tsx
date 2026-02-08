import Image from "next/image";
import LoginClient from "./ui/LoginClient";

export default function LoginPage() {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* LEFT / MASCOTE */}
        <section
          className="relative hidden items-center justify-center overflow-hidden lg:flex"
          style={{
            backgroundColor: "#EB3410",
            backgroundImage:
              "radial-gradient(circle at center, rgba(255, 178, 168, 0.95) 0%, rgba(247, 134, 119, 0.55) 28%, rgba(245, 207, 202, 0) 60%)",
          }}
        >
          {/* mascote centralizado */}
          <div className="relative flex w-full items-center justify-center p-10">
            <div className="relative aspect-square w-[320px] max-w-[70%] lg:w-[460px] xl:w-[520px]">
              <Image
                src="/mascote.png"
                alt="Mascote"
                fill
                priority
                className="object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
              />
            </div>
          </div>
        </section>

        {/* RIGHT / LOGIN */}
        <section className="flex items-center justify-center bg-white px-6 py-10">
          <div className="w-full max-w-md">
            <LoginClient />
          </div>
        </section>
      </div>
    </main>
  );
}
