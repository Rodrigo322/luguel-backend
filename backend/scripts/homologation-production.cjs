#!/usr/bin/env node
"use strict";

const DEFAULT_BASE_URL = "https://luguel-backend.vercel.app";

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) {
    return fallback;
  }
  return found.slice(prefix.length);
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

class ApiClient {
  constructor(name, baseUrl) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  mergeCookies(headers) {
    const setCookies = getSetCookies(headers);
    for (const cookieLine of setCookies) {
      const firstChunk = cookieLine.split(";")[0]?.trim();
      if (!firstChunk) {
        continue;
      }

      const separator = firstChunk.indexOf("=");
      if (separator <= 0) {
        continue;
      }

      const key = firstChunk.slice(0, separator).trim();
      const value = firstChunk.slice(separator + 1).trim();
      this.cookies.set(key, value);
    }
  }

  async request(method, path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const cookies = this.cookieHeader();
    if (cookies) {
      headers.cookie = cookies;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    this.mergeCookies(response.headers);

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return {
      method,
      path,
      status: response.status,
      data
    };
  }

  async expect(method, path, expectedStatuses, options) {
    const accepted = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
    const result = await this.request(method, path, options);

    if (!accepted.includes(result.status)) {
      throw new Error(
        `[${this.name}] ${method} ${path} => ${result.status} (esperado: ${accepted.join(", ")})\n` +
          `Resposta: ${typeof result.data === "string" ? result.data : JSON.stringify(result.data)}`
      );
    }

    return result;
  }
}

function isoUtc(daysFromNow, hour) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + daysFromNow);
  value.setUTCHours(hour, 0, 0, 0);
  return value.toISOString();
}

function buildReportContext(mode, baseUrl) {
  return {
    mode,
    baseUrl,
    startedAt: new Date().toISOString(),
    checks: [],
    resources: {}
  };
}

function pushCheck(context, name, status, detail) {
  const entry = {
    name,
    status,
    detail: detail ?? ""
  };
  context.checks.push(entry);
  const marker = status === "OK" ? "OK" : "FAIL";
  console.log(`${marker} - ${name}${entry.detail ? ` :: ${entry.detail}` : ""}`);
}

function printSummaryAndExit(context, exitCode, error) {
  const ok = context.checks.filter((item) => item.status === "OK").length;
  const fail = context.checks.length - ok;
  context.finishedAt = new Date().toISOString();
  context.summary = {
    total: context.checks.length,
    ok,
    fail
  };

  console.log("\n===== HOMOLOGACAO SUMMARY =====");
  console.log(JSON.stringify(context, null, 2));

  if (error) {
    console.error("\n===== HOMOLOGACAO ERROR =====");
    console.error(error?.stack ?? String(error));
  }

  process.exit(exitCode);
}

async function runReadonly(context, adminClient, adminCredentials) {
  await adminClient.expect("GET", "/api/v1/health", 200);
  pushCheck(context, "Health endpoint", "OK");

  await adminClient.expect("GET", "/docs", 200);
  pushCheck(context, "Swagger UI endpoint", "OK");

  await adminClient.expect("GET", "/api/v1/admin/metrics", 401);
  pushCheck(context, "Admin endpoint bloqueado sem autenticacao", "OK");

  await adminClient.expect("POST", "/api/v1/auth/signin", 200, {
    body: adminCredentials
  });
  pushCheck(context, "Login admin", "OK");

  await adminClient.expect("GET", "/api/v1/auth/session", 200);
  pushCheck(context, "Sessao autenticada", "OK");

  await adminClient.expect("GET", "/api/v1/admin/metrics", 200);
  pushCheck(context, "Admin metrics", "OK");

  await adminClient.expect("GET", "/api/v1/users", 200);
  pushCheck(context, "Users list", "OK");

  await adminClient.expect("GET", "/api/v1/listings", 200);
  pushCheck(context, "Listings list", "OK");

  await adminClient.expect("GET", "/api/v1/rentals", 200);
  pushCheck(context, "Rentals list", "OK");

  await adminClient.expect("GET", "/api/v1/reviews", 200);
  pushCheck(context, "Reviews list", "OK");

  await adminClient.expect("GET", "/api/v1/admin/reports", 200);
  pushCheck(context, "Reports list", "OK");

  await adminClient.expect("GET", "/api/v1/admin/reports/critical", 200);
  pushCheck(context, "Critical reports list", "OK");

  await adminClient.expect("GET", "/api/v1/boosts", 200);
  pushCheck(context, "Boosts list", "OK");

  await adminClient.expect("POST", "/api/v1/auth/signout", 200);
  pushCheck(context, "Logout admin", "OK");

  await adminClient.expect("GET", "/api/v1/auth/session", 401);
  pushCheck(context, "Sessao encerrada corretamente", "OK");
}

