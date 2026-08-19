import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Space, Spin, Typography } from "antd";
import "@ant-design/v5-patch-for-react-19";
import type { ReactNode } from "react";

import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LanguageProvider, useLanguage } from "@/i18n/language";
import {
  IdentityUnauthorizedError,
  type AuthenticatedUser,
} from "@/services/identity";
import { identityClient } from "@/services/identity-client";
import "@ek-aiot/2d-editor-react/style.css";
import "./global.css";

export interface InitialState {
  currentUser?: AuthenticatedUser;
  identity: typeof identityClient;
}

function showLoginPage(): void {
  if (window.location.pathname === "/login") return;
  window.history.replaceState(window.history.state, "", "/login");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export async function getInitialState(): Promise<InitialState> {
  if (window.location.pathname === "/login")
    return { identity: identityClient };
  try {
    return {
      currentUser: await identityClient.getCurrentUser(),
      identity: identityClient,
    };
  } catch (error) {
    if (error instanceof IdentityUnauthorizedError) {
      showLoginPage();
      return { identity: identityClient };
    }
    throw error;
  }
}

function HeaderActions({ avatar }: { avatar: ReactNode }) {
  const { t } = useLanguage();

  return (
    <Space className="host-header-actions" size={12}>
      <LanguageSwitch />
      {avatar}
      <Button
        aria-label={t("host.logout")}
        icon={<LogoutOutlined />}
        title={t("host.logout")}
        type="text"
        onClick={() => window.dispatchEvent(new Event("host:logout"))}
      />
    </Space>
  );
}

function HostLoading() {
  const { t } = useLanguage();

  return (
    <div className="host-loading">
      <Spin size="large" />
      <Typography.Text>{t("host.loading")}</Typography.Text>
    </div>
  );
}

export const layout = ({ initialState }: { initialState?: InitialState }) => ({
  layout: "top",
  fixedHeader: true,
  title: "EK AIoT 2D Editor",
  logo: false,
  menu: false,
  contentStyle: { padding: 0 },
  avatarProps: initialState?.currentUser
    ? {
        icon: <UserOutlined />,
        title: initialState.currentUser.username,
        render: (_: unknown, avatar: ReactNode) => (
          <HeaderActions avatar={avatar} />
        ),
      }
    : undefined,
  onPageChange: () => {
    if (!initialState?.currentUser && window.location.pathname !== "/login") {
      showLoginPage();
    }
  },
});

export function rootContainer(container: ReactNode): ReactNode {
  return <LanguageProvider>{container ?? <HostLoading />}</LanguageProvider>;
}
