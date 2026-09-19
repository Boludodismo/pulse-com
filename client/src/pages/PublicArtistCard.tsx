import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import ArtistEditorialCard from "@/components/artist-card/ArtistEditorialCard";
import { parsePresentation, toPublicPresentation } from "@/shared/artistCardPresentation";

export default function PublicArtistCard() {
  const [, params] = useRoute("/artista/:token");
  const q = trpc.studioRelations.publicCard.useQuery({
    token: params?.token || "",
  });

  if (q.isLoading)
    return (
      <main style={{ padding: "2rem", textAlign: "center" }}>
        Carregando cartão…
      </main>
    );

  if (!q.data)
    return (
      <main style={{ padding: "2rem", textAlign: "center" }}>
        <h1>Cartão indisponível</h1>
        <p>O artista pode ter pausado a publicação.</p>
      </main>
    );

  const card = q.data;
  const presentation = toPublicPresentation(
    parsePresentation(card.presentationJson ?? undefined)
  );

  return (
    <ArtistEditorialCard
      name={card.name}
      photo={card.photo ?? undefined}
      headline={card.headline}
      description={card.description}
      links={card.links}
      images={card.images}
      presentation={presentation}
    />
  );
}

