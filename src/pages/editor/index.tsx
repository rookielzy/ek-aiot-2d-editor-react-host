import { CloudSyncOutlined, FileOutlined } from "@ant-design/icons";
import {
  AGENT_PROTOCOL_VERSION,
  AGENT_TOOL_CATALOG_VERSION,
} from "@ek-aiot/agent-protocol";
import { EditorLayout, EditorMode } from "@ek-aiot/2d-editor-core";
import {
  builtinMaterials,
  createBuiltinMaterials,
  ReactEditorShell,
  type ReactEditorAgentConfigInput,
} from "@ek-aiot/2d-editor-react";
import { Alert, Space, Tag, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { runtimeConfig } from "@/config/runtime";
import { DemoDocumentSession } from "@/domain/demo-document-session";
import { createDemoSessionBridge } from "@/domain/demo-session-bridge";
import { createRestoredEditorController } from "@/domain/revision-controller";
import {
  EN_US_REACT_EDITOR_MESSAGES,
  EN_US_STAGE_UI_MESSAGES,
} from "@/i18n/editor-messages";
import { useLanguage } from "@/i18n/language";
import { bootstrapAgentDocument } from "@/services/agent-bootstrap";
import { createHttpAgentTransport } from "@/services/agent-transport";
import { demoTokenStore, identityClient } from "@/services/identity-client";
import { performProtectedLogout } from "@/services/logout";

import { createDemoDocument } from "./sample-document";
import "./style.css";

const EN_US_MATERIALS = createBuiltinMaterials(
  EN_US_REACT_EDITOR_MESSAGES.materials,
);

export default function EditorPage() {
  const { locale, t } = useLanguage();
  const [diagnostic, setDiagnostic] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [editorMounted, setEditorMounted] = useState(true);
  const [agentBootstrapped, setAgentBootstrapped] = useState(false);
  const translationRef = useRef(t);
  translationRef.current = t;
  const sessionRef = useRef<DemoDocumentSession | undefined>(undefined);
  if (!sessionRef.current) {
    sessionRef.current = DemoDocumentSession.open({
      storage: window.sessionStorage,
      createDocument: createDemoDocument,
    });
  }
  const session = sessionRef.current;
  const initial = useMemo(() => session.snapshot(), [session]);
  const transport = useMemo(
    () =>
      createHttpAgentTransport({
        baseUrl: runtimeConfig.agentBaseUrl,
        onUnauthorized: () => {
          demoTokenStore.clear();
          flushSync(() => setEditorMounted(false));
          window.history.replaceState(window.history.state, "", "/login");
          window.dispatchEvent(new PopStateEvent("popstate"));
        },
      }),
    [],
  );
  const bridge = useMemo(
    () =>
      createDemoSessionBridge({
        persistManualChange: (document, nextRevision) => {
          session.persistManualChange(document, nextRevision);
          setRevision(nextRevision);
        },
        commitAgentDocument: (request) => session.commitAgentDocument(request),
      }),
    [session],
  );
  const controller = useMemo(
    () =>
      createRestoredEditorController({
        initialDocument: initial.document,
        persistedRevision: initial.revision,
      }),
    [initial.document, initial.revision],
  );
  const agent = useMemo<ReactEditorAgentConfigInput | null>(
    () =>
      agentBootstrapped
        ? {
            documentRef: initial.documentRef,
            transport,
            serverCapabilities: {
              protocolVersion: AGENT_PROTOCOL_VERSION,
              toolCatalogVersion: AGENT_TOOL_CATALOG_VERSION,
              capabilities: { rawReasoning: true },
            },
            documentCommitAdapter: bridge,
            onDiagnostic: (event) => setDiagnostic(event.message),
          }
        : null,
    [agentBootstrapped, bridge, initial.documentRef, transport],
  );

  useEffect(() => setRevision(initial.revision), [initial.revision]);
  useEffect(() => {
    let cancelled = false;
    setAgentBootstrapped(false);
    void bootstrapAgentDocument({
      documentRef: initial.documentRef,
      transport,
    })
      .then(() => {
        if (!cancelled) setAgentBootstrapped(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDiagnostic(
            error instanceof Error
              ? error.message
              : translationRef.current("editor.bootstrapFailed"),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initial.documentRef, transport]);
  useEffect(() => {
    const onLogout = () => {
      void performProtectedLogout({
        stopActiveTurn: () => transport.lifecycle.stopActiveTurn(),
        disposeAgent: () => flushSync(() => setEditorMounted(false)),
        clearDemoSession: () => session.clear(),
        logout: () => identityClient.logout(),
        navigateToLogin: () => window.location.replace(identityClient.loginUrl),
      });
    };
    window.addEventListener("host:logout", onLogout);
    return () => window.removeEventListener("host:logout", onLogout);
  }, [session, transport]);

  return (
    <main className="editor-page">
      <header className="document-bar">
        <Space size={10}>
          <FileOutlined />
          <Typography.Text strong>{t("editor.document")}</Typography.Text>
          <Typography.Text type="secondary" copyable>
            {initial.documentRef}
          </Typography.Text>
        </Space>
        <Space size={8}>
          <Tag icon={<CloudSyncOutlined />} color="success">
            {t("editor.saved")}
          </Tag>
          <Typography.Text type="secondary">
            Revision {revision}
          </Typography.Text>
        </Space>
      </header>
      {diagnostic ? (
        <Alert
          banner
          closable
          type="error"
          message={t("editor.agentError")}
          description={diagnostic}
          onClose={() => setDiagnostic(undefined)}
        />
      ) : null}
      <section
        className="editor-workspace"
        aria-label={t("editor.workspaceLabel")}
      >
        {editorMounted ? (
          <ReactEditorShell
            controller={controller}
            mode={EditorMode.EDIT}
            layout={EditorLayout.FULL}
            hotkeys
            materials={locale === "en-US" ? EN_US_MATERIALS : builtinMaterials}
            materialMergeStrategy="append"
            messages={
              locale === "en-US" ? EN_US_REACT_EDITOR_MESSAGES : undefined
            }
            uiMessages={
              locale === "en-US" ? EN_US_STAGE_UI_MESSAGES : undefined
            }
            agent={agent}
            onDocumentChange={bridge.onDocumentChange}
          />
        ) : null}
      </section>
    </main>
  );
}
