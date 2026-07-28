"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Plus, Send, Loader2, History, Folder, Search, Trash2, Upload, Paperclip, Pencil, Check, SquarePen, User, ChevronDown, Lock, ChevronRight, MessageSquarePlus, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import {
  compileUserRequestApi,
  resumeUserRequestApi,
  CompileUserRequestResponse,
  ConversationState,
  getAllConversationsApi,
  getLatestChatHistoryApi,
  deleteChatHistoryApi,
  Clarification,
  ClarificationNode,
  UploadedFile
} from "@/controllers/API/orchestrationApi";
import { convertAITemplateToFlow } from "@/utils/aiFlowTemplateUtils";
import useFlowStore from "@/stores/flowStore";
import { toast } from "sonner";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { prefetchNodeIconsForWorkflow } from "@/utils/styleUtils";
import { fetchProjectsApi, getWorkflowByIdApi, updateWorkflow } from "@/controllers/API";
import { useRbacStore } from "@/stores/useRBACStore";
import { useNavigate } from "react-router-dom";
import api from "@/controllers/API/api";
import {
  generateAiPredicate,
  resumeAiPredicate,
  type TableContext,
  type ConversationState as PredicateConversationState
} from "@/components/common/FilterOperations/aiPredicateApi";
import {
  compileJoinRequest,
  resumeJoinRequest,
  isSuccessResponse as isJoinSuccessResponse,
  isClarificationResponse as isJoinClarificationResponse
} from "@/components/common/enrichColumns/joinRequestApi";
import {
  compileNwayMatchRequest,
  resumeNwayMatchRequest,
  isSuccessResponse as isNwayMatchSuccessResponse,
  isClarificationResponse as isNwayMatchClarificationResponse
} from "@/components/common/nway-matching/nwayMatchRequestApi";
import { formatDateToIST, formatTimeToIST } from "@/utils/formatters";
import { AlternativeSelect } from "@/components/ui/alternative-select";
import { Level2Clarification } from "./components/Level2Clarification";
import { WorkflowDropdownMenu } from "./components/AiChatbox";
import { JoinColumnSelection } from "./components/JoinColumnSelection";
import { NwayMatchClarificationSelection } from "./components/NwayMatchClarificationSelection";
import { MentionTextarea } from "@/components/common/FilterOperations/MentionTextarea";

interface AiChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'PIPELINE' | 'PREDICATE' | 'JOIN' | 'NWAY_MATCH';
  onCodeGenerated?: (code: string) => void; // For PREDICATE/JOIN/NWAY_MATCH mode
  tableContext?: TableContext; // For PREDICATE/NWAY_MATCH mode - table schema and data
  sourceContext?: any; // For JOIN mode - source table context
  targetContext?: any; // For JOIN mode - target table context
  sources?: any[]; // For NWAY_MATCH mode - array of source node contexts
  initialQuestion?: string; // For PREDICATE/JOIN/NWAY_MATCH mode - initial clarification question
  initialOptions?: { [key: string]: any }; // For PREDICATE/JOIN/NWAY_MATCH mode - initial options
  initialMissingFields?: Array<{ rule_id: string; match_id: string; field: string }>; // For NWAY_MATCH mode
  initialMissingColumns?: string[]; // For PREDICATE mode
  initialUserRequest?: string; // For PREDICATE/JOIN/NWAY_MATCH mode - user's original request
  initialConversationId?: string; // For PREDICATE/JOIN/NWAY_MATCH mode - conversation ID from initial response
  initialEventId?: string; // For PREDICATE/JOIN/NWAY_MATCH mode - event ID from initial response
  onSubmitAnswer?: (answer: { columns: { [key: string]: string } }) => void; // For PREDICATE/JOIN/NWAY_MATCH mode
  withoutDialog?: boolean; // If true, renders without Dialog wrapper (e.g. for Sheet overlay)
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system' | 'error';
  content: string;
  timestamp: string;
  data?: {
    type: 'options' | 'success' | 'error' | 'level2_clarification' | 'nway_match_clarification';
    options?: { [key: string]: string[] } | any; // Can be standard options or N-way match options structure
    missing_fields?: Array<{ rule_id: string; match_id: string; field: string }>; // For N-way match clarifications
    selectedAnswers?: { [key: string]: string } | any; // Pre-selected answers from history
    errorMessage?: string;
    clarification?: Clarification; // For level-2 clarification
    nodeRef?: any; // Node reference for level-2 clarification
  };
}

// Module-level: survives component remounts (e.g. when workflow updates on save-as-draft)
let _hasSentInitialCompileThisSession = false;

// Layout configuration for node positioning
const LAYOUT_CONFIG = {
  NODE_WIDTH: 210,
  NODE_HEIGHT: 100,
  HORIZONTAL_SPACING: 80,  // Reduced from 40 for even shorter edges
  VERTICAL_SPACING: 50,    // Reduced from 30 for tighter vertical spacing
  START_X: 100,
  START_Y: 100,
};

// Helper function to recalculate node positions using hierarchical layout
function recalculateNodePositions(nodes: any[], edges: any[]): { nodes: any[]; viewport: any } { 
  // Build adjacency lists
  const outgoingEdges = new Map<string, string[]>();
  const incomingEdges = new Map<string, string[]>();

  nodes.forEach((node) => { 
    outgoingEdges.set(node.id, []);
    incomingEdges.set(node.id, []);
  });

  edges.forEach((edge) => {  
    const source = edge.source;
    const target = edge.target;
    if (source && target) { 
      outgoingEdges.get(source)?.push(target);
      incomingEdges.get(target)?.push(source);
    }
  });
  // Find root nodes (nodes with no incoming edges)
  const nodeIds = nodes.map((n) => n.id);
  const rootNodes = nodeIds.filter((id) => !incomingEdges.get(id)?.length);
  // If no root nodes, use the first node
  if (rootNodes.length === 0 && nodes.length > 0) {  
    rootNodes.push(nodes[0].id);
  }
  // Assign levels using BFS
  const nodeToLevel = new Map<string, number>();
  const levelToNodes = new Map<number, string[]>();
  const visited = new Set<string>();

  const queue: Array<{ nodeId: string; level: number }> = rootNodes.map((id) => ({ 
    nodeId: id,
    level: 0,
  }));

  while (queue.length > 0) {   
    const { nodeId, level } = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    nodeToLevel.set(nodeId, level);
    if (!levelToNodes.has(level)) {  
      levelToNodes.set(level, []);
    }
    levelToNodes.get(level)?.push(nodeId);

    // Add children to queue
    const children = outgoingEdges.get(nodeId) || [];
    children.forEach((childId) => {  
      if (!visited.has(childId)) {
        queue.push({ nodeId: childId, level: level + 1 });
      }
    });
  }
  // Handle disconnected nodes
  const maxLevel = Math.max(...Array.from(levelToNodes.keys()), -1);
  nodes.forEach((node) => { 
    if (!visited.has(node.id)) { 
      const level = maxLevel + 1;
      nodeToLevel.set(node.id, level);
      if (!levelToNodes.has(level)) {
        levelToNodes.set(level, []);
      }
      levelToNodes.get(level)?.push(node.id);
    }
  });

  // Calculate positions
  const nodeIdToPosition = new Map<string, { x: number; y: number }>();

  levelToNodes.forEach((nodeIdsInLevel, level) => {  
    const x =
      LAYOUT_CONFIG.START_X +
      level * (LAYOUT_CONFIG.NODE_WIDTH + LAYOUT_CONFIG.HORIZONTAL_SPACING);

    nodeIdsInLevel.forEach((nodeId, idx) => {
      const y =
        LAYOUT_CONFIG.START_Y +
        idx * (LAYOUT_CONFIG.NODE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING);
      nodeIdToPosition.set(nodeId, { x, y });
    });
  });

  // Apply new positions to nodes
  const repositionedNodes = nodes.map((node) => ({
    ...node,
    position: nodeIdToPosition.get(node.id) || { x: 0, y: 0 },
  }));

  // Calculate optimal viewport with left alignment and 75% zoom
  const allX = repositionedNodes.map((n) => n.position.x);
  const allY = repositionedNodes.map((n) => n.position.y);

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX.map((x, i) => x + LAYOUT_CONFIG.NODE_WIDTH));
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY.map((y, i) => y + LAYOUT_CONFIG.NODE_HEIGHT));

  // Set zoom to 80% and let ReactFlow handle positioning naturally
  const viewport = {
    x: 0,
    y: 0,
    zoom: 0.8,
  };

  return { nodes: repositionedNodes, viewport };
}

// Helper function to calculate optimal viewport for workflow display
// Sets 80% zoom and lets ReactFlow handle positioning naturally
function calculateOptimalViewport(nodes: any[]): { x: number; y: number; zoom: number } {
  return { x: 0, y: 0, zoom: 0.8 };
}

