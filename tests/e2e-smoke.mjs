import { strict as assert } from "node:assert";
import { chromium } from "playwright";

const baseUrl = process.env.HOST_E2E_BASE_URL ?? "http://127.0.0.1:8000";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
const requests = [];
page.on("request", (request) => requests.push(request.url()));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

await page.route("**/api/auth/userinfo", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "X-Authenticated-User-Id": "42" },
    body: JSON.stringify({ userId: 42, username: "Ada" }),
  });
});
await page.route("**/api/agent/capabilities", async (route) => {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      protocolVersion: 1,
      toolCatalogVersion: 3,
      capabilities: { rawReasoning: true },
    }),
  });
});
await page.route(/\/api\/agent\/events.*/, async (route) => {
  await route.fulfill({
    contentType: "text/event-stream",
    body: "event: agent-caught-up\ndata: {}\n\n",
  });
});

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByText("Ada").waitFor();
  await page.locator(".editor-page").waitFor();
  assert.equal(await page.getByText("Revision 0").isVisible(), true);
  assert.equal(await page.getByLabel("二维编辑器工作区").isVisible(), true);

  const canvas = page.locator("canvas").first();
  await canvas.waitFor();
  const canvasBox = await canvas.boundingBox();
  assert(
    canvasBox && canvasBox.width > 300 && canvasBox.height > 300,
    "canvas must be visible",
  );

  const firstSession = await page.evaluate(() =>
    JSON.parse(
      sessionStorage.getItem("ek-aiot.demo-document-session.v1") ?? "null",
    ),
  );
  assert.equal(typeof firstSession?.documentRef, "string");
  assert(firstSession.documentRef.length > 10);

  const rectangle = page.getByLabel("矩形", { exact: true });
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await rectangle.dispatchEvent("dragstart", { dataTransfer: transfer });
  await page.locator(".ek-editor-react-canvas-host").dispatchEvent("dragover", {
    clientX: canvasBox.x + canvasBox.width / 2,
    clientY: canvasBox.y + canvasBox.height / 2,
    dataTransfer: transfer,
  });
  await page.locator(".ek-editor-react-canvas-host").dispatchEvent("drop", {
    clientX: canvasBox.x + canvasBox.width / 2,
    clientY: canvasBox.y + canvasBox.height / 2,
    dataTransfer: transfer,
  });
  await page.getByText("Revision 1").waitFor();
  const editedSession = await page.evaluate(() =>
    JSON.parse(
      sessionStorage.getItem("ek-aiot.demo-document-session.v1") ?? "null",
    ),
  );
  assert.equal(editedSession.revision, 1);
  assert.equal(editedSession.document.nodes.length, 1);

  await page.reload({ waitUntil: "networkidle" });
  const restoredSession = await page.evaluate(() =>
    JSON.parse(
      sessionStorage.getItem("ek-aiot.demo-document-session.v1") ?? "null",
    ),
  );
  assert.equal(restoredSession.documentRef, firstSession.documentRef);
  assert.equal(restoredSession.revision, 1);
  assert.equal(restoredSession.document.nodes.length, 1);
  await page.getByText("Revision 1").waitFor();
  await page.getByText("图元: 1").waitFor();

  let clearedBeforeLogout = false;
  await page.route("**/api/auth/logout", async (route) => {
    clearedBeforeLogout = await page.evaluate(
      () => sessionStorage.getItem("ek-aiot.demo-document-session.v1") === null,
    );
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "signed out",
    });
  });
  await page.getByLabel("退出登录").click();
  await page.waitForURL("**/api/auth/login");
  assert.equal(clearedBeforeLogout, true);
  assert.equal(consoleErrors.length, 0, consoleErrors.join("\n"));

  await page.screenshot({
    path: "/tmp/ek-aiot-2d-editor-react-host.png",
    fullPage: true,
  });
  console.log(
    JSON.stringify({
      documentRef: firstSession.documentRef,
      canvas: canvasBox,
      screenshot: "/tmp/ek-aiot-2d-editor-react-host.png",
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      url: page.url(),
      text: (await page.locator("body").textContent())?.slice(0, 2000),
      requests,
      consoleErrors,
    }),
  );
  throw error;
} finally {
  await browser.close();
}

const unauthorizedBrowser = await chromium.launch({ headless: true });
const unauthorizedPage = await unauthorizedBrowser.newPage();
const unauthorizedErrors = [];
unauthorizedPage.on("console", (message) => {
  if (message.type() === "error") unauthorizedErrors.push(message.text());
});
unauthorizedPage.on("pageerror", (error) =>
  unauthorizedErrors.push(error.message),
);
await unauthorizedPage.route("**/api/auth/userinfo", (route) =>
  route.fulfill({ status: 401 }),
);
try {
  await unauthorizedPage.goto(baseUrl);
  await unauthorizedPage.waitForURL("**/login");
  await unauthorizedPage.getByText("需要登录").waitFor();
} catch (error) {
  console.error(
    JSON.stringify({
      unauthorizedUrl: unauthorizedPage.url(),
      unauthorizedText: await unauthorizedPage.locator("body").textContent(),
      unauthorizedErrors,
    }),
  );
  throw error;
} finally {
  await unauthorizedBrowser.close();
}
