import { useState, useEffect, useRef } from 'react';
import useFlowStore from '@/stores/flowStore';

export interface ValidationRule {
  id: string;
  name: string;
  connections: any[];
}

export interface RuleViewState {
  showConnectionsPage: boolean;
  showFiltersPage: boolean;
  showFilterNode: boolean;
}

export const useRuleManagement = () => {
  const currentNode = useFlowStore((state) => state.getSelectedNode());
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [ruleViewStates, setRuleViewStates] = useState<Record<string, RuleViewState>>({});
  const rulesInitializedRef = useRef(false);

  const getRuleViewState = (ruleId: string): RuleViewState => {
    return ruleViewStates[ruleId] || { 
      showConnectionsPage: false, 
      showFiltersPage: false, 
      showFilterNode: false 
    };
  };

  const setRuleViewState = (
    ruleId: string, 
    updates: Partial<RuleViewState>
  ) => {
    setRuleViewStates(prev => ({
      ...prev,
      [ruleId]: { ...getRuleViewState(ruleId), ...updates }
    }));
  };

  const addRule = (name: string) => {
    const trimmedName = name.trim();
    const newRule: ValidationRule = {
      id: `rule-${Date.now()}`,
      name: trimmedName,
      connections: [],
    };
    
    // CRITICAL: Check for duplicates before adding
    setRules(prev => {
      const isDuplicate = prev.some(
        rule => rule.name.toLowerCase() === trimmedName.toLowerCase()
      );
      
      if (isDuplicate) {
        console.warn(`⚠️ Cannot add duplicate rule: "${trimmedName}"`);
        return prev; // Return unchanged if duplicate
      }
      
      // Rule is unique, add it and set as active
      setActiveRuleId(newRule.id);
      // Show default view when a new rule is added
      setRuleViewState(newRule.id, { 
        showFiltersPage: false, 
        showConnectionsPage: false,
        showFilterNode: false 
      });
      rulesInitializedRef.current = true;
      
      return [...prev, newRule];
    });
  };

  const removeRule = (ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
    setRuleViewStates(prev => {
      const newStates = { ...prev };
      delete newStates[ruleId];
      return newStates;
    });
    // If removed rule was active, switch to first remaining rule or null
    if (activeRuleId === ruleId) {
      const remainingRules = rules.filter(r => r.id !== ruleId);
      setActiveRuleId(remainingRules.length > 0 ? remainingRules[0].id : null);
    }
  };

  // Initialize rules from payload when component loads
  useEffect(() => {
    if (rulesInitializedRef.current || rules.length > 0) return;
    if (!currentNode?.id) return;

    const payload = currentNode?.data?.node?.payload;
    if (!payload) return;

    // Check if payload has rules - can be dictionary (object) or array
    if (payload.rules) {
      let loadedRules: ValidationRule[] = [];
      
      // If rules is a dictionary (object with rule names as keys)
      if (typeof payload.rules === 'object' && !Array.isArray(payload.rules)) {
        loadedRules = Object.keys(payload.rules).map((ruleName, index) => {
          const ruleData = payload.rules[ruleName];
          return {
            id: ruleData?.uiState?.id || ruleData?.id || `rule_${ruleName}_${Date.now()}`,
            name: ruleName, // Use the key as the rule name
            connections: ruleData?.connections || [],
          };
        });
      } 
      // If rules is an array
      else if (Array.isArray(payload.rules) && payload.rules.length > 0) {
        loadedRules = payload.rules.map((rule: any, index: number) => ({
          id: rule.id || rule.uiState?.id || `rule-${Date.now()}-${index}`,
          name: rule.name || rule.ruleName || rule.uiState?.name || `Rule ${index + 1}`,
          connections: rule.connections || [],
        }));
      }

      if (loadedRules.length > 0) {
        // CRITICAL: Filter out duplicate rules by name (case-insensitive)
        // Keep the first occurrence of each unique rule name
        const uniqueRulesMap = new Map<string, ValidationRule>();
        loadedRules.forEach(rule => {
          const ruleNameLower = rule.name.toLowerCase();
          if (!uniqueRulesMap.has(ruleNameLower)) {
            uniqueRulesMap.set(ruleNameLower, rule);
          } else {
            console.warn(`⚠️ Duplicate rule found and removed: "${rule.name}" (keeping first occurrence)`);
          }
        });
        
        const uniqueRules = Array.from(uniqueRulesMap.values());
        
        if (uniqueRules.length !== loadedRules.length) {
          console.log(`✅ Filtered ${loadedRules.length - uniqueRules.length} duplicate rule(s). Showing ${uniqueRules.length} unique rules.`);
        }
        
        setRules(uniqueRules);
        const firstRuleId = uniqueRules[0].id;
        setActiveRuleId(firstRuleId);
        // Show default view for the first rule
        setRuleViewState(firstRuleId, { 
          showFiltersPage: false, 
          showConnectionsPage: false,
          showFilterNode: false 
        });
        rulesInitializedRef.current = true;
      }
    } else {
      // Legacy: Create default rule from field_rules
      const fieldRules = Array.isArray(payload.field_rules) ? payload.field_rules : [];
      if (fieldRules.length > 0) {
        const defaultRule: ValidationRule = {
          id: `rule-${Date.now()}`,
          name: 'Default Rule',
          connections: [],
        };
        setRules([defaultRule]);
        setActiveRuleId(defaultRule.id);
        setRuleViewState(defaultRule.id, { 
          showFiltersPage: false, 
          showConnectionsPage: false,
          showFilterNode: false 
        });
        rulesInitializedRef.current = true;
      }
    }
  }, [currentNode?.id, currentNode?.data?.node?.payload]);

  // Reset initialization when node changes
  useEffect(() => {
    if (currentNode?.id) {
      rulesInitializedRef.current = false;
    }
  }, [currentNode?.id]);

  return {
    rules,
    activeRuleId,
    ruleViewStates,
    getRuleViewState,
    setRuleViewState,
    addRule,
    removeRule,
    setActiveRuleId,
    setRules,
  };
};

