"use client";

import { useEffect } from "react";

// Next falls back to a bare, unstyled error screen when a Server Component
// throws and there's no error.tsx in scope -- there wasn't one anywhere in
// the app before this. This one covers everything under the root layout.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-7xl">🙈</span>
      <h1 className="text-3xl font-bold text-accent sm:text-4xl">
        Vish, deu ruim
      </h1>
      <p className="max-w-md text-lg text-muted">
        Algo quebrou aqui do nosso lado. Tenta de novo -- se continuar, é
        melhor recarregar a página.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition hover:brightness-95"
      >
        Tentar de novo
      </button>
    </main>
  );
}
