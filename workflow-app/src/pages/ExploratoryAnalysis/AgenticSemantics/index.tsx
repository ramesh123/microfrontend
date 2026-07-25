import { useState, useCallback, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import TenantLanding from '../Semantics/TenantLanding';
import SchemaSelection from './SchemaSelection';
import DeploymentScreen from './DeploymentScreen';
import AgenticOnboarding from './AgenticOnboarding';
import ChatWindow from './ChatWindow';
import DomainSelection from './DomainSelection';
import DomainConversations from './DomainConversations';
import WorkspaceChat from './WorkspaceChat';
import type { WorkspaceDomainItem } from '@/controllers/API/semanticsApi';

export type AgenticView =
  | 'tenant-landing'
  | 'domain-selection'
  | 'domain-conversations'
  | 'workspace-chat'
  | 'schema-selection'
  | 'deploying'
  | 'onboarding'
  | 'chat';

export interface TenantInfo {
  tenantId: string;
  displayName: string;
  domainId: string;
}

/** Selected Virtual DB row from GET api/flow-builder (virtualdb_mode workflows). */
export interface VirtualDbSelection {
  flow_id: string;
  deployment_name: string;
  name?: string;
  id?: number;
}

export interface SchemaPayload {
  connectionId: string;
  database: string;
  schemas: { name: string; tables: string[] }[];
  /** Optional business / semantic context (API key: context_text). */
  context_text?: string;
  /** Optional Virtual DB workflow chosen for this semantic run. */
  virtual_db?: VirtualDbSelection;
}

/** Navigation state for `/exploratory-analysis/agentic-run/create` (new workspace chat / dashboard flow). */
export interface AgenticCreateChatLocationState {
  tenantId?: string;
  tenantName?: string;
  domainId?: string;
  domainName?: string;
  /** Prefill + auto-send first message in workspace chat when opening from e.g. deployment chat history. */
  initialUserQuery?: string;
}

export default function AgenticSemantics() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<AgenticView>('tenant-landing');
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<WorkspaceDomainItem | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  /** Cleared after WorkspaceChat consumes it (first new-chat open from /create with `initialUserQuery`). */
  const [workspaceInitialUserQuery, setWorkspaceInitialUserQuery] = useState<string | null>(null);
  const [schemaPayload, setSchemaPayload] = useState<SchemaPayload | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const handleSelectTenant = useCallback((tenantId: string, displayName: string, domainId: string) => {
    setTenant({ tenantId, displayName, domainId });
    setSelectedDomain(null);
    setSelectedConversationId(null);
    setView('domain-selection');
  }, []);

  const handleCreateNew = useCallback(() => {
    // After creation, TenantLanding calls onSelectTenant
  }, []);

  const handleSchemaGenerate = useCallback((payload: SchemaPayload) => {
    setSchemaPayload(payload);
    setView('deploying');
  }, []);

  const handleSchemaSkip = useCallback((payload: SchemaPayload) => {
    setSchemaPayload(payload);
    setView('deploying');
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setView('chat');
  }, []);

  const handleBackToTenants = useCallback(() => {
    setTenant(null);
    setSelectedDomain(null);
    setSelectedConversationId(null);
    setSchemaPayload(null);
    setRunId(null);
    setView('tenant-landing');
  }, []);

  const handleDomainReady = useCallback((domain: WorkspaceDomainItem) => {
    setSelectedDomain(domain);
    setSelectedConversationId(null);
    setView('domain-conversations');
  }, []);

  const handleDomainSetupRequired = useCallback((domain: WorkspaceDomainItem) => {
    setSelectedDomain(domain);
    setTenant((prev) => (prev ? { ...prev, domainId: domain.domain_id } : null));
    setSelectedConversationId(null);
    setSchemaPayload(null);
    setRunId(null);
    setView('schema-selection');
  }, []);

  const handleBackToDomains = useCallback(() => {
    setSelectedDomain(null);
    setSelectedConversationId(null);
    setView('domain-selection');
  }, []);

  const handleBackToConversations = useCallback(() => {
    setSelectedConversationId(null);
    setView('domain-conversations');
  }, []);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setView('workspace-chat');
  }, []);

  const handleConversationCreated = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
  }, []);

  const handleDeployComplete = useCallback((newRunId: string) => {
    setRunId(newRunId);
    setView('onboarding');
  }, []);

  const handleBackToSchema = useCallback(() => {
    setRunId(null);
    setView('schema-selection');
  }, []);

  const handleOpenInsights = useCallback(() => {
    navigate('/exploratory-analysis/insights', {
      state: tenant
        ? { tenantId: tenant.tenantId, tenantName: tenant.displayName }
        : {},
    });
  }, [navigate, tenant]);

  const isCreateChatPath = location.pathname.endsWith('/exploratory-analysis/agentic-run/create');

  useLayoutEffect(() => {
    if (!isCreateChatPath) return;
    const s = location.state as AgenticCreateChatLocationState | null;
    if (s?.tenantId && s?.domainId) {
      setTenant({
        tenantId: s.tenantId,
        displayName: s.tenantName ?? s.tenantId,
        domainId: s.domainId,
      });
      setSelectedDomain({
        domain_id: s.domainId,
        display_name: s.domainName ?? s.domainId,
      });
      setSelectedConversationId(null);
      const q = typeof s.initialUserQuery === 'string' ? s.initialUserQuery.trim() : '';
      setWorkspaceInitialUserQuery(q.length > 0 ? q : null);
      setView('workspace-chat');
    } else if (s?.tenantId) {
      setTenant({
        tenantId: s.tenantId,
        displayName: s.tenantName ?? s.tenantId,
        domainId: '',
      });
      setSelectedDomain(null);
      setSelectedConversationId(null);
      setWorkspaceInitialUserQuery(null);
      setView('domain-selection');
    }
    navigate('/exploratory-analysis/agentic-run', { replace: true });
  }, [isCreateChatPath, location.state, navigate]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      {view === 'tenant-landing' && (
        <TenantLanding
          onSelectTenant={handleSelectTenant}
          onCreateNew={handleCreateNew}
        />
      )}
      {view === 'domain-selection' && tenant && (
        <DomainSelection
          tenant={tenant}
          onBack={handleBackToTenants}
          onDomainReady={handleDomainReady}
          onDomainSetupRequired={handleDomainSetupRequired}
        />
      )}
      {view === 'domain-conversations' && selectedDomain && tenant && (
        <DomainConversations
          tenant={tenant}
          domain={selectedDomain}
          onBack={handleBackToDomains}
          onSelectConversation={handleSelectConversation}
        />
      )}
      {view === 'workspace-chat' && selectedDomain && tenant && (
        <WorkspaceChat
          tenant={tenant}
          domain={selectedDomain}
          conversationId={selectedConversationId}
          initialUserQuery={workspaceInitialUserQuery}
          onInitialUserQueryConsumed={() => setWorkspaceInitialUserQuery(null)}
          onBackToConversations={handleBackToConversations}
          onConversationCreated={handleConversationCreated}
        />
      )}
      {view === 'schema-selection' && tenant && (
        <SchemaSelection
          tenant={tenant}
          onGenerate={handleSchemaGenerate}
          onSkipDeploy={handleSchemaSkip}
          onBack={handleBackToTenants}
        />
      )}
      {view === 'deploying' && tenant && schemaPayload && (
        <DeploymentScreen
          tenant={tenant}
          schemaPayload={schemaPayload}
          onComplete={handleDeployComplete}
        />
      )}
      {view === 'onboarding' && tenant && runId && schemaPayload && (
        <AgenticOnboarding
          tenant={tenant}
          runId={runId}
          schemaPayload={schemaPayload}
          onComplete={handleOnboardingComplete}
          onSkip={() => setView('chat')}
        />
      )}
      {view === 'chat' && tenant && runId && (
        <ChatWindow
          tenant={tenant}
          runId={runId}
          onBackToSchema={handleBackToSchema}
        />
      )}
    </div>
  );
}
