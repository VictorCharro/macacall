const RANDOM_STATUS_QUOTES = [
  "Só mais uma partida...",
  "Winter is coming.",
  "Hasta la vista, baby.",
  "Que a Força esteja com você.",
  "I am inevitable.",
  "GG WP 🍌",
  "Precisando de mana.",
  "É a vida, Griffith.",
  "Wubba lubba dub dub!",
  "Contrato aceito.",
  "Just keep swimming.",
  "Não era esse o plano.",
];

export function randomStatusQuote(): string {
  return RANDOM_STATUS_QUOTES[
    Math.floor(Math.random() * RANDOM_STATUS_QUOTES.length)
  ];
}
