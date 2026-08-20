/// <reference types="vite/client" />

interface GlossaryEntry {
  simple: string;
  technical: string;
  example: string;
}

interface Window {
  GLOSSARY: Record<string, GlossaryEntry>;
}
