'use client';

/**
 * 创作引导状态管理 - Context版本
 * 
 * 解决问题：
 * - 状态集中管理，避免Props Drilling
 * - 支持跨组件通信
 * - 更好的可维护性
 * 
 * 注意：当前 Selector Hooks 是便利方法，并非真正的细粒度选择器。
 * 因为 React Context 的机制，任何 state 变化都会触发所有消费者重渲染。
 * 如需真正的细粒度更新隔离，建议使用 use-context-selector 库或拆分为多个独立 Context。
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { 
  CoreAnchorData, 
  MaterialData, 
  StructureTemplate,
  CreationControlData,
  DEFAULT_CORE_ANCHOR_DATA,
  DEFAULT_MATERIAL_DATA,
  DEFAULT_CREATION_CONTROL_DATA
} from './types';
import { USER_DEFAULT_7_SECTION_STRUCTURE } from './structure-templates';

// ============ 状态类型定义 ============

export interface CreationGuideState {
  // 核心数据
  coreAnchorData: CoreAnchorData;
  materialData: MaterialData;
  selectedStructure: StructureTemplate;
  creationControlData: CreationControlData;
  
  // UI状态
  activeTab: number;
  isSaving: boolean;
  lastSaved: Date | null;
  
  // 错误状态
  error: string | null;
}

// ============ Action类型定义 ============

export type CreationGuideAction = 
  // 核心数据更新
  | { type: 'UPDATE_CORE_ANCHOR'; payload: Partial<CoreAnchorData> }
  | { type: 'UPDATE_MATERIAL'; payload: Partial<MaterialData> }
  | { type: 'SELECT_STRUCTURE'; payload: StructureTemplate }
  | { type: 'UPDATE_CREATION_CONTROL'; payload: Partial<CreationControlData> }
  
  // UI状态
  | { type: 'SET_ACTIVE_TAB'; payload: number }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_LAST_SAVED'; payload: Date }
  
  // 错误处理
  | { type: 'SET_ERROR'; payload: string | null }
  
  // 批量操作
  | { type: 'RESET_STATE' }
  | { type: 'LOAD_STATE'; payload: Partial<CreationGuideState> };

// ============ 初始状态 ============

const INITIAL_STATE: CreationGuideState = {
  coreAnchorData: DEFAULT_CORE_ANCHOR_DATA,
  materialData: DEFAULT_MATERIAL_DATA,
  selectedStructure: USER_DEFAULT_7_SECTION_STRUCTURE,
  creationControlData: DEFAULT_CREATION_CONTROL_DATA,
  activeTab: 0,
  isSaving: false,
  lastSaved: null,
  error: null,
};

// ============ Reducer ============

function creationGuideReducer(
  state: CreationGuideState,
  action: CreationGuideAction
): CreationGuideState {
  switch (action.type) {
    // 核心数据更新
    case 'UPDATE_CORE_ANCHOR':
      return {
        ...state,
        coreAnchorData: {
          ...state.coreAnchorData,
          ...action.payload,
        },
      };

    case 'UPDATE_MATERIAL':
      return {
        ...state,
        materialData: {
          ...state.materialData,
          ...action.payload,
        },
      };

    case 'SELECT_STRUCTURE':
      return {
        ...state,
        selectedStructure: action.payload,
      };

    case 'UPDATE_CREATION_CONTROL':
      return {
        ...state,
        creationControlData: {
          ...state.creationControlData,
          ...action.payload,
        },
      };

    // UI状态
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.payload,
      };

    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.payload,
      };

    case 'SET_LAST_SAVED':
      return {
        ...state,
        lastSaved: action.payload,
      };

    // 错误处理
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    // 批量操作
    case 'RESET_STATE':
      return INITIAL_STATE;

    case 'LOAD_STATE':
      return {
        ...state,
        ...action.payload,
      };

    default: {
      // TypeScript exhaustive check
      const _exhaustiveCheck: never = action;
      throw new Error(`Unhandled action type: ${(_exhaustiveCheck as { type: string }).type}`);
    }
  }
}

// ============ Context类型定义 ============

interface CreationGuideContextType {
  // 状态
  state: CreationGuideState;
  
  // Dispatch
  dispatch: React.Dispatch<CreationGuideAction>;
  
  // 便捷方法
  updateCoreAnchor: (data: Partial<CoreAnchorData>) => void;
  updateMaterial: (data: Partial<MaterialData>) => void;
  selectStructure: (structure: StructureTemplate) => void;
  updateCreationControl: (data: Partial<CreationControlData>) => void;
  setActiveTab: (tab: number) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
  
  // 派生数据
  hasData: boolean;
  canGenerateOutline: boolean;
}

// ============ 创建Context ============

const CreationGuideContext = createContext<CreationGuideContextType | undefined>(undefined);

// ============ Provider组件 ============

interface CreationGuideProviderProps {
  children: ReactNode;
  initialState?: Partial<CreationGuideState>;
}

export function CreationGuideProvider({ 
  children, 
  initialState 
}: CreationGuideProviderProps) {
  const [state, dispatch] = useReducer(creationGuideReducer, INITIAL_STATE);

  // [C2修复] 当 initialState 异步加载完成后，通过 LOAD_STATE 同步到 reducer
  useEffect(() => {
    if (initialState && Object.keys(initialState).length > 0) {
      dispatch({ type: 'LOAD_STATE', payload: initialState });
    }
  }, [initialState]);

  // 便捷方法
  const updateCoreAnchor = useCallback((data: Partial<CoreAnchorData>) => {
    dispatch({ type: 'UPDATE_CORE_ANCHOR', payload: data });
  }, []);

  const updateMaterial = useCallback((data: Partial<MaterialData>) => {
    dispatch({ type: 'UPDATE_MATERIAL', payload: data });
  }, []);

  const selectStructure = useCallback((structure: StructureTemplate) => {
    dispatch({ type: 'SELECT_STRUCTURE', payload: structure });
  }, []);

  const updateCreationControl = useCallback((data: Partial<CreationControlData>) => {
    dispatch({ type: 'UPDATE_CREATION_CONTROL', payload: data });
  }, []);

  const setActiveTab = useCallback((tab: number) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  // 派生数据
  const hasData = useMemo(() => {
    return (
      state.coreAnchorData.openingCase.trim() !== '' ||
      state.coreAnchorData.coreViewpoint.trim() !== '' ||
      state.coreAnchorData.endingConclusion.trim() !== '' ||
      state.materialData.relatedMaterials.trim() !== '' ||
      state.materialData.keyMaterials.trim() !== ''
    );
  }, [state.coreAnchorData, state.materialData]);

  const canGenerateOutline = useMemo(() => {
    return (
      state.coreAnchorData.openingCase.trim() !== '' &&
      state.coreAnchorData.coreViewpoint.trim() !== ''
    );
  }, [state.coreAnchorData]);

  const contextValue = useMemo(() => ({
    state,
    dispatch,
    updateCoreAnchor,
    updateMaterial,
    selectStructure,
    updateCreationControl,
    setActiveTab,
    setError,
    resetState,
    hasData,
    canGenerateOutline,
  }), [
    state,
    updateCoreAnchor,
    updateMaterial,
    selectStructure,
    updateCreationControl,
    setActiveTab,
    setError,
    resetState,
    hasData,
    canGenerateOutline,
  ]);

  return (
    <CreationGuideContext.Provider value={contextValue}>
      {children}
    </CreationGuideContext.Provider>
  );
}

// ============ Hook ============

export function useCreationGuide(): CreationGuideContextType {
  const context = useContext(CreationGuideContext);
  
  if (context === undefined) {
    throw new Error('useCreationGuide must be used within a CreationGuideProvider');
  }
  
  return context;
}

// ============ 便利 Hooks ============
// 注意：这些 Hooks 是便利方法，不是细粒度选择器。
// 由于 React Context 的机制，任何 state 变化仍会触发所有消费者重渲染。
// 如需真正的细粒度更新隔离，建议使用 use-context-selector 库。

export function useCoreAnchorData() {
  const { state, updateCoreAnchor } = useCreationGuide();
  return {
    data: state.coreAnchorData,
    update: updateCoreAnchor,
  };
}

export function useMaterialData() {
  const { state, updateMaterial } = useCreationGuide();
  return {
    data: state.materialData,
    update: updateMaterial,
  };
}

export function useSelectedStructure() {
  const { state, selectStructure } = useCreationGuide();
  return {
    structure: state.selectedStructure,
    select: selectStructure,
  };
}

export function useCreationControlData() {
  const { state, updateCreationControl } = useCreationGuide();
  return {
    data: state.creationControlData,
    update: updateCreationControl,
  };
}

// [M1修复] 不再重复调用 useCreationGuide()
export function useCreationGuideUI() {
  const { state, setActiveTab, setError, resetState, hasData, canGenerateOutline } = useCreationGuide();
  return {
    activeTab: state.activeTab,
    isSaving: state.isSaving,
    lastSaved: state.lastSaved,
    error: state.error,
    hasData,
    canGenerateOutline,
    setActiveTab,
    setError,
    resetState,
  };
}