async function runDestructive(context, adminClient, adminCredentials, testPassword) {
  const ownerClient = new ApiClient("owner", context.baseUrl);
  const tenantClient = new ApiClient("tenant", context.baseUrl);
  const suffix = Date.now().toString();
  const ownerEmail = `owner.${suffix}@luguel.dev`;
  const tenantEmail = `tenant.${suffix}@luguel.dev`;

  context.resources.ownerEmail = ownerEmail;
  context.resources.tenantEmail = tenantEmail;

  let ownerId;
  let tenantId;
  let listingId;

  try {
    await adminClient.expect("POST", "/api/v1/auth/signin", 200, { body: adminCredentials });
    pushCheck(context, "Login admin", "OK");

    const ownerSignup = await ownerClient.expect("POST", "/api/v1/auth/signup", 201, {
      body: {
        name: `Owner ${suffix}`,
        email: ownerEmail,
        password: testPassword
      }
    });
    ownerId = ownerSignup.data?.user?.id;
    context.resources.ownerId = ownerId;
    pushCheck(context, "Cadastro locador teste", ownerId ? "OK" : "FAIL", ownerEmail);

    const tenantSignup = await tenantClient.expect("POST", "/api/v1/auth/signup", 201, {
      body: {
        name: `Tenant ${suffix}`,
        email: tenantEmail,
        password: testPassword
      }
    });
    tenantId = tenantSignup.data?.user?.id;
    context.resources.tenantId = tenantId;
    pushCheck(context, "Cadastro locatario teste", tenantId ? "OK" : "FAIL", tenantEmail);

    await adminClient.expect("PATCH", `/api/v1/admin/users/${ownerId}/role`, 200, {
      body: { role: "LOCADOR" }
    });
    pushCheck(context, "Admin define role LOCADOR", "OK");

    await adminClient.expect("PATCH", `/api/v1/admin/users/${tenantId}/role`, 200, {
      body: { role: "LOCATARIO" }
    });
    pushCheck(context, "Admin define role LOCATARIO", "OK");

    const listing = await ownerClient.expect("POST", "/api/v1/listings", 201, {
      body: {
        title: `Camera profissional ${suffix}`,
        description: "Anuncio de homologacao controlada para validacao ponta a ponta em producao.",
        category: "Camera",
        city: "Sao Paulo",
        region: "SP",
        dailyPrice: 180,
        deliveryMode: "BOTH",
        bookingMode: "BOTH"
      }
    });

    listingId = listing.data?.listing?.id;
    context.resources.listingId = listingId;
    pushCheck(context, "Criacao de anuncio", listingId ? "OK" : "FAIL", `status=${listing.data?.listing?.status}`);

    if (listing.data?.listing?.status !== "ACTIVE") {
      await adminClient.expect("POST", `/api/v1/admin/listings/${listingId}/approve`, 200);
      pushCheck(context, "Aprovacao admin do anuncio", "OK");
    }

    await ownerClient.expect("PUT", `/api/v1/listings/${listingId}/availability`, 200, {
      body: {
        slots: [
          { date: isoUtc(2, 10), status: "FREE", pickupTime: "10:00", returnTime: "18:00" },
          { date: isoUtc(3, 10), status: "FREE", pickupTime: "10:00", returnTime: "18:00" }
        ]
      }
    });
    pushCheck(context, "Agenda de disponibilidade configurada", "OK");

    const rental = await tenantClient.expect("POST", "/api/v1/rentals", 201, {
      body: {
        listingId,
        startDate: isoUtc(2, 10),
        endDate: isoUtc(4, 10),
        paymentMode: "SPLIT_SIGNAL_REMAINDER",
        depositAmount: 100,
        fulfillmentMethod: "DELIVERY_OWNER",
        deliveryAddress: "Rua de Teste, 123 - Sao Paulo - SP"
      }
    });
    const rentalId = rental.data?.id;
    context.resources.rentalId = rentalId;
    pushCheck(context, "Solicitacao de locacao", rentalId ? "OK" : "FAIL");

    await tenantClient.expect("POST", `/api/v1/rentals/${rentalId}/contract/accept`, 200);
    pushCheck(context, "Aceite contrato locatario", "OK");

    await ownerClient.expect("POST", `/api/v1/rentals/${rentalId}/contract/accept`, 200);
    pushCheck(context, "Aceite contrato locador", "OK");

    const payment = await tenantClient.expect("GET", `/api/v1/rentals/${rentalId}/payment`, 200);
    const signalAmount = payment.data?.signalAmount ?? 0;
    const totalAmount = payment.data?.totalAmount ?? 0;
    pushCheck(context, "Consulta pagamento", "OK", `total=${totalAmount} signal=${signalAmount}`);

    await tenantClient.expect("POST", `/api/v1/rentals/${rentalId}/payment/confirm`, 200, {
      body: {
        amount: signalAmount,
        inAppPaymentReference: `SIG-${suffix}`
      }
    });
    pushCheck(context, "Pagamento parcial", "OK");

    await ownerClient.expect("PATCH", `/api/v1/rentals/${rentalId}/status`, 200, {
      body: { status: "APPROVED" }
    });
    pushCheck(context, "Locacao aprovada", "OK");

    await ownerClient.expect("PATCH", `/api/v1/rentals/${rentalId}/status`, 200, {
      body: { status: "ACTIVE" }
    });
    pushCheck(context, "Locacao ativa", "OK");

    await tenantClient.expect("POST", `/api/v1/rentals/${rentalId}/payment/confirm`, 200, {
      body: {
        amount: totalAmount,
        inAppPaymentReference: `FULL-${suffix}`
      }
    });
    pushCheck(context, "Pagamento quitado", "OK");

    await tenantClient.expect("GET", `/api/v1/rentals/${rentalId}/receipt`, 200);
    pushCheck(context, "Comprovante de locacao", "OK");

    await tenantClient.expect("POST", `/api/v1/rentals/${rentalId}/chat/messages`, 201, {
      body: { message: `Mensagem de homologacao ${suffix}` }
    });
    pushCheck(context, "Chat interno", "OK");

    await ownerClient.expect("PATCH", `/api/v1/rentals/${rentalId}/status`, 200, {
      body: { status: "COMPLETED" }
    });
    pushCheck(context, "Locacao concluida", "OK");

    await tenantClient.expect("POST", "/api/v1/reviews", 201, {
      body: {
        listingId,
        rentalId,
        rating: 5,
        comment: `Avaliacao automatizada ${suffix}`
      }
    });
    pushCheck(context, "Avaliacao registrada", "OK");

    const report = await tenantClient.expect("POST", "/api/v1/reports", 201, {
      body: {
        listingId,
        reason: `Denuncia automatizada ${suffix}`,
        details: "Fluxo destrutivo controlado de homologacao."
      }
    });
    const reportId = report.data?.id;
    context.resources.reportId = reportId;
    pushCheck(context, "Denuncia registrada", reportId ? "OK" : "FAIL");

    await adminClient.expect("PATCH", `/api/v1/admin/reports/${reportId}/status`, 200, {
      body: {
        status: "TRIAGED",
        reason: "Triagem tecnica automatizada."
      }
    });
    pushCheck(context, "Triagem administrativa", "OK");

    await ownerClient.expect("POST", "/api/v1/boosts", 201, {
      body: {
        listingId,
        amount: 150,
        days: 7,
        paymentConfirmed: true
      }
    });
    pushCheck(context, "Boost criado", "OK");
  } finally {
    if (listingId) {
      const archive = await adminClient.request("POST", `/api/v1/admin/listings/${listingId}/archive`, {
        body: {
          reason: "Limpeza automatica de homologacao."
        }
      });
      pushCheck(context, "Cleanup anuncio", archive.status === 200 ? "OK" : "FAIL", `status=${archive.status}`);
    }

    const ownerDelete = await ownerClient.request("DELETE", "/api/v1/users/me");
    pushCheck(
      context,
      "Cleanup conta locador",
      ownerDelete.status === 204 || ownerDelete.status === 401 ? "OK" : "FAIL",
      `status=${ownerDelete.status}`
    );

    const tenantDelete = await tenantClient.request("DELETE", "/api/v1/users/me");
    pushCheck(
      context,
      "Cleanup conta locatario",
      tenantDelete.status === 204 || tenantDelete.status === 401 ? "OK" : "FAIL",
      `status=${tenantDelete.status}`
    );

    await adminClient.request("POST", "/api/v1/auth/signout");
  }
}

