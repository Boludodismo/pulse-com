import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";


type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    studioId: 1,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("gallery router", () => {
  it("should upload an image with base64 data", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar um cliente
    const client = await caller.clients.create({
      name: "Cliente Galeria",
      email: "galeria@example.com",
    });

    // Criar uma imagem base64 simples (1x1 pixel PNG transparente)
    const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    // Upload da imagem
    const result = await caller.gallery.uploadImage({
      clientId: client.id,
      imageBase64: base64Image,
      fileName: "test-image.png",
      mimeType: "image/png",
      description: "Imagem de teste",
      tags: "teste, upload",
    });

    expect(result).toBeDefined();
    expect(result.imageUrl).toBeDefined();
    expect(result.imageKey).toContain(`client-${client.id}/gallery/`);
    expect(result.description).toBe("Imagem de teste");
    expect(result.tags).toBe("teste, upload");
  });

  it("should list images by client", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar um cliente
    const client = await caller.clients.create({
      name: "Cliente Múltiplas Imagens",
      email: "multiplas@example.com",
    });

    const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    // Upload de múltiplas imagens
    await caller.gallery.uploadImage({
      clientId: client.id,
      imageBase64: base64Image,
      fileName: "image1.png",
      mimeType: "image/png",
      description: "Primeira imagem",
    });

    await caller.gallery.uploadImage({
      clientId: client.id,
      imageBase64: base64Image,
      fileName: "image2.png",
      mimeType: "image/png",
      description: "Segunda imagem",
    });

    // Listar imagens
    const images = await caller.gallery.getByClientId({
      clientId: client.id,
    });

    expect(Array.isArray(images)).toBe(true);
    expect(images.length).toBe(2);
    expect(images[0]?.description).toBeDefined();
  });

  it("should upload image linked to appointment", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar um cliente
    const client = await caller.clients.create({
      name: "Cliente com Agendamento",
      email: "agendamento@example.com",
    });

    // Criar um agendamento
    const appointment = await caller.appointments.create({
      clientId: client.id,
      date: new Date("2025-02-01T10:00:00").toISOString(),
      duration: 120,
      service: "Tatuagem colorida",
      depositAmount: 0,
      totalAmount: 0,
      artist: "João Tatuador",
    });

    const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    // Upload vinculado ao agendamento
    const result = await caller.gallery.uploadImage({
      clientId: client.id,
      appointmentId: appointment.id,
      imageBase64: base64Image,
      fileName: "tattoo-result.png",
      mimeType: "image/png",
      description: "Resultado final da tatuagem",
    });

    expect(result).toBeDefined();
    expect(result.appointmentId).toBe(appointment.id);
    expect(result.description).toBe("Resultado final da tatuagem");
  });

  it("should delete an image", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar um cliente
    const client = await caller.clients.create({
      name: "Cliente Deletar",
      email: "deletar@example.com",
    });

    const base64Image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    // Upload da imagem
    const uploaded = await caller.gallery.uploadImage({
      clientId: client.id,
      imageBase64: base64Image,
      fileName: "to-delete.png",
      mimeType: "image/png",
    });

    // Deletar a imagem
    await caller.gallery.delete({ id: uploaded.id });

    // Verificar que foi deletada
    const images = await caller.gallery.getByClientId({
      clientId: client.id,
    });

    expect(images.length).toBe(0);
  });
});
