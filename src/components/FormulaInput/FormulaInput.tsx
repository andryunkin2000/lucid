'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { PlusIcon as PlusIconOutline } from '@heroicons/react/24/outline';
import classNames from 'classnames';
import { useFormulaStore, Tag } from '../../store/formulaStore';
import { useAutocomplete, AutocompleteSuggestion } from '../../hooks/useAutocomplete';

const OPERATORS = ['+', '-', '*', '/', '^', '(', ')'];

interface ProcessedTag extends Omit<Tag, 'type'> {
  type: 'number' | 'variable' | 'operator' | 'function';
  value: string;
}

// Create a client-only version of the component
const FormulaInputClient = ({ initialFocused = false }) => {
  const [mounted, setMounted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isFocused, setIsFocused] = useState(initialFocused);
  const [isFormulaMode, setIsFormulaMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const { tags, addTag, removeTag, updateTag, cursorPosition, setCursorPosition } = useFormulaStore();
  const { data: suggestions = [], isLoading, error, refetch } = useAutocomplete(inputValue);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Handle click outside to close suggestions and formula mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mainContainerRef.current &&
        !mainContainerRef.current.contains(event.target as Node)
      ) {
        setIsFormulaMode(false);
        setIsFocused(false);
        setShowSuggestions(false);
        setInputValue('');
      } else if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!mounted) {
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Prevent repetitive input by checking for patterns
    if (value.length > 20) {
      return;
    }

    setInputValue(value);
    // Always show suggestions in formula mode
    if (isFormulaMode) {
      setShowSuggestions(true);
      setSelectedIndex(0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return;

    // Prevent pasting of long text
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const truncated = text.slice(0, 20);
        setInputValue(truncated);
      });
      return;
    }

    // Handle suggestions navigation
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isNaN(Number(inputValue))) {
            const maxIndex = 2;
            setSelectedIndex((prev) => 
              prev < maxIndex ? prev + 1 : 0
            );
          } else {
            const maxIndex = suggestions.length - 1;
            setSelectedIndex((prev) => 
              prev < maxIndex ? prev + 1 : 0
            );
          }
          return;
        case 'ArrowUp':
          e.preventDefault();
          if (!isNaN(Number(inputValue))) {
            const maxIndex = 2;
            setSelectedIndex((prev) => 
              prev > 0 ? prev - 1 : maxIndex
            );
          } else {
            const maxIndex = suggestions.length - 1;
            setSelectedIndex((prev) => 
              prev > 0 ? prev - 1 : maxIndex
            );
          }
          return;
        case 'Enter':
          e.preventDefault();
          if (!isNaN(Number(inputValue))) {
            const options = ['Value', 'Percentage', 'Growth'];
            addTag({
              value: inputValue,
              type: 'number',
              selectedOption: options[selectedIndex] as 'Value' | 'Percentage' | 'Growth',
            });
          } else if (suggestions && suggestions[selectedIndex]) {
            handleSuggestionSelect(suggestions[selectedIndex]);
          }
          setInputValue('');
          setShowSuggestions(false);
          return;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          return;
        case 'Tab':
          if (suggestions[0]) {
            e.preventDefault();
            handleSuggestionSelect(suggestions[0]);
            return;
          }
          break;
      }
    }

    // Handle number input with Enter key or space
    if ((e.key === 'Enter' || e.key === ' ') && inputValue.trim() !== '' && !isNaN(Number(inputValue))) {
      e.preventDefault();
      addTag({
        value: inputValue.trim(),
        type: 'number',
        selectedOption: 'Percentage', // Default to Percentage for numbers
      });
      setInputValue('');
      setShowSuggestions(true); // Keep suggestions visible after number
      return;
    }

    // Handle backspace to delete tags
    if (e.key === 'Backspace' && !inputValue) {
      e.preventDefault();
      if (tags.length > 0 && cursorPosition > 0) {
        removeTag(tags[cursorPosition - 1].id);
        // Show suggestions after deleting a tag
        setShowSuggestions(true);
      }
    }

    // Handle cursor movement
    if (e.key === 'ArrowLeft' && !inputValue) {
      e.preventDefault();
      setCursorPosition(Math.max(0, cursorPosition - 1));
    }
    if (e.key === 'ArrowRight' && !inputValue) {
      e.preventDefault();
      setCursorPosition(Math.min(tags.length, cursorPosition + 1));
    }

    // Handle operator keys directly
    if (OPERATORS.includes(e.key)) {
      e.preventDefault();
      handleOperatorInput(e.key);
      // Keep suggestions visible after operator
      setShowSuggestions(true);
    }
  };

  const handleSuggestionSelect = (suggestion: AutocompleteSuggestion) => {
    if (suggestion.category === 'function') {
      addTag({
        value: suggestion.name,
        type: 'function',
        selectedOption: 'Value',
      });
    } else {
      addTag({
        value: suggestion.name,
        type: 'variable',
        selectedOption: 'Value',
      });
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const handleOperatorInput = (operator: string) => {
    addTag({
      value: operator,
      type: 'operator',
    });
    setInputValue('');
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let newPosition = tags.length;

    const tagElements = containerRef.current.getElementsByClassName('tag-item');
    for (let i = 0; i < tagElements.length; i++) {
      const tagRect = tagElements[i].getBoundingClientRect();
      const tagCenter = tagRect.left + tagRect.width / 2 - rect.left;
      if (x < tagCenter) {
        newPosition = i;
        break;
      }
    }

    setCursorPosition(newPosition);
    inputRef.current?.focus();
    // Always show suggestions when clicking in formula mode
    if (isFormulaMode) {
      setShowSuggestions(true);
    }
  };

  const handleClearInput = () => {
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const calculateFormula = () => {
    try {
      // First pass: Process variables and percentages
      const processedTags = tags.reduce<ProcessedTag[]>((acc, tag, index) => {
        // Handle variables and numbers
        if (tag.type === 'variable' || tag.type === 'number') {
          let value = tag.type === 'variable' ? Number(tag.value) || 0 : Number(tag.value);

          // Handle percentage calculations
          if (tag.selectedOption === 'Percentage') {
            // For percentage, we need to look at the next tag
            const nextTag = tags[index + 1];
            if (nextTag && (nextTag.type === 'number' || nextTag.type === 'variable')) {
              const nextValue = nextTag.type === 'variable' ? 
                Number(nextTag.value) || 0 : 
                Number(nextTag.value);
              // Calculate percentage of the next value
              value = (value / 100) * nextValue;
              // Skip the next tag since we've used it
              acc.push({ ...tag, value: value.toString(), type: 'number' });
              return acc;
            }
          }
          
          return [...acc, { ...tag, value: value.toString(), type: 'number' }];
        }

        // Handle operators
        if (tag.type === 'operator') {
          return [...acc, { ...tag, type: 'operator' }];
        }

        return acc;
      }, []);

      // Second pass: Process operators following order of operations
      const calculateOperation = (tags: ProcessedTag[]): number => {
        // First handle multiplication and division
        const tempTags: ProcessedTag[] = [...tags];
        for (let i = 0; i < tempTags.length; i++) {
          if (tempTags[i].type === 'operator' && (tempTags[i].value === '*' || tempTags[i].value === '/')) {
            const prev = Number(tempTags[i - 1].value);
            const next = Number(tempTags[i + 1].value);
            let result;
            
            if (tempTags[i].value === '*') {
              result = prev * next;
            } else {
              if (next === 0) throw new Error('Division by zero');
              result = prev / next;
            }
            
            // Replace the three tags (number, operator, number) with the result
            tempTags.splice(i - 1, 3, { ...tempTags[i - 1], type: 'number', value: result.toString() });
            i--; // Adjust index since we removed elements
          }
        }

        // Then handle addition and subtraction
        let result = Number(tempTags[0].value) || 0;
        let currentOp = '+';
        
        for (let i = 1; i < tempTags.length; i++) {
          const tag = tempTags[i];
          
          if (tag.type === 'number') {
            const value = Number(tag.value);
            if (currentOp === '+') {
              result += value;
            } else if (currentOp === '-') {
              result -= value;
            }
          } else if (tag.type === 'operator') {
            currentOp = tag.value;
          }
        }
        
        return result;
      };

      const result = calculateOperation(processedTags);
      return Number.isInteger(result) ? result.toString() : result.toFixed(2);
    } catch (error) {
      if (error instanceof Error) {
        return `Error: ${error.message}`;
      }
      return 'Error: Invalid formula';
    }
  };

  const handleDoubleClick = () => {
    setIsFormulaMode(true);
    setIsFocused(true);
    inputRef.current?.focus();
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Prevent formula mode on regular focus
    if (!isFormulaMode) {
      (e.target as HTMLInputElement).blur();
      return;
    }
    setIsFocused(true);
    setShowSuggestions(true); // Always show suggestions on focus in formula mode
  };

  return (
    <div className="relative w-full" ref={mainContainerRef}>
      {!isFormulaMode ? (
        <div 
          className="w-full h-full min-h-[40px] border border-gray-200 bg-white flex items-center cursor-pointer hover:bg-gray-50 rounded-lg" 
          onDoubleClick={handleDoubleClick}
          role="gridcell"
          tabIndex={-1}
          aria-colindex={3}
        >
          <div className="flex items-center px-3 py-2 w-full gap-2">
            <PlusIconOutline className="w-4 h-4 text-[#bac4cc]" />
            <div className="flex-1 text-sm text-gray-600">
              <input
                ref={inputRef}
                type="text"
                className="w-full outline-none bg-transparent placeholder-gray-400"
                placeholder="Enter formula"
                onFocus={handleInputFocus}
                readOnly
              />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="relative border rounded-lg bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <div
                ref={containerRef}
                onClick={handleContainerClick}
                className="flex items-center gap-1 p-2 min-h-[40px] cursor-text relative whitespace-nowrap"
                aria-label="Formula input"
                role="textbox"
              >
                {isFocused && <span className="text-gray-400 mr-1 sticky left-0">=</span>}
                {tags.map((tag, index) => (
                  <React.Fragment key={tag.id}>
                    {index === cursorPosition && (
                      <div className="relative flex items-center flex-shrink-0">
                        <input
                          ref={inputRef}
                          type="text"
                          className={classNames(
                            "outline-none bg-transparent",
                            inputValue || isFocused ? "min-w-[40px]" : "w-4"
                          )}
                          value={inputValue}
                          onChange={handleInputChange}
                          onKeyDown={handleKeyDown}
                          onFocus={handleInputFocus}
                          onBlur={() => {
                            if (!inputValue) setIsFocused(false);
                          }}
                          onCompositionStart={() => setIsComposing(true)}
                          onCompositionEnd={() => setIsComposing(false)}
                          placeholder={isFocused ? "Enter a formula" : ""}
                          aria-label="Formula input"
                          aria-controls="suggestions-list"
                          aria-activedescendant={
                            showSuggestions && suggestions[selectedIndex]
                              ? `suggestion-${suggestions[selectedIndex].id}`
                              : undefined
                          }
                          style={{ width: `${Math.max(40, inputValue.length * 8)}px` }}
                        />
                        {inputValue && (
                          <button
                            onClick={handleClearInput}
                            className="p-1 hover:text-gray-700 text-gray-400 flex-shrink-0"
                            aria-label="Clear input"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                    <span className="tag-item flex-shrink-0 inline-flex">
                      <TagComponent 
                        tag={tag} 
                        onUpdate={updateTag}
                      />
                    </span>
                  </React.Fragment>
                ))}
                {cursorPosition === tags.length && (
                  <div className="relative flex items-center flex-shrink-0">
                    <input
                      ref={inputRef}
                      type="text"
                      className={classNames(
                        "outline-none bg-transparent",
                        inputValue || isFocused ? "min-w-[40px]" : "w-4"
                      )}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      onFocus={handleInputFocus}
                      onBlur={() => {
                        if (!inputValue) setIsFocused(false);
                      }}
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={() => setIsComposing(false)}
                      placeholder={isFocused ? "Enter a formula" : ""}
                      aria-label="Formula input"
                      aria-controls="suggestions-list"
                      aria-activedescendant={
                        showSuggestions && suggestions[selectedIndex]
                          ? `suggestion-${suggestions[selectedIndex].id}`
                          : undefined
                      }
                      style={{ width: `${Math.max(40, inputValue.length * 8)}px` }}
                    />
                    {inputValue && (
                      <button
                        onClick={handleClearInput}
                        className="p-1 hover:text-gray-700 text-gray-400 flex-shrink-0"
                        aria-label="Clear input"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-white to-transparent" />
          </div>
          
          {showSuggestions && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-lg shadow-lg max-h-[400px] overflow-auto border border-gray-200"
              role="listbox"
              id="suggestions-list"
            >
              {isLoading ? (
                <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
              ) : error ? (
                <div className="px-3 py-2">
                  <div className="text-sm text-red-500">Failed to load suggestions</div>
                  <button
                    onClick={() => refetch()}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    Retry
                  </button>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
              ) : (
                <ul className="py-0">
                  {!isNaN(Number(inputValue)) ? (
                    <>
                      <li
                        className={classNames(
                          'px-4 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100',
                          { 'bg-violet-50': selectedIndex === 0 }
                        )}
                        onClick={() => {
                          addTag({
                            value: inputValue.trim(),
                            type: 'number',
                            selectedOption: 'Value',
                          });
                          setInputValue('');
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Value</span>
                        </div>
                      </li>
                      <li
                        className={classNames(
                          'px-4 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100',
                          { 'bg-violet-50': selectedIndex === 1 }
                        )}
                        onClick={() => {
                          addTag({
                            value: inputValue.trim(),
                            type: 'number',
                            selectedOption: 'Percentage',
                          });
                          setInputValue('');
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Percentage</span>
                        </div>
                      </li>
                      <li
                        className={classNames(
                          'px-4 py-2 cursor-pointer hover:bg-gray-50',
                          { 'bg-violet-50': selectedIndex === 2 }
                        )}
                        onClick={() => {
                          addTag({
                            value: inputValue.trim(),
                            type: 'number',
                            selectedOption: 'Growth',
                          });
                          setInputValue('');
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Growth</span>
                        </div>
                      </li>
                    </>
                  ) : (
                    <>
                      {suggestions.some(s => s.category === 'folder') && (
                        <li className="bg-violet-50/50 px-4 py-2 border-b border-gray-100">
                          <div className="flex items-center gap-2 text-violet-900">
                            <span className="text-violet-600 text-sm">•</span>
                            <span className="text-sm font-medium">Sales assumptions</span>
                          </div>
                          <div className="text-xs text-violet-600 mt-1 pl-5">• Inputs</div>
                        </li>
                      )}
                      {suggestions.map((suggestion, index) => (
                        <li
                          key={`${suggestion.id}-${index}`}
                          id={`suggestion-${suggestion.id}`}
                          className={classNames(
                            'px-4 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0',
                            { 'bg-violet-50': index === selectedIndex }
                          )}
                          onClick={() => handleSuggestionSelect(suggestion)}
                          role="option"
                          aria-selected={index === selectedIndex}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              {suggestion.category === 'function' && (
                                <span className="text-violet-600 text-sm font-medium">ƒ</span>
                              )}
                              {suggestion.category === 'folder' && (
                                <span className="text-violet-600 font-medium">•</span>
                              )}
                              <span className="text-sm font-medium">{suggestion.name}</span>
                              {suggestion.value && (
                                <span className="text-xs text-gray-500">
                                  ({suggestion.value})
                                </span>
                              )}
                            </div>
                            {suggestion.inputs && (
                              <span className="text-xs text-gray-500 pl-6 mt-0.5">
                                {suggestion.inputs}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </>
                  )}
                </ul>
              )}
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              Result: {calculateFormula()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Export the component directly instead of using dynamic import
export const FormulaInput = FormulaInputClient;

function TagComponent({ 
  tag, 
  onUpdate
}: { 
  tag: Tag; 
  onUpdate: (id: string, updates: Partial<Tag>) => void;
}) {
  const options = ['Value', 'Percentage', 'Growth'];
  
  // Always show dropdown for variables and numbers
  const showDropdown = tag.type === 'variable' || tag.type === 'number';
  
  return (
    <div className={classNames(
      'inline-flex items-center rounded px-2 py-1 text-sm gap-1 whitespace-nowrap',
      {
        'bg-blue-50 border border-blue-100': tag.type === 'variable',
        'bg-gray-50 border border-gray-200': tag.type === 'operator',
        'bg-green-50 border border-green-100': tag.type === 'number',
      }
    )}>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1">
          <span className="whitespace-nowrap">{tag.value}</span>
          {tag.type === 'variable' && tag.variableValue && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {tag.variableValue}
            </span>
          )}
        </div>
        {tag.inputs && (
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {tag.inputs}
          </span>
        )}
      </div>
      {showDropdown && (
        <Listbox
          value={tag.selectedOption || 'Value'}
          onChange={(value) => onUpdate(tag.id, { selectedOption: value })}
        >
          <div className="relative flex-shrink-0">
            <Listbox.Button className="flex items-center text-xs text-gray-600 bg-white rounded px-2 py-1 border border-gray-200 hover:bg-gray-50 whitespace-nowrap">
              <span>{tag.selectedOption || 'Value'}</span>
              <ChevronDownIcon className="w-3 h-3 ml-1 text-gray-400" />
            </Listbox.Button>
            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <div className="absolute right-0 z-50">
                <Listbox.Options className="w-auto py-1 mt-1 bg-white rounded-lg shadow-lg border border-gray-200">
                  {options.map((option) => (
                    <Listbox.Option
                      key={option}
                      value={option}
                      className={({ active }) =>
                        classNames('px-4 py-2 cursor-pointer text-sm whitespace-nowrap', {
                          'bg-violet-50 text-violet-900': active,
                          'text-gray-900': !active,
                        })
                      }
                    >
                      {option}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Transition>
          </div>
        </Listbox>
      )}
    </div>
  );
} 