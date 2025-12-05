'use client';

import React, { useState } from 'react';

interface CalculatorAppProps {
  onClose: () => void;
}

export function CalculatorApp({ onClose }: CalculatorAppProps) {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState(true);

  const handleNumber = (num: string) => {
    if (newNumber) {
      setDisplay(num);
      setNewNumber(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOperation = (op: string) => {
    const current = parseFloat(display);
    
    if (previousValue === null) {
      setPreviousValue(current);
    } else if (operation) {
      const result = calculate(previousValue, current, operation);
      setDisplay(String(result));
      setPreviousValue(result);
    }
    
    setOperation(op);
    setNewNumber(true);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (operation && previousValue !== null) {
      const current = parseFloat(display);
      const result = calculate(previousValue, current, operation);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperation(null);
      setNewNumber(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setNewNumber(true);
  };

  const handleDecimal = () => {
    if (newNumber) {
      setDisplay('0.');
      setNewNumber(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const Button = ({ children, onClick, className = '', variant = 'default' }: any) => {
    const variants = {
      default: 'bg-cyan-500/20 hover:bg-cyan-500/40 border-cyan-400/50 text-cyan-100',
      operation: 'bg-blue-500/20 hover:bg-blue-500/40 border-blue-400/50 text-blue-100',
      equals: 'bg-emerald-500/20 hover:bg-emerald-500/40 border-emerald-400/50 text-emerald-100',
      clear: 'bg-red-500/20 hover:bg-red-500/40 border-red-400/50 text-red-100',
    };

    return (
      <button
        onClick={onClick}
        className={`relative p-4 rounded-lg border-2 backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95 font-bold text-xl ${variants[variant]} ${className}`}
        style={{
          boxShadow: '0 0 20px rgba(34,211,238,0.3)',
        }}
      >
        {children}
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2" />
      </button>
    );
  };

  return (
    <div className="relative w-96 bg-black/80 backdrop-blur-xl border-2 border-cyan-400/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(34,211,238,0.4)]">
      {/* Header */}
      <div 
        className="flex items-center justify-between mb-6 cursor-grab active:cursor-grabbing" 
        data-drag-handle
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔢</div>
          <h2 className="text-xl font-bold text-cyan-400 tracking-wider">CALCULATOR</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 border border-red-400/30"
        >
          ✕
        </button>
      </div>

      {/* Display */}
      <div className="mb-6 p-6 bg-cyan-950/30 border-2 border-cyan-400/30 rounded-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-transparent" />
        <div className="relative text-right">
          {operation && previousValue !== null && (
            <div className="text-sm text-cyan-400/60 mb-1">
              {previousValue} {operation}
            </div>
          )}
          <div className="text-4xl font-bold text-cyan-100 tracking-wider font-mono">
            {display}
          </div>
        </div>
        {/* Scan line effect */}
        <div
          className="absolute left-0 right-0 h-0.5 bg-cyan-400/50"
          style={{
            animation: 'scanline 2s linear infinite',
          }}
        />
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-4 gap-3">
        <Button variant="clear" onClick={handleClear}>C</Button>
        <Button variant="operation" onClick={() => handleOperation('÷')}>÷</Button>
        <Button variant="operation" onClick={() => handleOperation('×')}>×</Button>
        <Button variant="operation" onClick={() => handleOperation('-')}>−</Button>

        <Button onClick={() => handleNumber('7')}>7</Button>
        <Button onClick={() => handleNumber('8')}>8</Button>
        <Button onClick={() => handleNumber('9')}>9</Button>
        <Button variant="operation" onClick={() => handleOperation('+')}>+</Button>

        <Button onClick={() => handleNumber('4')}>4</Button>
        <Button onClick={() => handleNumber('5')}>5</Button>
        <Button onClick={() => handleNumber('6')}>6</Button>
        <Button variant="equals" onClick={handleEquals} className="row-span-2">
          =
        </Button>

        <Button onClick={() => handleNumber('1')}>1</Button>
        <Button onClick={() => handleNumber('2')}>2</Button>
        <Button onClick={() => handleNumber('3')}>3</Button>

        <Button onClick={() => handleNumber('0')} className="col-span-2">0</Button>
        <Button onClick={handleDecimal}>.</Button>
      </div>

      <style jsx>{`
        @keyframes scanline {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 0.5; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

