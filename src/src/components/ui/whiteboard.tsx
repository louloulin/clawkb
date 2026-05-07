/**
 * Whiteboard — Logseq-style infinite canvas
 *
 * Features:
 * 1. Infinite canvas with pan/zoom
 * 2. Card creation and dragging
 * 3. Connection lines between cards
 * 4. Export to image
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Move, MousePointer, ZoomIn, ZoomOut,
  Maximize2, Download, Link, Unlink, GripVertical, X,
  Circle, Square, Type, Image, StickyNote, ChevronDown
} from 'lucide-react';

interface WhiteboardCard {
  id: string;
  type: 'note' | 'text' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  connections: string[]; // IDs of connected cards
}

interface WhiteboardProps {
  storageKey?: string;
  onCardClick?: (card: WhiteboardCard) => void;
}

const CARD_COLORS = [
  { id: 'amber', bg: 'bg-amber-200/20', border: 'border-amber-400/40', text: 'text-amber-200' },
  { id: 'blue', bg: 'bg-blue-200/20', border: 'border-blue-400/40', text: 'text-blue-200' },
  { id: 'emerald', bg: 'bg-emerald-200/20', border: 'border-emerald-400/40', text: 'text-emerald-200' },
  { id: 'rose', bg: 'bg-rose-200/20', border: 'border-rose-400/40', text: 'text-rose-200' },
  { id: 'violet', bg: 'bg-violet-200/20', border: 'border-violet-400/40', text: 'text-violet-200' },
  { id: 'slate', bg: 'bg-slate-200/10', border: 'border-slate-400/40', text: 'text-slate-300' },
];

const STORAGE_KEY = 'clawkb-whiteboards';

export function Whiteboard({ storageKey, onCardClick }: WhiteboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<WhiteboardCard[]>([]);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const [canvasStart, setCanvasStart] = useState({ x: 0, y: 0 });
  const [addingCard, setAddingCard] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [tool, setTool] = useState<'select' | 'pan' | 'connect'>('select');
  const [showGrid, setShowGrid] = useState(true);

  // Load from storage
  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${storageKey}`);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setCards(data.cards || []);
          setViewOffset(data.viewOffset || { x: 0, y: 0 });
          setZoom(data.zoom || 1);
        } catch { /* ignore */ }
      }
    }
  }, [storageKey]);

  // Save to storage
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`${STORAGE_KEY}-${storageKey}`, JSON.stringify({
        cards,
        viewOffset,
        zoom,
      }));
    }
  }, [cards, viewOffset, zoom, storageKey]);

  // Add new card
  const addCard = useCallback((type: WhiteboardCard['type'] = 'note') => {
    const centerX = window.innerWidth / 2 / zoom - viewOffset.x;
    const centerY = window.innerHeight / 2 / zoom - viewOffset.y;
    const newCard: WhiteboardCard = {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      x: centerX - 100 + Math.random() * 50,
      y: centerY - 60 + Math.random() * 50,
      width: 200,
      height: 120,
      content: '',
      color: 'amber',
      connections: [],
    };
    setCards(prev => [...prev, newCard]);
    setSelectedCard(newCard.id);
    setEditingCard(newCard.id);
    setAddingCard(false);
  }, [zoom, viewOffset]);

  // Update card
  const updateCard = useCallback((cardId: string, updates: Partial<WhiteboardCard>) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updates } : c));
  }, []);

  // Delete card
  const deleteCard = useCallback((cardId: string) => {
    setCards(prev => prev
      .filter(c => c.id !== cardId)
      .map(c => ({ ...c, connections: c.connections.filter(id => id !== cardId) }))
    );
    if (selectedCard === cardId) setSelectedCard(null);
  }, [selectedCard]);

  // Toggle connection
  const toggleConnection = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setCards(prev => prev.map(card => {
      if (card.id === fromId) {
        const hasConnection = card.connections.includes(toId);
        return {
          ...card,
          connections: hasConnection
            ? card.connections.filter(id => id !== toId)
            : [...card.connections, toId],
        };
      }
      return card;
    }));
  }, []);

  // Canvas mouse events
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (tool === 'pan' || e.button === 1) {
      setDraggingCanvas(true);
      setCanvasStart({ x: e.clientX - viewOffset.x * zoom, y: e.clientY - viewOffset.y * zoom });
    } else if (tool === 'select' && e.target === containerRef.current) {
      setSelectedCard(null);
      setEditingCard(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingCanvas) {
      setViewOffset({
        x: (e.clientX - canvasStart.x) / zoom,
        y: (e.clientY - canvasStart.y) / zoom,
      });
    }
    if (draggingCard) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      const card = cards.find(c => c.id === draggingCard);
      if (card) {
        updateCard(draggingCard, {
          x: card.x + dx,
          y: card.y + dy,
        });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingCanvas(false);
    setDraggingCard(null);
    if (connectingFrom) setConnectingFrom(null);
  };

  // Card events
  const handleCardMouseDown = (e: React.MouseEvent, cardId: string) => {
    e.stopPropagation();
    if (tool === 'connect') {
      if (connectingFrom) {
        toggleConnection(connectingFrom, cardId);
        setConnectingFrom(null);
      } else {
        setConnectingFrom(cardId);
      }
    } else if (tool === 'select') {
      setSelectedCard(cardId);
      setDraggingCard(cardId);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Zoom
  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.25, Math.min(2, zoom + delta));
    setZoom(newZoom);
  };

  // Fit to screen
  const fitToScreen = () => {
    if (cards.length === 0) {
      setViewOffset({ x: 0, y: 0 });
      setZoom(1);
      return;
    }
    const minX = Math.min(...cards.map(c => c.x));
    const maxX = Math.max(...cards.map(c => c.x + c.width));
    const minY = Math.min(...cards.map(c => c.y));
    const maxY = Math.max(...cards.map(c => c.y + c.height));
    const width = maxX - minX + 100;
    const height = maxY - minY + 100;
    const container = containerRef.current;
    if (container) {
      const scaleX = container.clientWidth / width;
      const scaleY = container.clientHeight / height;
      const newZoom = Math.min(scaleX, scaleY, 1.5);
      setZoom(newZoom);
      setViewOffset({
        x: -minX + 50,
        y: -minY + 50,
      });
    }
  };

  // Export to image
  const exportImage = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const minX = Math.min(...cards.map(c => c.x), 0);
    const maxX = Math.max(...cards.map(c => c.x + c.width), 800);
    const minY = Math.min(...cards.map(c => c.y), 0);
    const maxY = Math.max(...cards.map(c => c.y + c.height), 600);
    const padding = 50;

    canvas.width = maxX - minX + padding * 2;
    canvas.height = maxY - minY + padding * 2;

    // Background
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw connections
    cards.forEach(card => {
      const cx = card.x - minX + padding;
      const cy = card.y - minY + padding;
      card.connections.forEach(targetId => {
        const target = cards.find(c => c.id === targetId);
        if (target) {
          const tx = target.x - minX + padding + target.width / 2;
          const ty = target.y - minY + padding + target.height / 2;
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx + card.width / 2, cy + card.height / 2);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      });
    });

    // Draw cards
    cards.forEach(card => {
      const x = card.x - minX + padding;
      const y = card.y - minY + padding;
      const colorScheme = CARD_COLORS.find(c => c.id === card.color) || CARD_COLORS[0];

      // Card background
      ctx.fillStyle = 'rgba(30, 35, 45, 0.9)';
      ctx.strokeStyle = colorScheme.border.replace('border-', 'rgba(').replace('/40)', ', 0.4)');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, card.width, card.height, 8);
      ctx.fill();
      ctx.stroke();

      // Card content
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px system-ui';
      const text = card.content || '无内容';
      const lines = text.split('\n').slice(0, 4);
      lines.forEach((line, i) => {
        ctx.fillText(line.slice(0, 25), x + 10, y + 25 + i * 18);
      });
    });

    // Download
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Render connections
  const renderConnections = () => {
    return cards.map(card => {
      const startX = card.x + card.width / 2;
      const startY = card.y + card.height / 2;
      return card.connections.map(targetId => {
        const target = cards.find(c => c.id === targetId);
        if (!target) return null;
        const endX = target.x + target.width / 2;
        const endY = target.y + target.height / 2;
        return (
          <line
            key={`${card.id}-${targetId}`}
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="rgba(245, 158, 11, 0.4)"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        );
      });
    }).flat();
  };

  const selectedCardData = cards.find(c => c.id === selectedCard);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0f1419]">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1">
        <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur">
          <button
            onClick={() => setTool('select')}
            className={`p-1.5 rounded transition ${tool === 'select' ? 'bg-amber-200/20 text-amber-200' : 'text-slate-400 hover:text-white'}`}
            title="选择"
          >
            <MousePointer className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTool('pan')}
            className={`p-1.5 rounded transition ${tool === 'pan' ? 'bg-amber-200/20 text-amber-200' : 'text-slate-400 hover:text-white'}`}
            title="平移"
          >
            <Move className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTool('connect')}
            className={`p-1.5 rounded transition ${tool === 'connect' ? 'bg-amber-200/20 text-amber-200' : 'text-slate-400 hover:text-white'}`}
            title="连接"
          >
            <Link className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-2 flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur">
          <button
            onClick={() => addCard('note')}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="添加卡片"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={fitToScreen}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="适应屏幕"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleZoom(-0.1)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="缩小"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="px-1 text-[11px] text-slate-500 min-w-[3ch] text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => handleZoom(0.1)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="放大"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-2 flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded transition ${showGrid ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
            title="显示网格"
          >
            <Square className="h-4 w-4" />
          </button>
          <button
            onClick={exportImage}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="导出图片"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Connecting indicator */}
      {connectingFrom && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-amber-200/20 border border-amber-400/40 text-[11px] text-amber-200">
          选择目标卡片以连接
          <button onClick={() => setConnectingFrom(null)} className="ml-2 hover:text-white">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`w-full h-full ${tool === 'pan' || draggingCanvas ? 'cursor-grab' : draggingCard ? 'cursor-grabbing' : 'cursor-default'}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      >
        <svg
          className="w-full h-full"
          style={{
            transform: `scale(${zoom}) translate(${viewOffset.x}px, ${viewOffset.y}px)`,
            transformOrigin: '0 0',
          }}
        >
          {/* Grid */}
          {showGrid && (
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              </pattern>
            </defs>
          )}
          <rect width="10000" height="10000" x="-5000" y="-5000" fill={showGrid ? "url(#grid)" : "none"} />

          {/* Connections */}
          <g>
            {renderConnections()}
          </g>

          {/* Cards */}
          {cards.map(card => {
            const colorScheme = CARD_COLORS.find(c => c.id === card.color) || CARD_COLORS[0];
            const isSelected = selectedCard === card.id;
            const isEditing = editingCard === card.id;
            return (
              <foreignObject
                key={card.id}
                x={card.x}
                y={card.y}
                width={card.width}
                height={card.height}
                onMouseDown={(e) => handleCardMouseDown(e as unknown as React.MouseEvent, card.id)}
                className="cursor-pointer"
              >
                <div
                  className={`w-full h-full rounded-lg border backdrop-blur transition-shadow ${
                    colorScheme.bg
                  } ${colorScheme.border} ${
                    isSelected ? 'ring-2 ring-amber-400/50 shadow-lg shadow-amber-400/10' : ''
                  }`}
                >
                  {/* Card header */}
                  <div className={`flex items-center gap-1 px-2 py-1 border-b ${colorScheme.border}`}>
                    <GripVertical className={`h-3 w-3 ${colorScheme.text}`} />
                    <span className={`text-[10px] ${colorScheme.text}`}>
                      {card.type === 'note' ? '笔记' : card.type === 'text' ? '文本' : '图片'}
                    </span>
                    <div className="ml-auto flex items-center gap-0.5">
                      {tool === 'connect' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConnectingFrom(card.id);
                          }}
                          className={`p-0.5 rounded ${connectingFrom === card.id ? 'bg-amber-200/30 text-amber-200' : 'text-slate-500 hover:text-white'}`}
                        >
                          <Link className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCard(card.id);
                        }}
                        className="p-0.5 rounded text-slate-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Card content */}
                  <div className="p-2">
                    {isEditing ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onBlur={() => {
                          updateCard(card.id, { content: editContent });
                          setEditingCard(null);
                        }}
                        className="w-full h-full bg-transparent resize-none outline-none text-[12px] text-slate-200 placeholder:text-slate-600"
                        placeholder="输入内容..."
                        autoFocus
                      />
                    ) : (
                      <div
                        className="text-[12px] text-slate-300 whitespace-pre-wrap line-clamp-4"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCard(card.id);
                          setEditContent(card.content);
                        }}
                      >
                        {card.content || (
                          <span className="text-slate-600 italic">双击编辑...</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Connection indicator */}
                  {card.connections.length > 0 && (
                    <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] ${colorScheme.bg} ${colorScheme.text}`}>
                      {card.connections.length} 个连接
                    </div>
                  )}
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>

      {/* Selected card panel */}
      {selectedCardData && !editingCard && (
        <div className="absolute bottom-3 right-3 w-64 p-3 rounded-lg bg-black/80 border border-white/10 backdrop-blur">
          <div className="text-[11px] text-slate-400 mb-2">卡片设置</div>

          {/* Color picker */}
          <div className="mb-2">
            <div className="text-[10px] text-slate-500 mb-1">颜色</div>
            <div className="flex gap-1">
              {CARD_COLORS.map(color => (
                <button
                  key={color.id}
                  onClick={() => updateCard(selectedCardData.id, { color: color.id })}
                  className={`w-6 h-6 rounded ${color.bg} ${color.border} border ${
                    selectedCardData.color === color.id ? 'ring-2 ring-white/50' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Connections */}
          <div className="mb-2">
            <div className="text-[10px] text-slate-500 mb-1">连接 ({selectedCardData.connections.length})</div>
            {selectedCardData.connections.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedCardData.connections.map(connId => {
                  const conn = cards.find(c => c.id === connId);
                  return (
                    <span
                      key={connId}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-200/10 text-[10px] text-amber-200"
                    >
                      {conn?.content?.slice(0, 10) || '卡片'}
                      <button
                        onClick={() => toggleConnection(selectedCardData.id, connId)}
                        className="hover:text-white"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="text-[10px] text-slate-600">使用连接工具添加连接</div>
            )}
          </div>

          <button
            onClick={() => {
              setEditingCard(selectedCardData.id);
              setEditContent(selectedCardData.content);
            }}
            className="w-full mt-1 px-2 py-1.5 rounded bg-white/10 text-[11px] text-slate-300 hover:bg-white/20 transition"
          >
            编辑内容
          </button>
        </div>
      )}

      {/* Empty state */}
      {cards.length === 0 && !addingCard && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <StickyNote className="h-12 w-12 mx-auto mb-3 text-slate-600" />
            <p className="text-[13px] text-slate-500 mb-2">空白画布</p>
            <button
              onClick={() => addCard('note')}
              className="pointer-events-auto px-4 py-2 rounded-lg bg-amber-200/20 text-amber-200 hover:bg-amber-200/30 transition"
            >
              <span className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                添加卡片
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="absolute bottom-3 left-3 text-[10px] text-slate-600">
        拖拽平移 | 滚轮缩放 | 双击编辑
      </div>
    </div>
  );
}
