import { LockOutlined, MobileOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Typography } from "antd";
import { useState } from "react";

import { identityClient } from "@/services/identity-client";
import type { LoginCredentials } from "@/services/identity";
import "./index.css";

export default function LoginPage() {
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(credentials: LoginCredentials): Promise<void> {
    setSubmitting(true);
    setError(undefined);
    try {
      await identityClient.login(credentials);
      window.location.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请重试。");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-heading">
          <div className="login-mark">
            <LockOutlined />
          </div>
          <div>
            <Typography.Title id="login-title" level={3}>
              EK AIoT 2D Editor
            </Typography.Title>
            <Typography.Text type="secondary">登录演示工作区</Typography.Text>
          </div>
        </div>
        {error ? <Alert showIcon type="error" message={error} /> : null}
        <Form<LoginCredentials>
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void submit(values)}
        >
          <Form.Item
            name="mobile"
            label="手机号"
            rules={[{ required: true, message: "请输入手机号" }]}
          >
            <Input
              autoComplete="username"
              prefix={<MobileOutlined />}
              placeholder="手机号"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              autoComplete="current-password"
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>
          <Button block htmlType="submit" loading={submitting} type="primary">
            登录
          </Button>
        </Form>
      </section>
    </main>
  );
}