async function main() {
  const mode = getArg("mode", process.env.SMOKE_MODE ?? "readonly");
  const baseUrl = process.env.SMOKE_BASE_URL ?? DEFAULT_BASE_URL;
  const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "";
  const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "";
  const testPassword = process.env.SMOKE_TEST_PASSWORD ?? "Test#12345678";
  const allowDestructive = (process.env.SMOKE_ALLOW_DESTRUCTIVE ?? "false").toLowerCase() === "true";

  if (!adminEmail || !adminPassword) {
    throw new Error("SMOKE_ADMIN_EMAIL e SMOKE_ADMIN_PASSWORD sao obrigatorias.");
  }

  if (!["readonly", "destructive"].includes(mode)) {
    throw new Error("Modo invalido. Use --mode=readonly ou --mode=destructive.");
  }

  if (mode === "destructive" && !allowDestructive) {
    throw new Error("Modo destrutivo bloqueado. Defina SMOKE_ALLOW_DESTRUCTIVE=true para habilitar.");
  }

  const context = buildReportContext(mode, baseUrl);
  const adminClient = new ApiClient("admin", baseUrl);
  const adminCredentials = { email: adminEmail, password: adminPassword };

  try {
    if (mode === "readonly") {
      await runReadonly(context, adminClient, adminCredentials);
    } else {
      await runDestructive(context, adminClient, adminCredentials, testPassword);
    }
    printSummaryAndExit(context, 0);
  } catch (error) {
    printSummaryAndExit(context, 1, error);
  }
}

main();
