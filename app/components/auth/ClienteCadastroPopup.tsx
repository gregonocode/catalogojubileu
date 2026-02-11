'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import ClienteAuthModal from './ClienteAuthModal';

type Props = {
  delayMs?: number; // padrão 5000
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function ClienteCadastroPopup({ delayMs = 5000 }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY no .env');
    }
    return createBrowserClient(url, key);
  }, []);

  const [checked, setChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const [showPopup, setShowPopup] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data } = await supabase.auth.getSession();
      const authed = Boolean(data.session?.user);

      if (cancelled) return;

      setIsAuthed(authed);
      setChecked(true);

      if (!authed) {
        window.setTimeout(() => {
          if (!cancelled) setShowPopup(true);
        }, delayMs);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [delayMs, supabase]);

  if (!checked || isAuthed) return null;

  return (
    <>
      {/* POPUP flutuante */}
      {showPopup && !openModal && (
        <div className="fixed bottom-4 left-1/2 z-[70] w-[92vw] max-w-md -translate-x-1/2">
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-lg">
            <div className="text-sm font-semibold">
              Você ainda não tem cadastro!
            </div>
            <div className="mt-1 text-sm text-black/60">
              Faça o cadastro aqui abaixo é <span className="font-semibold">super rápido</span>!
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenModal(true)}
                className={cn(
                  'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white',
                  'bg-[#E83A1C] hover:brightness-95'
                )}
              >
                Criar conta
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenModal(true);
                  // o modal alterna sozinho, mas aqui você pode querer abrir direto em login
                  // (vamos deixar no default e o usuário clica em "Já tenho conta")
                }}
                className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-black/70 hover:bg-black/5"
              >
                Já tenho conta
              </button>

              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="rounded-xl px-3 py-2.5 text-sm text-black/40 hover:bg-black/5"
                aria-label="Fechar popup"
                title="Fechar"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      <ClienteAuthModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        defaultMode="signup"
        onAuthed={() => {
          setShowPopup(false);
          router.refresh(); // atualiza server/client state do catálogo
        }}
      />
    </>
  );
}
