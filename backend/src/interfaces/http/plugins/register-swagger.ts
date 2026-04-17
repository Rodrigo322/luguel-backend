import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Luguel Backend API",
        description: "API backend da plataforma universal de aluguel.",
        version: "0.1.0"
      },
      tags: [
        { name: "System", description: "Rotas de sistema e observabilidade." },
        { name: "Auth", description: "Autenticação e autorização." },
        { name: "Users", description: "Gestão de usuários e perfis." },
        { name: "Listings", description: "Gestão de anúncios." },
        { name: "Rentals", description: "Gestão de locações." },
        { name: "Reviews", description: "Sistema de reputação e avaliações." },
        { name: "Reports", description: "Sistema de denúncias e moderação." },
        { name: "Admin", description: "Ferramentas administrativas." },
        { name: "Boost", description: "Impulsionamento de anúncios." }
      ]
    },
    transform: jsonSchemaTransform
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });
}
