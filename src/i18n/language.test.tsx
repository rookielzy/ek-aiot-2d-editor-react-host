import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";

import { LanguageSwitch } from "@/components/LanguageSwitch";

import {
  LANGUAGE_STORAGE_KEY,
  LanguageProvider,
  useLanguage,
} from "./language";

function CurrentMessage() {
  const { t } = useLanguage();
  return <span>{t("login.submit")}</span>;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "zh-CN");
  document.documentElement.lang = "";
});

it("switches languages without a reload and persists the selection", async () => {
  render(
    <LanguageProvider>
      <LanguageSwitch />
      <CurrentMessage />
    </LanguageProvider>,
  );

  expect(screen.getByText("登录")).toBeVisible();
  fireEvent.click(screen.getByText("EN"));

  expect(screen.getByText("Sign in")).toBeVisible();
  expect(screen.getByLabelText("Switch language")).toBeVisible();
  await waitFor(() => {
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en-US");
    expect(document.documentElement.lang).toBe("en-US");
  });
});