export function AiChatDialog({
  open,
  onOpenChange,
  mode = 'PIPELINE',
  onCodeGenerated,
  tableContext,
  sourceContext,
  targetContext,
  sources,
  initialQuestion,
  initialOptions,
  initialMissingFields,
  initialMissingColumns,
  initialUserRequest,
  initialConversationId,
  initialEventId,
  withoutDialog = false,
}: AiChatDialogProps) {
  const [showWorkflowDropdown, setShowWorkflowDropdown] = React.useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = React.useState(false);
  const [showWorkflowsDropdown, setShowWorkflowsDropdown] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [conversationState, setConversationState] = React.useState<ConversationState | null>(null);
  const [selectedOptions, setSelectedOptions] = React.useState<{ [key: string]: string | string[] }>({});
  const [customInputValues, setCustomInputValues] = React.useState<{ [key: string]: string }>({});
  const [currentQuestion, setCurrentQuestion] = React.useState<string | null>(null);
  const [currentQuestionOptions, setCurrentQuestionOptions] = React.useState<{ [key: string]: string[] } | null>(null);
  const [currentEventId, setCurrentEventId] = React.useState<string | null>(null);
  const [workflowSearchQuery, setWorkflowSearchQuery] = React.useState("");
  const [debouncedWorkflowSearchQuery, setDebouncedWorkflowSearchQuery] = React.useState("");
  const [conversations, setConversations] = React.useState<any[]>([]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWorkflowSearchQuery(workflowSearchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [workflowSearchQuery]);
  const [currentConversationId, setCurrentConversationId] = React.useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [deletingConversationId, setDeletingConversationId] = React.useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const editDebounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Level-2 clarification state
  const [currentClarification, setCurrentClarification] = React.useState<Clarification | null>(null);
  const [clarificationNodes, setClarificationNodes] = React.useState<ClarificationNode[]>([]);
  const [nodeConfigAnswers, setNodeConfigAnswers] = React.useState<{ [key: string]: any }>({});
  const [nodeConfigLabels, setNodeConfigLabels] = React.useState<{ [key: string]: string }>({});
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([]);

  // N-way match clarification state
  const [nwayMatchClarificationAnswers, setNwayMatchClarificationAnswers] = React.useState<{
    [ruleId: string]: {
      [matchId: string]: {
        left_column?: string;
        right_column?: string;
      };
    };
  }>({});

  // Prompt-level uploaded files (files uploaded while typing the initial prompt)
  const [promptUploadedFiles, setPromptUploadedFiles] = React.useState<UploadedFile[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const MIN_TEXTAREA_HEIGHT = 100; // Minimum height in pixels (~2 lines)
  const MAX_TEXTAREA_HEIGHT = 300; // Maximum height before scrolling
  const [textareaHeight, setTextareaHeight] = React.useState(MIN_TEXTAREA_HEIGHT);
  
  // Store the latest API response to access node templates
  const [apiResponse, setApiResponse] = React.useState<CompileUserRequestResponse | null>(null);
  const currentWorkflow = useFlowStore((state) => state.currentWorkflow);
  const setCurrentWorkflow = useFlowStore((state) => state.setCurrentWorkflow);

  const navigate = useNavigate();
  const currentUser = useRbacStore((state) => state.currentUser);
  const activePerspective = useRbacStore((state) => state.activePerspective);
  const [workflows, setWorkflows] = React.useState<any[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = React.useState(false);
  const [showRenameDropdown, setShowRenameDropdown] = React.useState(false);
  const [renameWorkflowValue, setRenameWorkflowValue] = React.useState("");
  const [isSavingRename, setIsSavingRename] = React.useState(false);
  const skipLoadConversationsOnceRef = React.useRef(false);
  // For PIPELINE mode: when coming from landing page with initialQuestion, show prompt and call compileUserRequestApi
  // Only run once per session - never re-run when workflow updates (e.g. after save-as-draft).
  // Use module-level guard so it survives component remounts. Skip when save-as-draft is in progress.
  React.useEffect(() => {
    if (
      mode !== 'PIPELINE' ||
      !open ||
      !initialQuestion ||
      !currentWorkflow?.flow_id ||
      _hasSentInitialCompileThisSession ||
      useFlowStore.getState().isSavingDraft
    ) {
      return;
    }
    _hasSentInitialCompileThisSession = true;

    const runInitialPrompt = async () => {
      addMessage('user', initialQuestion!);
      setIsLoading(true);
      try {
        const payload: any = {
          user_request: initialQuestion!,
          flow_id: currentWorkflow!.flow_id,
          conversation_id: null
        };
        const response: CompileUserRequestResponse = await compileUserRequestApi(payload);
        await handleApiResponse(response);
      } catch (error: any) {
        console.error('Error compiling initial user request:', error);
        addMessage('error', 'Failed to process your request. Please try again.', {
          type: 'error',
          errorMessage: error.message || 'Unknown error occurred.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    runInitialPrompt();
  }, [open, mode, initialQuestion, currentWorkflow?.flow_id]);

  // Reset module-level guard when dialog closes so it can run again if user re-opens
  React.useEffect(() => {
    if (!open) {
      _hasSentInitialCompileThisSession = false;
    }
  }, [open]);

  // Handle initial clarification data from HorizontalAiPanel
  React.useEffect(() => {
    if (open && initialQuestion && initialOptions) {
      // Store conversation_id and event_id
      if (initialConversationId) {
        setCurrentConversationId(initialConversationId);
      }
      if (initialEventId) {
        setCurrentEventId(initialEventId);
      }

      // Set clarification state
      setCurrentQuestion(initialQuestion);
      setCurrentQuestionOptions(initialOptions);
      setSelectedOptions({});
      setCustomInputValues({});

      const messagesToAdd: ChatMessage[] = [];

      // Add user's initial request message if provided
      if (initialUserRequest) {
        messagesToAdd.push({
          id: `user-request-${Date.now()}`,
          type: 'user',
          content: initialUserRequest,
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      }

      // Add AI clarification message
      // For NWAY_MATCH mode, use nway_match_clarification type with missing_fields
      const isNwayMatchMode = mode === 'NWAY_MATCH';
      console.log('[AICHAT INIT] mode:', mode, 'isNwayMatchMode:', isNwayMatchMode);
      console.log('[AICHAT INIT] initialOptions:', initialOptions);
      console.log('[AICHAT INIT] initialMissingFields:', initialMissingFields);

      const clarificationMessage: ChatMessage = {
        id: `clarification-${Date.now()}`,
        type: 'ai',
        content: initialQuestion,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        data: isNwayMatchMode ? {
          type: 'nway_match_clarification',
          options: initialOptions,
          missing_fields: initialMissingFields || []
        } : {
          type: 'options',
          options: initialOptions
        }
      };
      console.log('[AICHAT INIT] Created clarification message:', clarificationMessage);
      messagesToAdd.push(clarificationMessage);

      setMessages(messagesToAdd);
    }
  }, [open, initialQuestion, initialOptions, initialMissingFields, initialUserRequest, initialConversationId, initialEventId, mode]);

  const suggestionChips = [
    "Read CSV and PostgreSQL, join and filter data",
    "Create a data transformation pipeline",
    "Build ETL workflow with validation",
    "Setup data export to database"
  ];

  const suggestionChipsPredicate = [
    "Filter rows where status is active",
    "Convert column to uppercase",
    "Join two dataframes on id column",
    "Remove duplicate rows"
  ];

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {  
    scrollToBottom();
  }, [messages]);

  // Helper functions defined before useEffect hooks
  const loadConversations = React.useCallback(async () => {
    if (!currentWorkflow?.flow_id || !currentUser?.email) return;

    try {
      const response = await getAllConversationsApi({
        flow_id: currentWorkflow.flow_id,
        mode: mode,
        user_name: currentUser.email
      });

      const conversationMap = response?.conversation_map || [];
      setConversations(conversationMap);

      // Load latest conversation if available
      if (conversationMap.length > 0) {
        const latestConversation = conversationMap[0]; // First one is latest
        setCurrentConversationId(latestConversation.conversation_id);
        await loadChatHistory(latestConversation.conversation_id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      // Don't show error toast, just continue with empty state
    }
  }, [currentWorkflow?.flow_id, currentUser?.email, mode]);

  const loadChatHistory = React.useCallback(async (conversationId: string) => {
    if (!currentWorkflow?.flow_id || !currentUser?.email) return;

    setIsLoadingHistory(true);
    try {
      const response = await getLatestChatHistoryApi({
        flow_id: currentWorkflow.flow_id,
        mode: mode,
        user_name: currentUser.email,
        conversation_id: conversationId,
        limit: 5
      });

      const events = response?.events || [];

      // Convert events to chat messages (reverse to show oldest first, newest last)
      const chatMessages: ChatMessage[] = [];
      let lastUserRequest = '';

      events.reverse().forEach((event: any) => {
        // Only add user request if it's different from the last one (avoid duplicates)
        if (event.user_request !== lastUserRequest) {
          chatMessages.push({
            id: `${event.event_id}-user`,
            type: 'user',
            content: event.user_request,
            timestamp: formatTimeToIST(event.timestamp)
          });
          lastUserRequest = event.user_request;
        }

        // Add AI response
        const response = event.response;
        if (response.status === 'needs_clarification') {
          // Check if this is level-2 clarification (missing fields) or level-1 (options)
          const hasLevel2Clarification = response.clarification && response.clarification.missing_fields && response.clarification.missing_fields.length > 0;
          
          if (hasLevel2Clarification) {
            // Level-2 clarification: missing configuration fields
            const answers = response.answers || {};
            
            chatMessages.push({
              id: `${event.event_id}-ai`,
              type: 'ai',
              content: response.clarification.question || 'Please provide the missing configuration values.',
              timestamp: formatTimeToIST(event.timestamp),
              data: {
                type: 'level2_clarification',
                clarification: response.clarification,
                nodeRef: response.clarification.node_ref,
                selectedAnswers: answers.config || {} // Pre-filled answers for level-2
              }
            });
          } else if (response.missing_fields && response.options && mode === 'NWAY_MATCH') {
            // N-way match clarification: column matching
            const selectedAnswers = response.answers || {};

            chatMessages.push({
              id: `${event.event_id}-ai`,
              type: 'ai',
              content: response.question || 'Please match the columns for N-way matching.',
              timestamp: formatTimeToIST(event.timestamp),
              data: {
                type: 'nway_match_clarification',
                options: response.options,
                missing_fields: response.missing_fields,
                selectedAnswers: selectedAnswers
              }
            });
          } else {
            // Level-1 clarification: options-based
            const selectedAnswers = response.answers || {};

            chatMessages.push({
              id: `${event.event_id}-ai`,
              type: 'ai',
              content: response.question || response.questions || 'I need more information.',
              timestamp: formatTimeToIST(event.timestamp),
              data: {
                type: 'options',
                options: response.options,
                selectedAnswers: selectedAnswers // Pass selected answers to pre-check options
              }
            });
          }
        } else if (response.status === 'ok') {
          const message = mode === 'PREDICATE'
            ? response.message || 'Code generated successfully!'
            : mode === 'NWAY_MATCH'
            ? response.message || 'N-way match configuration generated successfully!'
            : response.message || 'Workflow generated successfully!';

          chatMessages.push({
            id: `${event.event_id}-ai`,
            type: 'system',
            content: message,
            timestamp: formatTimeToIST(event.timestamp),
            data: {
              type: 'success'
            }
          });

          // NOTE: Do NOT call onCodeGenerated here - we are only viewing chat history,
          // not applying the filters to the node. Filters should only be added when
          // a new response is generated from user input.
        } else if (response.status === 'unsupported' || response.status === 'error') {
          chatMessages.push({
            id: `${event.event_id}-ai`,
            type: 'error',
            content: response.message || 'An error occurred.',
            timestamp: formatTimeToIST(event.timestamp),
            data: {
              type: 'error',
              errorMessage: response.message
            }
          });
        }
      });

      setMessages(chatMessages);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading chat history:', error);
      toast.error('Failed to load chat history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentWorkflow?.flow_id, currentUser?.email, mode]);

  // Load all-conversations and latest-history when dialog opens (to show chat history in AI chat box)
  // Skip when: version select just ran, or we have initialQuestion/initialOptions (compile or clarification flow will run instead)
  React.useEffect(() => {
    if (skipLoadConversationsOnceRef.current) {
      skipLoadConversationsOnceRef.current = false;
      return;
    }
    if (useFlowStore.getState().skipAiChatLoadConversationsOnce) {
      useFlowStore.getState().setSkipAiChatLoadConversationsOnce(false);
      return;
    }
    if (open && currentWorkflow?.flow_id && currentUser?.email && !initialQuestion && !initialOptions) {
      loadConversations(); // calls all-conversations, then latest-history for latest conversation
    }
  }, [open, currentWorkflow?.flow_id, currentUser?.email, mode, loadConversations, initialQuestion, initialOptions]);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setMessages([]);
      setInputValue("");
      setConversationState(null);
      setSelectedOptions({});
      setCustomInputValues({});
      setCurrentQuestion(null);
      setCurrentQuestionOptions(null);
      setCurrentEventId(null);
      setCurrentClarification(null);
      setClarificationNodes([]);
      setNodeConfigAnswers({});
      setNodeConfigLabels({});
      setUploadedFiles([]);
      setPromptUploadedFiles([]);
      setShowWorkflowDropdown(false);
      setShowHistoryDropdown(false);
      setShowWorkflowsDropdown(false);
      setShowRenameDropdown(false);
      setRenameWorkflowValue("");
    }
  }, [open]);

  // Close workflow dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showWorkflowDropdown && !target.closest('[data-workflow-dropdown]')) {
        setShowWorkflowDropdown(false);
      }
    };

    if (showWorkflowDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showWorkflowDropdown]);

  // Don't add greeting as a message - let the JSX render it with suggestion chips

  const addMessage = (type: 'user' | 'ai' | 'system' | 'error', content: string, data?: any) => {
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      data,
    };
    console.log('[ADD MESSAGE] Adding message:', newMessage);
    console.log('[ADD MESSAGE] Message data:', data);
    setMessages((prev) => [...prev, newMessage]);
  };

  // Animate workflow rendering with nodes appearing left to right and edges growing
  const animateWorkflowRendering = async (nodes: any[], edges: any[], viewport: any) => {
    if (!currentWorkflow) return;

    // CRITICAL: Preload all node icons BEFORE starting any animation
    // This ensures icons are loaded and ready to display when nodes appear
    await prefetchNodeIconsForWorkflow(nodes);

    // Sort nodes by their x position (left to right)
    const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x);

    // Group nodes by their x position (same column)
    const nodesByColumn = new Map<number, any[]>();
    sortedNodes.forEach(node => {
      const x = Math.round(node.position.x / 50) * 50; // Group nodes in same column
      if (!nodesByColumn.has(x)) {
        nodesByColumn.set(x, []);
      }
      nodesByColumn.get(x)!.push(node);
    });

    // Get existing nodes and edges
    const existingNodes = currentWorkflow.data?.nodes || [];
    const existingEdges = currentWorkflow.data?.edges || [];

    // Animate nodes column by column (left to right)
    const columns = Array.from(nodesByColumn.entries()).sort((a, b) => a[0] - b[0]);
    let accumulatedNodes = [...existingNodes];
    let accumulatedEdges = [...existingEdges];

    // First, set the viewport immediately
    setCurrentWorkflow({
      ...currentWorkflow,
      data: {
        ...currentWorkflow.data,
        nodes: existingNodes,
        edges: existingEdges,
        viewport: viewport
      }
    });

    // Shorter delay since icons are already preloaded
    await new Promise(resolve => setTimeout(resolve, 150));

    for (let i = 0; i < columns.length; i++) {
      const [_, columnNodes] = columns[i];

      // Add nodes from this column with animation class
      const nodesWithAnimation = columnNodes.map(node => ({
        ...node,
        className: 'node-pop-animation', // Add CSS class for animation
        data: {
          ...node.data,
          animated: true // Flag to trigger CSS animation
        }
      }));

      accumulatedNodes = [...accumulatedNodes, ...nodesWithAnimation];

      // Update workflow with new nodes first
      setCurrentWorkflow({
        ...currentWorkflow,
        data: {
          ...currentWorkflow.data,
          nodes: accumulatedNodes,
          edges: accumulatedEdges,
          viewport: viewport
        }
      });

      // Reduced wait time for smoother animation (matches CSS animation duration)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now add edges that connect to newly added nodes
      const renderedNodeIds = new Set(accumulatedNodes.map(n => n.id));
      const newEdges = edges.filter(edge =>
        renderedNodeIds.has(edge.source) && renderedNodeIds.has(edge.target)
      );

      // Only add edges that aren't already in accumulatedEdges
      const existingEdgeIds = new Set(accumulatedEdges.map(e => e.id));
      const edgesToAdd = newEdges.filter(e => !existingEdgeIds.has(e.id));

      // Add edges with animation flag
      const edgesWithAnimation = edgesToAdd.map(edge => ({
        ...edge,
        animated: true, // This will trigger edge animation
        data: {
          ...edge.data,
          animated: true
        }
      }));

      accumulatedEdges = [...accumulatedEdges, ...edgesWithAnimation];

      // Update workflow with edges
      setCurrentWorkflow({
        ...currentWorkflow,
        data: {
          ...currentWorkflow.data,
          nodes: accumulatedNodes,
          edges: accumulatedEdges,
          viewport: viewport
        }
      });

      // Reduced edge animation delay for smoother flow
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    // Final update to ensure all edges are included and remove animation flags
    const finalNodes = [...existingNodes, ...nodes.map(n => ({
      ...n,
      className: '', // Remove animation class
      data: { ...n.data, animated: false }
    }))];

    const finalEdges = [...existingEdges, ...edges.map(e => ({
      ...e,
      animated: false,
      data: { ...e.data, animated: false }
    }))];

    setCurrentWorkflow({
      ...currentWorkflow,
      data: {
        ...currentWorkflow.data,
        nodes: finalNodes,
        edges: finalEdges,
        viewport: viewport
      }
    });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    addMessage('user', userMessage);

    // For PREDICATE mode
    if (mode === 'PREDICATE') {
      if (!tableContext) {
        addMessage('error', 'No table context available for filter generation.', {
          type: 'error',
          errorMessage: 'Table context is required for PREDICATE mode.'
        });
        return;
      }

      setIsLoading(true);

      try {
        const response = await generateAiPredicate({
          table_context: tableContext,
          user_request: userMessage,
          conversation_id: currentConversationId || null,
          flow_id: currentWorkflow?.flow_id || '',
          execute: true,
          max_rows: 10
        });

        await handlePredicateResponse(response);
      } catch (error: any) {
        console.error('Error generating predicate:', error);
        addMessage('error', 'Failed to generate filter code. Please try again.', {
          type: 'error',
          errorMessage: error.message || 'Unknown error occurred.'
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // For JOIN mode
    if (mode === 'JOIN') {
      if (!sourceContext || !targetContext) {
        addMessage('error', 'Source and target table contexts are required for join configuration.', {
          type: 'error',
          errorMessage: 'Both source and target contexts are required for JOIN mode.'
        });
        return;
      }

      if (!currentUser?.email) {
        addMessage('error', 'User email not found. Please log in again.', {
          type: 'error',
          errorMessage: 'User authentication required.'
        });
        return;
      }

      setIsLoading(true);

      try {
        const response = await compileJoinRequest({
          conversation_id: currentConversationId || '',
          user_request: userMessage,
          flow_id: currentWorkflow?.flow_id || '',
          source_context: sourceContext,
          target_context: targetContext,
          execute: true,
          user_name: currentUser.email,
          max_rows: 10
        });

        await handleJoinResponse(response);
      } catch (error: any) {
        console.error('Error generating join configuration:', error);
        addMessage('error', 'Failed to generate join configuration. Please try again.', {
          type: 'error',
          errorMessage: error.message || 'Unknown error occurred.'
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // For NWAY_MATCH mode
    if (mode === 'NWAY_MATCH') {
      if (!tableContext) {
        addMessage('error', 'Source contexts are required for N-way matching configuration.', {
          type: 'error',
          errorMessage: 'Source contexts are required for NWAY_MATCH mode.'
        });
        return;
      }

      if (!currentUser?.email) {
        addMessage('error', 'User email not found. Please log in again.', {
          type: 'error',
          errorMessage: 'User authentication required.'
        });
        return;
      }

      setIsLoading(true);

      try {
        // Helper function to detect data type
        const detectType = (value: any): string => {
          if (value === null || value === undefined) return 'Utf8';
          const valueType = typeof value;
          if (valueType === 'number') {
            return Number.isInteger(value) ? 'Int64' : 'Float64';
          }
          if (valueType === 'boolean') return 'Boolean';
          const dateStr = String(value);
          if (!isNaN(Date.parse(dateStr)) && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            return 'Datetime';
          }
          return 'Utf8';
        };

        // Prepare source contexts for API request
        const prepareSourceContexts = () => {
          console.log('[NWAY DEBUG] prepareSourceContexts called');
          console.log('[NWAY DEBUG] sources:', sources);
          console.log('[NWAY DEBUG] sources length:', sources?.length);
          
          if (!sources || sources.length === 0) {
            console.warn('[NWAY DEBUG] No sources available!');
            return [];
          }
          
          return sources.map((source, index) => {
            const sourceNode = source as any;
            console.log(`[NWAY DEBUG] Processing source ${index}:`, sourceNode);
            
            if (!sourceNode?.data?.node?.output) {
              console.warn(`[NWAY DEBUG] Source ${index} missing data.node.output`);
              return null;
            }

            let data: any[] = [];
            let columns: string[] = [];

            if (sourceNode.data.node.output.data) {
              data = sourceNode.data.node.output.data;
              columns = sourceNode.data.node.output.columns || [];
            }

            if (!data || !Array.isArray(data) || data.length === 0) {
              console.warn(`[NWAY DEBUG] Source ${index} has no data`);
              return null;
            }

            if (!columns || columns.length === 0) {
              const firstRow = data[0];
              columns = firstRow ? Object.keys(firstRow) : [];
            }

            const sampleRow = data[0] || {};
            const schema = columns.map((column: string) => ({
              column: column,
              type: detectType(sampleRow[column])
            }));

            const result = {
              source_name: sourceNode.data.display_name || sourceNode.id,
              schema,
              data: [sampleRow]
            };
            
            console.log(`[NWAY DEBUG] Source ${index} prepared:`, result);
            return result;
          }).filter(Boolean);
        };

        const sourceContexts = prepareSourceContexts();
        console.log('[NWAY DEBUG] Final sourceContexts:', sourceContexts);
        
        const response = await compileNwayMatchRequest({
          conversation_id: currentConversationId || '',
          user_request: userMessage,
          flow_id: currentWorkflow?.flow_id || '',
          sources: sourceContexts,
          execute: true,
          user_name: currentUser.email,
          max_rows: 10
        });

        await handleNwayMatchResponse(response);
      } catch (error: any) {
        console.error('Error generating N-way match configuration:', error);
        addMessage('error', 'Failed to generate N-way match configuration. Please try again.', {
          type: 'error',
          errorMessage: error.message || 'Unknown error occurred.'
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // For PIPELINE mode
    // Check if we have a flow_id
    if (!currentWorkflow?.flow_id) {
      addMessage('error', 'Please open or create a workflow first.', {
        type: 'error',
        errorMessage: 'No active workflow found.'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use currentConversationId if available, otherwise null to create new conversation
      const payload: any = {
        user_request: userMessage,
        flow_id: currentWorkflow.flow_id,
        conversation_id: currentConversationId || null
      };

      // Add uploaded files if any
      if (promptUploadedFiles.length > 0) {
        payload.uploaded_files = promptUploadedFiles;
      }

      const response: CompileUserRequestResponse = await compileUserRequestApi(payload);

      // Clear prompt uploaded files after successful request
      setPromptUploadedFiles([]);

      await handleApiResponse(response);
    } catch (error: any) {
      console.error('Error compiling user request:', error);
      addMessage('error', 'Failed to process your request. Please try again.', {
        type: 'error',
        errorMessage: error.message || 'Unknown error occurred.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiResponse = async (response: CompileUserRequestResponse) => {
    // Store the response for accessing node templates in level 2 clarification
    setApiResponse(response);
    
    // Store conversation_id and event_id for future requests
    if (response.conversation_id) {
      setCurrentConversationId(response.conversation_id);
      setConversationState(prev => ({
        ...prev,
        conversation_id: response.conversation_id!,
        user_request: prev?.user_request || ''
      }));
    }

    if (response.event_id) {
      setCurrentEventId(response.event_id);
    }

    if (response.status === 'ok') {
      // Reset clarification state
      setCurrentClarification(null);
      setClarificationNodes([]);
      setNodeConfigAnswers({});
      setNodeConfigLabels({});

      // New format: Backend returns complete workflow data
      if (response.data) {
        try {
          // Backend provides nodes with positions and complete data
          // The actual workflow data is nested inside response.data.data
          const workflowData = (response.data as any).data || response.data;
          const { nodes: backendNodes, edges: backendEdges } = workflowData;

          // Validate that we have nodes and edges
          if (!backendNodes || !Array.isArray(backendNodes)) {
            throw new Error('Invalid response: nodes is missing or not an array');
          }
          if (!backendEdges || !Array.isArray(backendEdges)) {
            throw new Error('Invalid response: edges is missing or not an array');
          }

          // Recalculate positions using frontend algorithm for better layout
          const { nodes: repositionedNodes, viewport: calculatedViewport } =
            recalculateNodePositions(backendNodes, backendEdges);

          // Animate nodes and edges rendering
          await animateWorkflowRendering(repositionedNodes, backendEdges, calculatedViewport);

          addMessage('system', response.message || 'Workflow generated successfully! Check your canvas.', {
            type: 'success'
          });

          toast.success('Workflow generated successfully!');
        } catch (error) {
          console.error('Error applying workflow data:', error);
          addMessage('error', 'Failed to generate workflow on canvas.', {
            type: 'error',
            errorMessage: getDisplayErrorMessage(error, 'Unknown error')
          });
        }
      }
      // Legacy format: Old response with nodes and edges (kept for backward compatibility)
      else if (response.nodes && response.edges) {
        try {
          const { nodes, edges } = await convertAITemplateToFlow({
            nodes: response.nodes.map(n => ({
              node_id: n.node_id,
              display_name: n.name || (n as any).label,
              id: n.id,
              label: n.name || (n as any).label,
              group: (n as any).group || '',
              config: n.config
            })),
            edges: response.edges
          });

          // Recalculate positions using frontend algorithm for better layout
          const { nodes: repositionedNodes, viewport: calculatedViewport } =
            recalculateNodePositions(nodes, edges);

          // Animate nodes and edges rendering
          await animateWorkflowRendering(repositionedNodes, edges, calculatedViewport);

          addMessage('system', response.message || 'Workflow generated successfully! Check your canvas.', {
            type: 'success'
          });

          toast.success('Workflow generated successfully!');
        } catch (error) {
          console.error('Error converting AI template:', error);
          addMessage('error', 'Failed to generate workflow on canvas.', {
            type: 'error',
            errorMessage: getDisplayErrorMessage(error, 'Unknown error')
          });
        }
      }
    } else if (response.status === 'needs_clarification') {
      // Check if this is level-2 clarification (node config)
      // New API structure: clarification data is at root level with missing_fields and node_ref
      const hasLevel2Clarification = response.clarification && 
        response.clarification.missing_fields && 
        response.clarification.missing_fields.length > 0;
      
      if (hasLevel2Clarification) {
        // Level-2: Node configuration clarification
        setCurrentClarification(response.clarification);
        
        // Use node_configs if available (new structure), otherwise fall back to nodes
        const clarificationNodes = response.node_configs || response.nodes || [];
        setClarificationNodes(clarificationNodes);
        setNodeConfigAnswers({});
        setNodeConfigLabels({});

        // Build the workflow with nodes if data is provided
        // Priority: response.data.data (complete workflow with positions) > response.pipeline (basic structure)
        console.log('Level-2 Clarification - Checking for workflow data:', {
          hasDataData: !!response.data?.data,
          hasPipeline: !!response.pipeline,
          responseKeys: Object.keys(response)
        });

        if (response.data?.data) {
          try {
            const workflowData = response.data.data;
            const { nodes: backendNodes, edges: backendEdges } = workflowData;

            console.log('Using response.data.data for workflow:', {
              nodeCount: backendNodes?.length,
              edgeCount: backendEdges?.length
            });

            if (backendNodes && Array.isArray(backendNodes) && backendEdges && Array.isArray(backendEdges)) {
              console.log('Original backend positions (will be ignored):', 
                backendNodes.map(n => ({ id: n.id, position: n.position })));
              
              const { nodes: repositionedNodes, viewport: calculatedViewport } = recalculateNodePositions(backendNodes, backendEdges);
              
              console.log('Recalculated positions (horizontal layout):', 
                repositionedNodes.map(n => ({ id: n.id, position: n.position })));
              
              console.log('Using calculated viewport (80% zoom):', calculatedViewport);
              console.log('Nodes to render:', repositionedNodes.map(n => ({ id: n.id, type: n.type, position: n.position })));
              console.log('Edges to render:', backendEdges);
              
              // Animate workflow rendering (nodes appear one by one from left to right)
              await animateWorkflowRendering(repositionedNodes, backendEdges, calculatedViewport);
              
              console.log('Workflow rendered successfully with animation');
              toast.success('Workflow generated on canvas!');

            } else {
              console.warn('Invalid nodes or edges in response.data.data');
            }
          } catch (error) {
            console.error('Error building workflow during clarification:', error);
          }
        } else if (response.pipeline) {
          // Fallback: Use pipeline data and convert to ReactFlow format
          try {
            const { nodes: pipelineNodes, edges: pipelineEdges } = response.pipeline;

            console.log('Using response.pipeline for workflow:', {
              nodeCount: pipelineNodes?.length,
              edgeCount: pipelineEdges?.length
            });

            if (pipelineNodes && Array.isArray(pipelineNodes) && pipelineEdges && Array.isArray(pipelineEdges)) {
              // Convert AI template format to ReactFlow format
              const { nodes, edges } = await convertAITemplateToFlow({
                nodes: pipelineNodes.map(n => ({
                  node_id: n.node_id,
                  display_name: n.label,
                  id: n.id,
                  label: n.label,
                  group: n.group || '',
                  config: n.config || {}
                })),
                edges: pipelineEdges.map(e => ({
                  from: e.from,
                  to: e.to
                }))
              });

              console.log('Converted to ReactFlow format:', {
                nodeCount: nodes?.length,
                edgeCount: edges?.length
              });

              // Calculate positions (and get proper viewport with 80% zoom)
              const { nodes: repositionedNodes, viewport: calculatedViewport } = recalculateNodePositions(nodes, edges);

              console.log('Using calculated viewport (80% zoom):', calculatedViewport);

              // Animate workflow rendering (nodes appear one by one from left to right)
              await animateWorkflowRendering(repositionedNodes, edges, calculatedViewport);
              
              console.log('Workflow rendered successfully from pipeline with animation');
              toast.success('Workflow generated on canvas!');

            } else {
              console.warn('Invalid nodes or edges in response.pipeline');
            }
          } catch (error) {
            console.error('Error building workflow during clarification:', error);
          }
        } else {
          console.warn('No workflow data found in response (neither data.data nor pipeline)');
        }

        // Show level-2 clarification message
        addMessage('ai', response.clarification.question || 'Please provide the missing configuration values.', {
          type: 'level2_clarification',
          clarification: response.clarification,
          nodeRef: response.clarification.node_ref
        });
      } else {
        // Level-1: Flow-level clarification (original behavior)
        setConversationState(response.conversation_state || null);
        setCurrentQuestion(response.question || response.questions || null);
        setCurrentQuestionOptions(response.options || null);
        setSelectedOptions({});
        setCustomInputValues({});

        addMessage('ai', response.question || response.questions || 'I need more information to proceed.', {
          type: 'options',
          options: response.options
        });
      }
    } else {
      // Handle error status
      addMessage('error', response.message || 'An error occurred while processing your request.', {
        type: 'error',
        errorMessage: response.message
      });
    }
  };

  const handlePredicateResponse = async (response: any) => {
    // Store conversation_id and event_id for future requests
    if (response.conversation_id) { 
      setCurrentConversationId(response.conversation_id);
    }
    if (response.event_id) {
      setCurrentEventId(response.event_id);
    }

    if (response.status === 'ok') { 
      // Success - code was generated
      addMessage('system', response.message || 'Filter code generated successfully!', {
        type: 'success'
      });

      // Call the callback with generated code
      if (response.code && onCodeGenerated) {
        onCodeGenerated(response.code);
      }

      toast.success('Filter code generated successfully!');
    } else if (response.status === 'needs_clarification') {
      // Show clarification question with options
      setCurrentQuestion(response.question || null);
      setCurrentQuestionOptions(response.options || null);
      setSelectedOptions({});
      setCustomInputValues({});

      addMessage('ai', response.question || 'I need more information to proceed.', {
        type: 'options',
        options: response.options
      });
    } else {
      // Handle error status
      addMessage('error', response.message || 'An error occurred while generating filter code.', {
        type: 'error',
        errorMessage: response.message
      });
    }
  };

  const handleJoinResponse = async (response: any) => {
    // Store conversation_id and event_id for future requests
    if (response.conversation_id) {
      setCurrentConversationId(response.conversation_id);
    }
    if (response.event_id) {
      setCurrentEventId(response.event_id);
    }

    if (response.status === 'ok') {
      // Success - join configuration was generated
      addMessage('system', response.message || 'Join configuration generated successfully!', {
        type: 'success'
      });

      // Call the callback with generated join configuration as JSON string
      if (onCodeGenerated) {
        onCodeGenerated(JSON.stringify(response));
      }

      toast.success('Join configuration generated successfully!');
    } else if (response.status === 'needs_clarification') {
      // Show clarification question with options
      setCurrentQuestion(response.question || null);
      setCurrentQuestionOptions(response.options || null);
      setSelectedOptions({});
      setCustomInputValues({});

      addMessage('ai', response.question || 'Which columns should be used to join the two datasets?', {
        type: 'options',
        options: response.options
      });
    } else {
      // Handle error status
      addMessage('error', response.message || 'An error occurred while generating join configuration.', {
        type: 'error',
        errorMessage: response.message
      });
    }
  };

  const handleNwayMatchResponse = async (response: any) => {
    // Store conversation_id and event_id for future requests
    if (response.conversation_id) {
      setCurrentConversationId(response.conversation_id);
    }
    if (response.event_id) {
      setCurrentEventId(response.event_id);
    }

    if (response.status === 'ok') {
      console.log('[NWAY RESPONSE] status === ok detected');
      console.log('[NWAY RESPONSE] response:', response);
      console.log('[NWAY RESPONSE] onCodeGenerated callback exists:', !!onCodeGenerated);

      // Success - N-way match configuration was generated
      addMessage('system', response.message || 'N-way match configuration generated successfully!', {
        type: 'success'
      });

      // Call the callback with generated N-way match configuration as JSON string
      if (onCodeGenerated) {
        console.log('[NWAY RESPONSE] Calling onCodeGenerated with response');
        onCodeGenerated(JSON.stringify(response));
        console.log('[NWAY RESPONSE] onCodeGenerated called successfully');
      } else {
        console.warn('[NWAY RESPONSE] onCodeGenerated callback is not defined!');
      }

      toast.success('N-way match configuration generated successfully!');
    } else if (response.status === 'needs_clarification') {
      console.log('[NWAY RESPONSE] needs_clarification detected');
      console.log('[NWAY RESPONSE] response.options:', response.options);
      console.log('[NWAY RESPONSE] response.missing_fields:', response.missing_fields);
      
      // Show clarification question with column matching options
      // New structure: { options: { rule-id: { match-id: { left_column: [], right_column: [] } } }, missing_fields: [...] }
      
      if (response.options && response.missing_fields) {
        console.log('[NWAY RESPONSE] Adding nway_match_clarification message');
        // This is a column matching clarification
        addMessage('ai', response.question || 'Please match the columns for N-way matching.', {
          type: 'nway_match_clarification',
          options: response.options,
          missing_fields: response.missing_fields
        });
      } else {
        console.log('[NWAY RESPONSE] Falling back to standard options');
        console.log('[NWAY RESPONSE] Missing options:', !response.options);
        console.log('[NWAY RESPONSE] Missing missing_fields:', !response.missing_fields);
        // Fallback to standard options format
        setCurrentQuestion(response.question || null);
        setCurrentQuestionOptions(response.options || null);
        setSelectedOptions({});
        setCustomInputValues({});

        addMessage('ai', response.question || 'I need more information to configure N-way matching.', {
          type: 'options',
          options: response.options
        });
      }
    } else {
      // Handle error status
      addMessage('error', response.message || 'An error occurred while generating N-way match configuration.', {
        type: 'error',
        errorMessage: response.message
      });
    }
  };

  const handleOptionSelect = (fieldName: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleNodeConfigChange = (fieldName: string, value: any, label?: string) => {
    setNodeConfigAnswers(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Store the label if provided (for displaying friendly names instead of IDs)
    if (label !== undefined) {
      setNodeConfigLabels(prev => ({
        ...prev,
        [fieldName]: label
      }));
    }
  };

  const handleFileUpload = async (file: File, fieldName: string) => {
    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append('upload_file', file);

      const uploadResponse = await api.post('/files/upload-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const uploadData = uploadResponse.data;

      // Determine file type from extension
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const isExcel = ['xlsx', 'xls'].includes(fileExtension || '');
      const isCsv = fileExtension === 'csv';
      
      let fileType = 'csv'; // default
      let displayName = 'CSV';
      let modules = 'connectors.files.csv';
      let klassName = 'CSVConnector';
      let nodeId = 22324;
      
      if (isExcel) {
        fileType = 'excel';
        displayName = 'Excel';
        modules = 'connectors.files.excel';
        klassName = 'ExcelConnector';
        nodeId = 22325;
      }

      // Step 2: Create file record in database
      const createFilePayload: any = {
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        type: fileType,
        node_id: nodeId,
        show_node: true,
        is_dataset: true,
        display_name: displayName,
        modules: modules,
        klass_name: klassName,
        group: 'Files',
        unique_id: uploadData.unique_id,
        file_name: uploadData.file_name,
        encrypted_file_key: uploadData.encrypted_file_key,
        file_category: 'source_data',
        file_type: fileType
      };

      // Add sheet_name for Excel files
      if (isExcel) {
        createFilePayload.sheet_name = 'Sheet1'; // Default sheet name
      }

      await api.post('/files/create-file', createFilePayload);

      // Add to uploaded files list
      const uploadedFile: UploadedFile = {
        file_name: uploadData.file_name,
        unique_id: uploadData.unique_id,
        encrypted_file_key: uploadData.encrypted_file_key
      };

      setUploadedFiles(prev => [...prev, uploadedFile]);

      // Update node config with the file name
      handleNodeConfigChange(fieldName, uploadData.file_name);

      toast.success(`File ${uploadData.file_name} uploaded and registered successfully`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    }
  };

  const handlePromptFileUpload = async (file: File) => {
    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append('upload_file', file);

      const uploadResponse = await api.post('/files/upload-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const uploadData = uploadResponse.data;

      // Determine file type from extension
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const isExcel = ['xlsx', 'xls'].includes(fileExtension || '');
      const isCsv = fileExtension === 'csv';
      
      let fileType = 'csv'; // default
      let displayName = 'CSV';
      let modules = 'connectors.files.csv';
      let klassName = 'CSVConnector';
      let nodeId = 22324;
      
      if (isExcel) {
        fileType = 'excel';
        displayName = 'Excel';
        modules = 'connectors.files.excel';
        klassName = 'ExcelConnector';
        nodeId = 22325;
      }

      // Step 2: Create file record in database
      const createFilePayload: any = {
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        type: fileType,
        node_id: nodeId,
        show_node: true,
        is_dataset: true,
        display_name: displayName,
        modules: modules,
        klass_name: klassName,
        group: 'Files',
        unique_id: uploadData.unique_id,
        file_name: uploadData.file_name,
        encrypted_file_key: uploadData.encrypted_file_key,
        file_category: 'source_data',
        file_type: fileType
      };

      // Add sheet_name for Excel files
      if (isExcel) {
        createFilePayload.sheet_name = 'Sheet1'; // Default sheet name
      }

      await api.post('/files/create-file', createFilePayload);

      // Add to prompt uploaded files list
      const uploadedFile: UploadedFile = {
        file_name: uploadData.file_name,
        unique_id: uploadData.unique_id,
        encrypted_file_key: uploadData.encrypted_file_key
      };

      setPromptUploadedFiles(prev => [...prev, uploadedFile]);

      toast.success(`File ${uploadData.file_name} uploaded and registered successfully`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    }
  };

  const handleRemovePromptFile = (uniqueId: string) => {
    setPromptUploadedFiles(prev => prev.filter(f => f.unique_id !== uniqueId));
  };

  const handleSubmitClarification = async (directNwayAnswers?: {
    [ruleId: string]: {
      [matchId: string]: {
        left_column: string;
        right_column: string;
      };
    };
  }) => {
    // Check if we have any answers (either level-1, level-2, or N-way match)
    const hasLevel1Answers = Object.keys(selectedOptions).length > 0;
    const hasLevel2Answers = Object.keys(nodeConfigAnswers).length > 0;
    const hasNwayAnswers = directNwayAnswers ? Object.keys(directNwayAnswers).length > 0 : Object.keys(nwayMatchClarificationAnswers).length > 0;

    if (!hasLevel1Answers && !hasLevel2Answers && !hasNwayAnswers) return;

    setIsLoading(true);

    try {
      // Handle PREDICATE mode
      if (mode === 'PREDICATE') {
        if (!tableContext) {
          addMessage('error', 'No table context available for filter generation.', {
            type: 'error',
            errorMessage: 'Table context is required for PREDICATE mode.'
          });
          setIsLoading(false);
          return;
        }

        // Merge custom input values with selected options
        // If a field has '__CUSTOM__' selected, replace with the custom input value
        const finalAnswers = { ...selectedOptions };
        Object.entries(finalAnswers).forEach(([key, value]) => {
          if (value === '__CUSTOM__' && customInputValues[key]) {
            finalAnswers[key] = customInputValues[key];
          }
        });

        // Add user's selection as a message
        const answerText = Object.entries(finalAnswers)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        addMessage('user', answerText);

        // Convert finalAnswers to the format expected by resume API
        const columnsAnswers: { [key: string]: string } = {};
        Object.entries(finalAnswers).forEach(([key, value]) => {
          columnsAnswers[key] = Array.isArray(value) ? value[0] : value;
        });

        const response = await resumeAiPredicate({
          conversation_id: currentConversationId || '',
          event_id: currentEventId || '',
          answers: {
            columns: columnsAnswers
          },
          execute: true,
          max_rows: 10
        });

        // Reset clarification state
        setCurrentQuestion(null);
        setCurrentQuestionOptions(null);
        setSelectedOptions({});
        setCustomInputValues({});

        await handlePredicateResponse(response);
      } else if (mode === 'JOIN') {
        // Handle JOIN mode
        if (!sourceContext || !targetContext) {
          addMessage('error', 'Source and target table contexts are required.', {
            type: 'error',
            errorMessage: 'Both source and target contexts are required for JOIN mode.'
          });
          setIsLoading(false);
          return;
        }

        // Merge custom input values with selected options
        const finalAnswers = { ...selectedOptions };
        Object.entries(finalAnswers).forEach(([key, value]) => {
          if (value === '__CUSTOM__' && customInputValues[key]) {
            finalAnswers[key] = customInputValues[key];
          }
        });

        // Add user's selection as a message
        const answerText = Object.entries(finalAnswers)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        addMessage('user', answerText);

        // For JOIN mode, we need to format the answers as columns mapping
        const columnsAnswers: { [key: string]: string[] } = {};
        Object.entries(finalAnswers).forEach(([key, value]) => {
          columnsAnswers[key] = Array.isArray(value) ? value : [value];
        });

        const response = await resumeJoinRequest({
          conversation_id: currentConversationId || '',
          event_id: currentEventId || '',
          answers: {
            columns: columnsAnswers
          }
        });

        // Reset clarification state
        setCurrentQuestion(null);
        setCurrentQuestionOptions(null);
        setSelectedOptions({});
        setCustomInputValues({});

        await handleJoinResponse(response);
      } else if (mode === 'NWAY_MATCH') {
        // Handle NWAY_MATCH mode
        if (!tableContext) {
          addMessage('error', 'Source contexts are required.', {
            type: 'error',
            errorMessage: 'Source contexts are required for NWAY_MATCH mode.'
          });
          setIsLoading(false);
          return;
        }

        // Check if this is a column matching clarification
        // Use direct answers if provided (to avoid async state issues), otherwise use state
        const nwayAnswers = directNwayAnswers || nwayMatchClarificationAnswers;
        const hasNwayMatchAnswers = Object.keys(nwayAnswers).length > 0;

        if (hasNwayMatchAnswers) {
          // Handle N-way match column clarification
          // Format the answer text for display
          const answerParts: string[] = [];
          Object.entries(nwayAnswers).forEach(([ruleId, matches]) => {
            Object.entries(matches).forEach(([matchId, columns]) => {
              if (columns.left_column && columns.right_column) {
                answerParts.push(`${ruleId}/${matchId}: ${columns.left_column} → ${columns.right_column}`);
              }
            });
          });
          addMessage('user', answerParts.join(', '));

          console.log('[NWAY SUBMIT] Calling resumeNwayMatchRequest with:', {
            conversation_id: currentConversationId,
            event_id: currentEventId,
            answers: nwayAnswers
          });

          // Call resume API with the formatted answers
          const response = await resumeNwayMatchRequest({
            conversation_id: currentConversationId || '',
            event_id: currentEventId || '',
            answers: nwayAnswers
          });

          // Reset N-way match clarification state
          setNwayMatchClarificationAnswers({});

          await handleNwayMatchResponse(response);
        } else {
          // Handle standard options clarification
          // Merge custom input values with selected options
          const finalAnswers = { ...selectedOptions };
          Object.entries(finalAnswers).forEach(([key, value]) => {
            if (value === '__CUSTOM__' && customInputValues[key]) {
              finalAnswers[key] = customInputValues[key];
            }
          });

          // Add user's selection as a message
          const answerText = Object.entries(finalAnswers)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          addMessage('user', answerText);

          // Format answers for N-way match resume request
          const response = await resumeNwayMatchRequest({
            conversation_id: currentConversationId || '',
            event_id: currentEventId || '',
            answers: finalAnswers
          });

          // Reset clarification state
          setCurrentQuestion(null);
          setCurrentQuestionOptions(null);
          setSelectedOptions({});
          setCustomInputValues({});

          await handleNwayMatchResponse(response);
        }
      } else {
        // Handle PIPELINE mode
        if (!currentWorkflow?.flow_id || !currentConversationId || !currentEventId) {
          addMessage('error', 'Missing required information to resume request.', {
            type: 'error',
            errorMessage: 'Flow ID, conversation ID, or event ID is missing.'
          });
          setIsLoading(false);
          return;
        }

        // Check if this is level-2 clarification
        if (currentClarification && hasLevel2Answers) {
          // Level-2: Node configuration clarification
          const answerText = `Configured ${currentClarification.node_ref.name}: ${Object.entries(nodeConfigAnswers)
            .map(([key, value]) => {
              // Use the label if available, otherwise fall back to the value
              const displayValue = nodeConfigLabels[key] || value;
              return `${key}=${displayValue}`;
            })
            .join(', ')}`;
          addMessage('user', answerText);

          const payload: any = {
            flow_id: currentWorkflow.flow_id,
            conversation_id: currentConversationId,
            event_id: currentEventId,
            answers: {
              node_ref: currentClarification.node_ref,
              config: nodeConfigAnswers
            }
          };

          // Add uploaded files if any
          if (uploadedFiles.length > 0) {
            payload.uploaded_files = uploadedFiles;
          }

          const response: CompileUserRequestResponse = await resumeUserRequestApi(payload);

          // Reset level-2 clarification state
          setCurrentClarification(null);
          setClarificationNodes([]);
          setNodeConfigAnswers({});
          setNodeConfigLabels({});
          setUploadedFiles([]);

          await handleApiResponse(response);
        } else {
          // Level-1: Flow-level clarification
          const answerText = Object.entries(selectedOptions)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          addMessage('user', answerText);

          const payload: any = {
            flow_id: currentWorkflow.flow_id,
            conversation_id: currentConversationId,
            event_id: currentEventId,
            answers: selectedOptions
          };

          // Add conversation_state if available
          if (conversationState) {
            payload.conversation_state = {
              conversation_id: conversationState.conversation_id,
              user_request: conversationState.user_request
            };
          }

          const response: CompileUserRequestResponse = await resumeUserRequestApi(payload);

          // Reset level-1 clarification state
          setCurrentQuestion(null);
          setCurrentQuestionOptions(null);
          setSelectedOptions({});
          setCustomInputValues({});

          await handleApiResponse(response);
        }
      }
    } catch (error: any) {
      console.error('Error resuming request:', error);
      addMessage('error', 'Failed to process your answer. Please try again.', {
        type: 'error',
        errorMessage: error.message || 'Unknown error occurred.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    
    // Reset height to auto to get the correct scrollHeight
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(MIN_TEXTAREA_HEIGHT, Math.min(textareaRef.current.scrollHeight, MAX_TEXTAREA_HEIGHT));
      setTextareaHeight(newHeight);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleChipClick = (chipText: string) => {
    setInputValue(chipText);
  };

  // Handle conversation selection from history
  const handleConversationSelect = async (conversationId: string) => {
    setShowHistoryDropdown(false);
    await loadChatHistory(conversationId);
  };
  
  // Handle delete conversation with confirmation
  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent conversation selection when clicking delete

    // Show confirmation
    setDeletingConversationId(conversationId);
  };

  const confirmDeleteConversation = async () => {
    if (!deletingConversationId) return;

    try {
      await deleteChatHistoryApi({ conversation_id: deletingConversationId });

      // Remove from conversations list
      setConversations(prev => prev.filter(conv => conv.conversation_id !== deletingConversationId));

      // If we deleted the current conversation, reset the chat
      if (currentConversationId === deletingConversationId) {
        setMessages([]);
        setCurrentConversationId(null);
      }

      toast.success('Chat deleted successfully');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete chat');
    } finally {
      setDeletingConversationId(null);
    }
  };

  // Handle conversation name editing
  const handleStartEditConversationName = (conversationId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent conversation selection
    setEditingConversationId(conversationId);
    setEditingName(currentName);
  };

  const handleConversationNameChange = (conversationId: string, newName: string) => {
    setEditingName(newName);
    
    // Update the conversation name in the local state immediately for responsive UI
    setConversations(prev => 
      prev.map(conv => 
        conv.conversation_id === conversationId 
          ? { ...conv, conversation_name: newName }
          : conv
      )
    );

    // Clear existing timer
    if (editDebounceTimerRef.current) {
      clearTimeout(editDebounceTimerRef.current);
    }

    // Set new timer for API call (500ms delay)
    editDebounceTimerRef.current = setTimeout(() => {
      updateConversationNameApi(conversationId, newName);
    }, 500);
  };

  const handleCancelEditConversationName = () => {
    // Clear any pending API calls
    if (editDebounceTimerRef.current) {
      clearTimeout(editDebounceTimerRef.current);
    }
    setEditingConversationId(null);
    setEditingName("");
  };

  const updateConversationNameApi = async (conversationId: string, newName: string) => {
    try {
      await api.post('/chat-history/rename-chat', {
        conversation_id: conversationId,
        new_chat_name: newName
      });
      
      console.log('Conversation name updated successfully');
    } catch (error) {
      console.error('Error updating conversation name:', error);
      toast.error('Failed to update conversation name');
      
      // Reload conversations to revert to server state
      await loadConversations();
    }
  };

  const cancelDeleteConversation = () => {
    setDeletingConversationId(null);
  };

  // Fetch workflows when Workflows dropdown is opened, perspective changes, or search query changes
  React.useEffect(() => {
    if (showWorkflowsDropdown) {
      loadWorkflows();
    }
  }, [showWorkflowsDropdown, activePerspective, debouncedWorkflowSearchQuery]);

  const loadWorkflows = async () => {
    setIsLoadingWorkflows(true);
    try {
      const userOrgIds = currentUser?.organizationIds || [];
      const userRole = currentUser?.role;
      const activePerspectiveId = activePerspective?.perspective_id || activePerspective?.id;

      const response = await fetchProjectsApi(
        {
          fields: ['id', 'name', 'description', 'created_at', 'updated_at', 'flow_id', 'deployment_name', 'locked', 'workflow_origin'],
          org_id: userOrgIds,
          perspective_ids: activePerspectiveId ? [activePerspectiveId] : undefined,
          q: "virtualdb_mode=false",
          search_text: debouncedWorkflowSearchQuery || undefined,
          limit: 100
        },
        userRole
      );
      // Handle different response formats
      const workflowData = Array.isArray(response)
        ? response
        : (response?.data && Array.isArray(response.data))
          ? response.data
          : [];
      setWorkflows(workflowData);
    } catch (error) {
      console.error('Error loading workflows:', error);
      toast.error('Failed to load workflows');
      setWorkflows([]); // Set empty array on error
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const handleWorkflowSelect = async (workflowId: string) => {
    try {
      // Close dropdowns
      setShowWorkflowsDropdown(false);
      setShowWorkflowDropdown(false);
      
      // Show loading state
      setIsLoadingHistory(true);
      
      // Load the workflow data first to update the workflow name immediately
      try {
        const workflowData = await getWorkflowByIdApi({ id: workflowId });
        if (workflowData) {
          // Update the current workflow in the store so the name shows immediately
          setCurrentWorkflow(workflowData);
        }
      } catch (err) {
        console.error('Error loading workflow data:', err);
      }
      
      // Clear current chat state for seamless transition
      setMessages([]);
      setConversationState(null);
      setSelectedOptions({});
      setCustomInputValues({});
      setCurrentQuestion(null);
      setCurrentQuestionOptions(null);
      setCurrentConversationId(null);
      setCurrentEventId(null);
      setCurrentClarification(null);
      setClarificationNodes([]);
      setNodeConfigAnswers({});
      setNodeConfigLabels({});
      setUploadedFiles([]);
      setPromptUploadedFiles([]);
      
      // Navigate to the workflow
      navigate(`/workflows/${workflowId}`);
      
      // Wait for navigation and workflow load
      // The useEffect hook will automatically load conversations for the new workflow
      setTimeout(() => {
        setIsLoadingHistory(false);
        toast.success('Workflow switched successfully');
      }, 500);
      
    } catch (error) {
      console.error('Error switching workflow:', error);
      toast.error('Failed to switch workflow');
      setIsLoadingHistory(false);
    }
  };

  const handleNewChat = () => {
    // Reset conversation state - this will trigger conversation_id: null on next request
    setMessages([]);
    setConversationState(null);
    setSelectedOptions({});
    setCustomInputValues({});
    setCurrentQuestion(null);
    setCurrentQuestionOptions(null);
    setCurrentConversationId(null); // Set to null so next request creates new conversation
    setCurrentEventId(null);
    setCurrentClarification(null);
    setClarificationNodes([]);
    setNodeConfigAnswers({});
    setNodeConfigLabels({});
    setUploadedFiles([]);
    setPromptUploadedFiles([]);
    setShowHistoryDropdown(false);
    setShowWorkflowsDropdown(false);
    setShowRenameDropdown(false);
    toast.success('New chat started');
  };

  const handleHistoryToggle = () => {
    setShowHistoryDropdown(!showHistoryDropdown);
    if (showWorkflowsDropdown) setShowWorkflowsDropdown(false);
  };

  const handleWorkflowsToggle = () => {
    setShowWorkflowsDropdown(!showWorkflowsDropdown);
    if (showHistoryDropdown) setShowHistoryDropdown(false);
  };

  // Filter workflows based on search query
  const filteredWorkflows = React.useMemo(() => {
    if (!workflowSearchQuery.trim()) return workflows;
    const query = workflowSearchQuery.toLowerCase();
    return workflows.filter(workflow =>
      workflow.name?.toLowerCase().includes(query) ||
      workflow.description?.toLowerCase().includes(query)
    );
  }, [workflows, workflowSearchQuery]);

  const handleRenameWorkflow = async () => {
    const newName = renameWorkflowValue.trim();
    if (!newName || !currentWorkflow?.id || isSavingRename) return;
    setIsSavingRename(true);
    try {
      const payload = {
        ...currentWorkflow,
        display_name: newName,
        name: newName,
        deployment_name: newName,
      };
      const updated = await updateWorkflow(payload);
      const workflowData = (updated as any)?.data ?? updated ?? payload;
      setCurrentWorkflow({ ...currentWorkflow, ...workflowData, display_name: newName, name: newName, deployment_name: newName });
      setShowRenameDropdown(false);
      setShowWorkflowDropdown(false);
      toast.success('Workflow renamed');
    } catch (e) {
      console.error('Rename workflow failed:', e);
      toast.error('Failed to rename workflow');
    } finally {
      setIsSavingRename(false);
    }
  };

  const chatContent = (
    <div className="flex flex-col h-full w-full min-h-0 overflow-x-hidden bg-background">
        {/* TOP SECTION - Header (overflow-visible so dropdown is not clipped) + Panels (scrollable) */}
        <div className="flex-shrink-0 flex flex-col border-b border-border/30 overflow-visible">
          {/* Header row: no overflow so workflow dropdown can extend without being clipped */}
          <div className="p-2 pb-1.5 overflow-visible shrink-0">
            <div className="bg-muted/30 rounded-lg p-1.5 flex items-center gap-1.5">
            {/* AI Icon and Text – reduced size */}
            <div className="flex items-center gap-1.5">
              <div className="h-7 w-7 rounded-full border-2 relative overflow-hidden flex-shrink-0 ai-pulse">
                <div className="absolute inset-0 rounded-full animate-gradient-spin" style={{background: 'conic-gradient(from 0deg, #6366f1, #a21caf, #6366f1 100%)'}} />
                <div className="absolute inset-1 rounded-full bg-background" />
              </div>
              <span className="text-xs font-semibold">ASK AI</span>
            </div>

            <div className="flex-1" />

            {/* Workflow Name Dropdown + Chat History, New Chat icons */}
            <div className="relative flex items-center gap-0.5" data-workflow-dropdown>
              {(() => {
                const workflowName = currentWorkflow?.display_name || currentWorkflow?.name || 'Untitled Workflow';
                const isLongName = workflowName.length > 20; // Show tooltip if name is longer than 20 chars
                
                const button = (
                  <button
                    onClick={() => setShowWorkflowDropdown(!showWorkflowDropdown)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-muted transition text-sm font-medium"
                  >
                    <span className="max-w-[140px] truncate" title={isLongName ? workflowName : undefined}>
                      {workflowName}
                    </span>
                    {currentWorkflow?.locked && (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 transition-transform flex-shrink-0",
                      showWorkflowDropdown && "rotate-180"
                    )} />
                  </button>
                );

                return isLongName ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {button}
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[300px]">
                      <p className="break-words">{workflowName}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : button;
              })()}

              {/* Icons beside dropdown: Chat History, New Chat – highlighted when active */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHistoryDropdown(true);
                      setShowWorkflowsDropdown(false);
                      setShowRenameDropdown(false);
                      setShowWorkflowDropdown(false);
                    }}
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition text-muted-foreground",
                      showHistoryDropdown && "bg-primary/15 text-primary ring-1 ring-primary/30"
                    )}
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Chat History</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      handleNewChat();
                      setShowWorkflowDropdown(false);
                    }}
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition text-muted-foreground",
                      !showHistoryDropdown && !showWorkflowsDropdown && !showRenameDropdown && "bg-primary/15 text-primary ring-1 ring-primary/30"
                    )}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>New Chat</p>
                </TooltipContent>
              </Tooltip>

              {/* Dropdown Menu: Workflows, Rename only (Chat History, New Chat are icons above) */}
              <WorkflowDropdownMenu
                open={showWorkflowDropdown}
                onSelectHistory={() => {
                  setShowHistoryDropdown(true);
                  setShowWorkflowsDropdown(false);
                  setShowRenameDropdown(false);
                  setShowWorkflowDropdown(false);
                }}
                onSelectWorkflows={() => {
                  setShowWorkflowsDropdown(true);
                  setShowHistoryDropdown(false);
                  setShowRenameDropdown(false);
                  setShowWorkflowDropdown(false);
                }}
                onSelectRename={() => {
                  setShowRenameDropdown(true);
                  setShowHistoryDropdown(false);
                  setShowWorkflowsDropdown(false);
                  setRenameWorkflowValue(currentWorkflow?.display_name || currentWorkflow?.name || '');
                  setShowWorkflowDropdown(false);
                }}
                onNewChat={() => {
                  handleNewChat();
                  setShowWorkflowDropdown(false);
                }}
              />
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
              className="h-7 w-7 flex items-center justify-center hover:bg-muted rounded-md transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          </div>

          {/* Expandable panels: scrollable area so dropdown options (History, Workflows, Rename) don't push header off */}
          <div className="flex-1 min-h-0 max-h-[55vh] overflow-y-auto px-2 pb-1.5">
          {/* History Dropdown */}
          {showHistoryDropdown && (
            <div className="mt-1 bg-muted/30 rounded-lg p-1 space-y-0.5">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                Chat History
              </div>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
                  No chat history available
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-0.5">
                  {conversations.map((conv) => {
                    const isEditing = editingConversationId === conv.conversation_id;
                    
                    return (
                      <div
                        key={conv.conversation_id}
                        onClick={() => !isEditing && handleConversationSelect(conv.conversation_id)}
                        className={cn(
                          "w-full px-2.5 py-1.5 hover:bg-muted rounded-md transition flex items-center justify-between group",
                          currentConversationId === conv.conversation_id && "bg-muted",
                          !isEditing && "cursor-pointer"
                        )}
                      >
                        <div className="flex-1 min-w-0 mr-2">
                          {isEditing ? (
                            // Edit mode - inline input
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => handleConversationNameChange(conv.conversation_id, e.target.value)}
                              onBlur={handleCancelEditConversationName}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCancelEditConversationName();
                                } else if (e.key === 'Escape') {
                                  // Reload to revert changes
                                  loadConversations();
                                  handleCancelEditConversationName();
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="w-full text-xs font-medium bg-background border border-primary/50 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          ) : (
                            // View mode - display name
                            <div 
                              className="text-xs font-medium truncate cursor-text"
                              onClick={(e) => handleStartEditConversationName(conv.conversation_id, conv.conversation_name || conv.conversation_id, e)}
                              title="Click to edit"
                            >
                              {conv.conversation_name || conv.conversation_id}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground">
                            {formatDateToIST(conv.updated_at)}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {/* Edit Icon - shows on hover when not editing */}
                          {!isEditing && (
                            <button
                              onClick={(e) => handleStartEditConversationName(conv.conversation_id, conv.conversation_name || conv.conversation_id, e)}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-primary/10 rounded transition"
                              title="Edit name"
                            >
                              <Pencil className="h-3 w-3 text-primary" />
                            </button>
                          )}
                          
                          {/* Delete Icon */}
                          {!isEditing && (
                            <button
                              onClick={(e) => handleDeleteConversation(conv.conversation_id, e)}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition"
                              title="Delete chat"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Delete Confirmation Dialog */}
              {deletingConversationId && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-xs text-destructive mb-2">Delete this chat?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmDeleteConversation}
                      className="flex-1 px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition"
                    >
                      Delete
                    </button>
                    <button
                      onClick={cancelDeleteConversation}
                      className="flex-1 px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Workflows Dropdown */}
          {showWorkflowsDropdown && (
            <div className="mt-1 bg-muted/30 rounded-lg p-1 space-y-0.5">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                Workflows
              </div>

              {/* Search Input */}
              <div className="relative px-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={workflowSearchQuery}
                  onChange={(e) => setWorkflowSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>

              {/* Workflow List */}
              <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                {isLoadingWorkflows ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredWorkflows.length === 0 ? (
                  <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
                    {workflowSearchQuery ? 'No workflows found' : 'No workflows available'}
                  </div>
                ) : (
                  filteredWorkflows.map((workflow) => (
                    <button
                      key={workflow.id}
                      onClick={() => handleWorkflowSelect(workflow.id)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-muted rounded-md transition"
                    >
                      <div className="text-xs font-medium truncate">{workflow.name}</div>
                      {workflow.description && (
                        <div className="text-[10px] text-muted-foreground truncate">{workflow.description}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Rename Workflow Panel */}
          {showRenameDropdown && (
            <div className="mt-1 bg-muted/30 rounded-lg p-1 space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                Rename workflow
              </div>
              <div className="flex gap-1.5 items-center px-1">
                <input
                  type="text"
                  value={renameWorkflowValue}
                  onChange={(e) => setRenameWorkflowValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameWorkflow()}
                  placeholder="Workflow name"
                  disabled={isSavingRename || !!currentWorkflow?.locked}
                  className="flex-1 px-3 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <button
                  onClick={handleRenameWorkflow}
                  disabled={!renameWorkflowValue.trim() || isSavingRename || !!currentWorkflow?.locked}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isSavingRename ? 'Saving…' : 'Save'}
                </button>
              </div>
              {currentWorkflow?.locked && (
                <p className="px-2.5 text-[10px] text-muted-foreground">This workflow is locked and cannot be renamed.</p>
              )}
            </div>
          )}

          </div>
        </div>

        {/* CHAT SECTION - Scrollable Messages (Simplified like AiClarificationChat) */}
        <div className={cn(
          "flex-1 overflow-y-auto p-2 bg-muted/20",
          messages.length === 0 ? "flex flex-col justify-end" : "space-y-2"
        )}>
              {/* Initial Greeting - Show when no messages */}
              {messages.length === 0 && (
                <div className="px-2 pb-2">
                  <div className="font-semibold text-sm mb-1">Hey {currentUser?.name || 'there'}!</div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {mode === 'PIPELINE'
                      ? "I'm here to help you create workflows. Just describe what you want to build, and I'll generate it for you on the canvas."
                      : "I'm here to help you with data transformations. Describe what you want to do with your data."}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">Try these examples:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(mode === 'PIPELINE' ? suggestionChips : suggestionChipsPredicate).map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleChipClick(chip)}
                        className="px-2.5 py-1 bg-background hover:bg-muted rounded-full text-[11px] border border-border/50 transition"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              {messages.map((message) => (  
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-2",
                      message.type === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {/* Message Content */}
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm',
                        message.type === 'user'
                          ? 'bg-muted/70 text-foreground'
                          : message.type === 'system'
                          ? 'bg-muted/30 text-foreground border border-border/40'
                          : message.type === 'error'
                          ? 'bg-muted/30 text-foreground border border-border/40'
                          : 'bg-muted/20 text-foreground border border-border/30'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                      {/* Level-2 Clarification UI (Node Config) */}
                      {message.data?.type === 'level2_clarification' && message.data.clarification && (
                        <Level2Clarification
                          clarification={message.data.clarification}
                          apiResponse={apiResponse}
                          clarificationNodes={clarificationNodes}
                          nodeConfigAnswers={nodeConfigAnswers}
                          isHistoryItem={Object.keys(message.data.selectedAnswers || {}).length > 0}
                          historySelectedAnswers={message.data.selectedAnswers || {}}
                          messageId={message.id}
                          isLoading={isLoading}
                          onNodeConfigChange={handleNodeConfigChange}
                          onFileUpload={handleFileUpload}
                          onSubmit={handleSubmitClarification}
                          setUploadedFiles={setUploadedFiles}
                        />
                      )}

                      {/* N-way Match Clarification UI */}
                      {(() => {
                        // Debug: Check all conditions for N-way match rendering
                        const isNwayType = message.data?.type === 'nway_match_clarification';
                        const hasOptions = !!message.data?.options;
                        const hasMissingFields = !!message.data?.missing_fields;
                        console.log('[NWAY RENDER CHECK] message.data.type:', message.data?.type);
                        console.log('[NWAY RENDER CHECK] isNwayType:', isNwayType, 'hasOptions:', hasOptions, 'hasMissingFields:', hasMissingFields);

                        if (isNwayType && hasOptions && hasMissingFields) {
                          console.log('[NWAY RENDER] Rendering N-way match clarification');
                          console.log('[NWAY RENDER] message.data:', message.data);
                          return (
                            <NwayMatchClarificationSelection
                              options={message.data.options}
                              missingFields={message.data.missing_fields}
                              onSubmit={(answers) => {
                                setNwayMatchClarificationAnswers(answers);
                                // Auto-submit after selection
                                setTimeout(() => handleSubmitClarification(answers), 100);
                              }}
                              isLoading={isLoading}
                              isHistoryItem={Object.keys(message.data.selectedAnswers || {}).length > 0}
                              preSelectedAnswers={message.data.selectedAnswers || {}}
                            />
                          );
                        }
                        return null;
                      })()}

                      {/* Level-1 Options UI for Clarification */}
                      {message.data?.type === 'options' && message.data.options && (() => {
                        // Check if this is a history item (has pre-selected answers)
                        const historySelectedAnswers = message.data.selectedAnswers || {};
                        const isHistoryItem = Object.keys(historySelectedAnswers).length > 0;

                        // Check if this is JOIN mode with join key options
                        const isJoinKeySelection = mode === 'JOIN' && 
                          Object.keys(message.data.options).some(key => key.includes('join_key'));

                        if (isJoinKeySelection) {
                          // Extract source and target columns from options
                          const sourceKey = Object.keys(message.data.options).find(key => key.includes('source.join_key'));
                          const targetKey = Object.keys(message.data.options).find(key => key.includes('target.join_key'));
                          
                          const sourceColumns = sourceKey ? message.data.options[sourceKey] : [];
                          const targetColumns = targetKey ? message.data.options[targetKey] : [];

                          // Extract table names from source/target contexts
                          const sourceTableName = sourceContext?.table_name || 'Source';
                          const targetTableName = targetContext?.table_name || 'Target';

                          // Convert history answers to pairs format if available
                          const preSelectedPairs = isHistoryItem && historySelectedAnswers[sourceKey!] && historySelectedAnswers[targetKey!]
                            ? (() => {
                                const sourceVal = historySelectedAnswers[sourceKey!];
                                const targetVal = historySelectedAnswers[targetKey!];
                                const sources: string[] = Array.isArray(sourceVal) ? sourceVal : [sourceVal];
                                const targets: string[] = Array.isArray(targetVal) ? targetVal : [targetVal];
                                return sources.map((source: string, index: number) => ({
                                  source,
                                  target: targets[index] || targets[0]
                                }));
                              })()
                            : [];

                          return (
                            <JoinColumnSelection
                              sourceColumns={sourceColumns}
                              targetColumns={targetColumns}
                              sourceTableName={sourceTableName}
                              targetTableName={targetTableName}
                              onSubmit={(pairs) => {
                                // Convert pairs to the format expected by the API
                                const sourceKeys = pairs.map(p => p.source);
                                const targetKeys = pairs.map(p => p.target);
                                
                                setSelectedOptions({
                                  [sourceKey!]: sourceKeys.length === 1 ? sourceKeys[0] : sourceKeys,
                                  [targetKey!]: targetKeys.length === 1 ? targetKeys[0] : targetKeys
                                });
                                
                                // Auto-submit after selection
                                setTimeout(() => handleSubmitClarification(), 100);
                              }}
                              isLoading={isLoading}
                              isHistoryItem={isHistoryItem}
                              preSelectedPairs={preSelectedPairs}
                            />
                          );
                        }

                        return (
                          <div className="mt-3 space-y-2">
                            {Object.entries(message.data.options).map(([fieldName, options]) => {
                              // Safety check: ensure options is an array
                              if (!Array.isArray(options)) {
                                console.warn(`Options for field "${fieldName}" is not an array:`, options);
                                return null;
                              }
                              
                              const optionsList = options as string[];
                              const hasScrollableOptions = optionsList.length > 5;
                              // Use history answer if available, otherwise use current selection
                              const currentValue = isHistoryItem 
                                ? (Array.isArray(historySelectedAnswers[fieldName]) ? historySelectedAnswers[fieldName][0] : historySelectedAnswers[fieldName]) || '' 
                                : (Array.isArray(selectedOptions[fieldName]) ? selectedOptions[fieldName][0] : selectedOptions[fieldName]) || '';

                              return (
                                <div key={fieldName} className="space-y-2">
                                  <p className="text-xs font-semibold capitalize">{fieldName.replace(/_/g, ' ')}:</p>
                                  <div className={cn(
                                    "space-y-2",
                                    hasScrollableOptions && "max-h-[200px] overflow-y-auto pr-2"
                                  )}>
                                    <RadioGroup
                                      value={currentValue}
                                      onValueChange={(value) => !isHistoryItem && handleOptionSelect(fieldName, value)}
                                      className="space-y-2"
                                      disabled={isHistoryItem}
                                    >
                                      {optionsList.map((option: string) => (
                                        <div
                                          key={option}
                                          className={cn(
                                            "flex items-center space-x-2 p-2 rounded-lg transition-colors",
                                            isHistoryItem
                                              ? historySelectedAnswers[fieldName] === option
                                                ? "bg-primary/10 border border-primary/30"
                                                : "opacity-50"
                                              : "hover:bg-primary/5 cursor-pointer"
                                          )}
                                        >
                                          <RadioGroupItem
                                            value={option}
                                            id={`${message.id}-${fieldName}-${option}`}
                                            disabled={isHistoryItem}
                                          />
                                          <Label
                                            htmlFor={`${message.id}-${fieldName}-${option}`}
                                            className={cn(
                                              "flex-1 text-sm font-medium",
                                              isHistoryItem ? "cursor-default" : "cursor-pointer"
                                            )}
                                          >
                                            {option}
                                          </Label>
                                        </div>
                                      ))}

                                      {/* Custom Value Option for PREDICATE mode */}
                                      {mode === 'PREDICATE' && !isHistoryItem && (
                                        <div
                                          className={cn(
                                            "flex items-center space-x-2 p-2 rounded-lg transition-colors hover:bg-primary/5 cursor-pointer"
                                          )}
                                        >
                                          <RadioGroupItem
                                            value="__CUSTOM__"
                                            id={`${message.id}-${fieldName}-custom`}
                                          />
                                          <Label
                                            htmlFor={`${message.id}-${fieldName}-custom`}
                                            className="flex-1 text-sm font-medium cursor-pointer"
                                          >
                                            Custom value
                                          </Label>
                                        </div>
                                      )}
                                    </RadioGroup>

                                    {/* Custom Input Field with @mention support */}
                                    {mode === 'PREDICATE' && !isHistoryItem && currentValue === '__CUSTOM__' && (
                                      <div className="mt-2 pl-6">
                                        <MentionTextarea
                                          value={customInputValues[fieldName] || ''}
                                          onChange={(value) => {
                                            // Store custom input value (but don't update selectedOptions yet)
                                            setCustomInputValues(prev => ({ ...prev, [fieldName]: value }));
                                          }}
                                          columns={tableContext?.schema || []}
                                          placeholder="Enter custom value (use @ for column suggestions)"
                                          className="w-full text-sm"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Submit Button for Options - only show if not a history item */}
                            {!isHistoryItem && Object.keys(selectedOptions).length > 0 && (
                              <button
                                onClick={() => handleSubmitClarification()}
                                disabled={isLoading}
                                className="w-full h-9 text-sm mt-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                              >
                                {isLoading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-4 h-4" />
                                    Submit
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      <p className="text-xs opacity-70 mt-2">{message.timestamp}</p>
                    </div>

                    {/* User Avatar - Right side for user messages only */}
                    {message.type === 'user' && (
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}


              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Processing...</span>
                    </div>
                  </div>
                </motion.div>
              )}

        </div>

        {/* INPUT SECTION - Fixed at Bottom */}
        <div className="flex-shrink-0 border-t border-border bg-background p-3 pt-2">
          <div className="flex min-h-0 flex-col space-y-2">
              {/* Uploaded Files Display */}
              {promptUploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {promptUploadedFiles.map((file) => (
                    <div
                      key={file.unique_id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs"
                    >
                      <Paperclip className="h-3 w-3" />
                      <span className="max-w-[150px] truncate">{file.file_name}</span>
                      <button
                        onClick={() => handleRemovePromptFile(file.unique_id)}
                        className="hover:bg-destructive/10 rounded p-0.5 transition"
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input with Upload and Send Buttons — aligned with WorkspaceChartChatSidebar composer */}
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePromptFileUpload(file);
                      // Reset input
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />

                <textarea
                  ref={textareaRef}
                  placeholder="Describe the workflow you want to create..."
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  rows={1}
                  style={{ minHeight: `${textareaHeight}px`, maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
                  className="w-full min-h-[20px] resize-none rounded-xl border-2 border-border bg-muted/40 pl-10 pr-12 pb-3 pt-3 text-sm shadow-none transition-colors placeholder:text-muted-foreground/80 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed overflow-y-auto"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className={cn(
                    "absolute left-2 bottom-2 z-10 flex size-9 items-center justify-center rounded-md text-muted-foreground transition-[opacity,transform] hover:bg-muted/80 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    !isLoading ? "cursor-pointer" : "pointer-events-none opacity-40"
                  )}
                  title="Upload file"
                  aria-label="Upload file"
                >
                  <Paperclip className="size-5" />
                </button>

                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute bottom-2 right-2 z-10 flex size-9 items-center justify-center rounded-md text-primary transition-[opacity,transform] hover:opacity-80 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40"
                  aria-label={isLoading ? 'Sending…' : 'Send message'}
                >
                  {isLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <SendHorizontal className="size-5" />
                  )}
                </button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">
                  Enter
                </kbd>{' '}
                to send ·{' '}
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">
                  Shift+Enter
                </kbd>{' '}
                new line
              </p>
            </div>
          </div>

        {/* Animation Styles */}
        <style>{`
          @keyframes gradient-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .animate-gradient-spin {
            animation: gradient-spin 2.5s linear infinite;
          }
        `}</style>
    </div>
  );

  if (withoutDialog) {
    return chatContent;
  }

  // Shared panel layout: fits below header (h-10 = 2.5rem), full viewport height, only chat interactive
  const HEADER_OFFSET = '2.5rem'; // h-10
  const panelClassName =
    'fixed right-0 top-10 z-[100] h-[calc(100vh-2.5rem)] w-[420px] max-w-[95vw] p-0 rounded-tl-2xl border-l bg-background shadow-lg pointer-events-auto flex flex-col overflow-hidden animate-in slide-in-from-right duration-300';
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    right: 0,
    top: HEADER_OFFSET,
    height: 'calc(100vh - 2.5rem)',
    width: '420px',
    maxWidth: '95vw',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100
  };
  // Full-viewport overlay: visual only – do not block interaction so remaining components stay usable
  const overlayClassName =
    'fixed inset-0 z-[60] pointer-events-none bg-background/40';

  // Use custom portal for PREDICATE, JOIN, and NWAY_MATCH modes to avoid Sheet/Dialog conflicts
  if (mode === 'PREDICATE' || mode === 'JOIN' || mode === 'NWAY_MATCH') {
    if (!open) return null;

    if (typeof document === 'undefined') return null;

    return createPortal(
      <div className={overlayClassName} style={{ zIndex: 60 }} aria-hidden={false}>
        <div
          className={panelClassName}
          style={panelStyle}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          data-scroll-lock-scrollable
        >
          {chatContent}
        </div>
      </div>,
      document.body
    );
  }

  // PIPELINE mode: when open, render only the panel (no overlay) so remaining components stay enabled
  if (mode === 'PIPELINE') {
    if (!open) return null;
    if (typeof document === 'undefined') return null;

    return createPortal(
      <div
        className={panelClassName}
        style={panelStyle}
        data-scroll-lock-scrollable
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {chatContent}
      </div>,
      document.body
    );
  }

  return null;
}
