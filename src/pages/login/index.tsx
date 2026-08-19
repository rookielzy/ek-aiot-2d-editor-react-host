import { LockOutlined, MobileOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Typography } from "antd";
import { useState } from "react";

import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useLanguage } from "@/i18n/language";
import { identityClient } from "@/services/identity-client";
import type { LoginCredentials } from "@/services/identity";
import "./index.css";

export default function LoginPage() {
  const { t } = useLanguage();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(credentials: LoginCredentials): Promise<void> {
    setSubmitting(true);
    setError(undefined);
    try {
      await identityClient.login(credentials);
      window.location.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("login.failed"));
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <LanguageSwitch className="login-language-switch" />
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-heading">
          <div className="login-mark">
            <LockOutlined />
          </div>
          <div>
            <Typography.Title id="login-title" level={3}>
              EK AIoT 2D Editor
            </Typography.Title>
            <Typography.Text type="secondary">
              {t("login.subtitle")}
            </Typography.Text>
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
            label={t("login.mobile")}
            rules={[{ required: true, message: t("login.mobileRequired") }]}
          >
            <Input
              autoComplete="username"
              prefix={<MobileOutlined />}
              placeholder={t("login.mobile")}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label={t("login.password")}
            rules={[{ required: true, message: t("login.passwordRequired") }]}
          >
            <Input.Password
              autoComplete="current-password"
              prefix={<LockOutlined />}
              placeholder={t("login.password")}
            />
          </Form.Item>
          <Button block htmlType="submit" loading={submitting} type="primary">
            {t("login.submit")}
          </Button>
        </Form>
      </section>
    </main>
  );
}
