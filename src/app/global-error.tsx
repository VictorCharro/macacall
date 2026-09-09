"use client";

// Only fires if the root layout itself throws -- error.tsx (a sibling in
// this same folder) can't catch that since it renders *inside* the layout.
// Has to render its own <html>/<body> since the layout that would normally
// provide them is what failed.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-6 text-center text-black">
        <span className="text-7xl">🙈</span>
        <h1 className="text-3xl font-bold sm:text-4xl">Vish, deu ruim</h1>
        <p className="max-w-md text-lg text-neutral-600">
          Algo quebrou aqui do nosso lado. Tenta de novo -- se continuar, é
          melhor recarregar a página.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-black px-6 py-3 font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
