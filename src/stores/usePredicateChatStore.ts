import { create } from 'zustand';
import type { TableContext } from '@/components/common/FilterOperations/aiPredicateApi';

interface PredicateChatState {
    isOpen: boolean;
    tableContext?: TableContext;
    initialQuestion?: string;
    initialOptions?: { [key: string]: string[] };
    initialMissingColumns?: string[];
    initialConversationId?: string;
    initialEventId?: string;
    initialUserRequest?: string;
    onCodeGenerated?: (code: string) => void;

    // Actions
    openChat: (config: {
        tableContext?: TableContext;
        initialQuestion?: string;
        initialOptions?: { [key: string]: string[] };
        initialMissingColumns?: string[];
        initialConversationId?: string;
        initialEventId?: string;
        initialUserRequest?: string;
        onCodeGenerated?: (code: string) => void;
    }) => void;
    closeChat: () => void;
    reset: () => void;
}

export const usePredicateChatStore = create<PredicateChatState>((set) => ({
    isOpen: false,
    tableContext: undefined,
    initialQuestion: undefined,
    initialOptions: undefined,
    initialMissingColumns: undefined,
    initialConversationId: undefined,
    initialEventId: undefined,
    initialUserRequest: undefined,
    onCodeGenerated: undefined,

    openChat: (config) => set({
        isOpen: true,
        ...config,
    }),

    closeChat: () => set({
        isOpen: false,
    }),

    reset: () => set({
        isOpen: false,
        tableContext: undefined,
        initialQuestion: undefined,
        initialOptions: undefined,
        initialMissingColumns: undefined,
        initialConversationId: undefined,
        initialEventId: undefined,
        initialUserRequest: undefined,
        onCodeGenerated: undefined,
    }),
}));
