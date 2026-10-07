import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
export const metadata: Metadata = {
  title: "NexusDocs - Semantic Markdown Knowledge Graph",
  description: "Production-grade developer documentation with hybrid search, knowledge graph, and citation-first RAG."
};
export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <html lang="en">
      <body className="min-h-[100dvh] bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>;
}
