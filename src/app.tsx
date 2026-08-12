import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Button, Space, Spin, Typography } from "antd";
import "@ant-design/v5-patch-for-react-19";
import type { ReactNode } from "react";

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
          <Space size={8}>
            {avatar}
            <Button
              aria-label="退出登录"
              icon={<LogoutOutlined />}
              type="text"
              onClick={() => window.dispatchEvent(new Event("host:logout"))}
            />
          </Space>
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
  return (
    container ?? (
      <div className="host-loading">
        <Spin size="large" />
        <Typography.Text>正在验证登录状态</Typography.Text>
      </div>
    )
  );
}
