'use client';

import { create } from 'zustand';

export interface Tag {
  id: string;
  value: string;
  type: 'number' | 'variable' | 'operator' | 'function';
  selectedOption?: 'Value' | 'Percentage' | 'Growth';
  variableValue?: string;
  inputs?: string;
}

type FormulaStore = {
  tags: Tag[];
  cursorPosition: number;
  nextId: number;
  addTag: (tag: Omit<Tag, 'id'>) => void;
  removeTag: (id: string) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  setCursorPosition: (position: number) => void;
};

export const useFormulaStore = create<FormulaStore>((set) => ({
  tags: [],
  cursorPosition: 0,
  nextId: 1,
  addTag: (tag) =>
    set((state) => {
      const newTag = { ...tag, id: `tag-${state.nextId}` };
      const newTags = [...state.tags];
      newTags.splice(state.cursorPosition, 0, newTag);
      return {
        tags: newTags,
        cursorPosition: state.cursorPosition + 1,
        nextId: state.nextId + 1,
      };
    }),
  removeTag: (id) =>
    set((state) => ({
      tags: state.tags.filter((tag) => tag.id !== id),
      cursorPosition: Math.max(0, state.cursorPosition - 1),
    })),
  updateTag: (id, updates) =>
    set((state) => ({
      tags: state.tags.map((tag) =>
        tag.id === id ? { ...tag, ...updates } : tag
      ),
    })),
  setCursorPosition: (position) =>
    set(() => ({
      cursorPosition: position,
    })),
})); 