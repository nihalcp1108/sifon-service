import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check, Plus } from 'lucide-react';

export function SearchableSelect({
  label,
  required = false,
  options = [],
  value = '',
  onChange,
  onAddNew,
  addNewLabel = 'Add New',
  placeholder = '-- Select an option --',
  error = '',
  name = '',
  disabled = false,
  helperText = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchLabel = opt.label?.toLowerCase().includes(term);
    const matchSublabel = opt.sublabel?.toLowerCase().includes(term);
    return matchLabel || matchSublabel;
  });

  const handleSelect = (optValue) => {
    onChange({ target: { name, value: optValue } });
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ target: { name, value: '' } });
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-slate-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="text-[11px] text-teal-600 hover:text-teal-700 font-semibold inline-flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              <span>{addNewLabel}</span>
            </button>
          )}
        </div>
      )}

      {/* Main trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 bg-slate-50 border rounded-xl text-xs text-left transition focus:bg-white focus:outline-none focus:ring-1 ${
          error
            ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
            : isOpen
            ? 'border-teal-500 ring-1 ring-teal-500 bg-white'
            : 'border-slate-200 focus:ring-teal-500'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="truncate flex-1 mr-2">
          {selectedOption ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-slate-900 truncate">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-slate-400 text-[11px] truncate">({selectedOption.sublabel})</span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedOption && !required && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Hidden input for form submission if native form validation is checked */}
      <input
        type="hidden"
        name={name}
        value={value || ''}
        required={required}
      />

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in-50 duration-100">
          {/* Search box inside dropdown */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                <span>No results found</span>
                {onAddNew && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onAddNew();
                    }}
                    className="block mx-auto mt-2 text-teal-600 hover:text-teal-700 font-semibold text-xs"
                  >
                    + {addNewLabel}
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-teal-50 text-teal-800 font-semibold'
                        : opt.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="truncate flex-1 mr-2">
                      <div className="font-medium truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-slate-400 truncate">{opt.sublabel}</div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
      {helperText && !error && <p className="text-[10px] text-slate-400 mt-1">{helperText}</p>}
    </div>
  );
}

export default SearchableSelect;

