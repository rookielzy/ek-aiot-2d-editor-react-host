import { LockOutlined } from "@ant-design/icons";
import { Button, Result } from "antd";

import { runtimeConfig } from "@/config/runtime";
import "./index.css";

export default function LoginPage() {
  return (
    <main className="login-page">
      <Result
        icon={<LockOutlined />}
        title="需要登录"
        subTitle="请通过现有身份服务完成登录后返回编辑器。"
        extra={
          <Button type="primary" href={runtimeConfig.loginUrl}>
            前往登录
          </Button>
        }
      />
    </main>
  );
}
