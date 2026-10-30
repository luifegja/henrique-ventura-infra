// Bateria do painel no navegador (Playwright/Chromium), chamada por scripts/teste-ponta-a-ponta.py.
// Roda dentro de mcr.microsoft.com/playwright:v1.64.1-noble. Escreve /out/resultados.json e capturas.
import { chromium } from "playwright";
import fs from "node:fs";

const B = process.env.BASE;
const OUT = process.env.OUT;
const E = (k) => process.env[k];
const results = [];
const check = (caso, ok, detalhe = "") => results.push({ caso, ok: !!ok, detalhe: String(detalhe).slice(0, 300) });
/** isVisible() do Playwright não espera: esta espera até `ms`. */
const ve = (loc, ms = 15000) => loc.first().waitFor({ state: "visible", timeout: ms }).then(() => true, () => false);
const shot = (page, nome) => page.screenshot({ path: `${OUT}/${nome}.png`, fullPage: true }).catch(() => {});

async function login(page, email, pw) {
  await page.goto(`${B}/login`);
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await page.click('button[type="submit"]');
}

const browser = await chromium.launch();
const errosJs = [];
try {
  // 1. senha errada
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, E("ADMIN_EMAIL"), "senha-errada-123");
    const msg = await ve(page.getByText("E-mail ou senha incorretos."));
    check("senha errada é recusada com a mensagem certa", msg);
    await ctx.close();
  }

  // 2. administrador: quadro, arrastar, WhatsApp
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errosJs.push(e.message));
    await login(page, E("ADMIN_EMAIL"), E("ADMIN_PW"));
    await page.waitForURL(/\/leads/, { timeout: 20000 });
    check("admin entra e cai no quadro", page.url().includes("/leads"));
    await ve(page.locator('section[aria-label="Lead"]'));
    const colunas = await page.locator("section[aria-label] h3").allTextContents();
    check("8 colunas na ordem da cadência", colunas.join("|") === "Lead|1º contato|Qualificação|Agendamento|Reunião diagnóstico|Follow up|Contrato enviado|Pagamento", colunas.join("|"));
    const leadCol = page.locator('section[aria-label="Lead"]');
    const card = leadCol.locator('article[aria-label="E2E Lead Teste"]');
    check("contato sem etapa aparece em Lead", await ve(card));
    check("contato aparece uma vez só", (await page.locator('article[aria-label="E2E Lead Teste"]').count()) === 1);
    check("menu do admin tem WhatsApp", await ve(page.getByRole("link", { name: "WhatsApp" })));
    await shot(page, "01-quadro");

    // arrasta para Agendamento
    const alvo = page.locator('section[aria-label="Agendamento"] > div');
    const a = await card.boundingBox();
    const b = await alvo.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height - 6);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height, { steps: 5 });
    await page.mouse.move(b.x + b.width / 2, b.y + 40, { steps: 15 });
    await page.mouse.up();
    const movido = await ve(page.locator('section[aria-label="Agendamento"] article[aria-label="E2E Lead Teste"]'));
    check("arrastar move o cartão para Agendamento", movido);
    await page.waitForTimeout(2500);
    await page.reload();
    const persistiu = await ve(page.locator('section[aria-label="Agendamento"] article[aria-label="E2E Lead Teste"]'));
    check("depois de recarregar, continua em Agendamento", persistiu);
    await shot(page, "02-quadro-movido");

    await page.goto(`${B}/whatsapp`);
    await ve(page.getByRole("status"));
    const estado = await page.getByRole("status").first().textContent().catch(() => "");
    check("tela WhatsApp mostra o estado da instância", /Desconectado|Conectado|Conectando/.test(estado ?? ""), estado);
    check("botão Conectar disponível", await ve(page.getByRole("button", { name: "Conectar" })));
    await shot(page, "03-whatsapp");
    await ctx.close();
  }

  // 3. agente: sem WhatsApp, responde e resolve
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errosJs.push(e.message));
    await login(page, E("AGENTE_EMAIL"), E("AGENTE_PW"));
    await page.waitForURL(/\/leads/, { timeout: 20000 });
    await ve(page.getByRole("link", { name: "Leads" }));
    check("agente não vê WhatsApp no menu", (await page.getByRole("link", { name: "WhatsApp" }).count()) === 0);
    check("agente vê o contato uma vez só", (await ve(page.locator('article[aria-label="E2E Lead Teste"]'))) && (await page.locator('article[aria-label="E2E Lead Teste"]').count()) === 1,
      await page.locator('article[aria-label="E2E Lead Teste"]').count());
    await page.goto(`${B}/whatsapp`);
    await page.waitForURL(/\/leads/, { timeout: 15000 }).catch(() => {});
    check("agente que abre /whatsapp volta para o quadro", page.url().includes("/leads"), page.url());

    // clique no nome do cartão → atendimento mais recente
    await page.locator('article[aria-label="E2E Lead Teste"] a').first().click();
    await page.waitForURL(new RegExp(`/atendimentos\\?.*c=${E("CONV_ID")}`), { timeout: 20000 }).catch(() => {});
    check("cartão abre o atendimento do contato", page.url().includes(`c=${E("CONV_ID")}`), page.url());
    check("mensagem do lead aparece", await ve(page.getByText("Olá, quero saber da reunião de diagnóstico.")));
    const sel = await page.getByLabel("Etapa da cadência comercial").inputValue().catch(() => "");
    check("cabeçalho mostra a etapa Agendamento", sel === "Agendamento", sel);

    await page.getByLabel("Resposta").fill("Resposta E2E pelo painel");
    await page.getByLabel("Resposta").press("Enter");
    const enviada = await ve(page.locator("li", { hasText: "Resposta E2E pelo painel" }).filter({ hasText: "E2E Agente" }));
    check("resposta aparece na conversa com o nome do agente", enviada);
    await shot(page, "04-atendimento");

    await page.getByRole("button", { name: "Resolver" }).click();
    check("resolver muda o botão para Reabrir", await ve(page.getByRole("button", { name: "Reabrir" })));
    await ctx.close();
  }
  check("sem erro de JavaScript nas páginas", errosJs.length === 0, errosJs.join(" | "));
} catch (e) {
  check("bateria rodou até o fim", false, e?.message ?? e);
} finally {
  await browser.close();
  fs.writeFileSync(`${OUT}/resultados.json`, JSON.stringify(results, null, 2));
}
